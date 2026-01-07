import dotenv from "dotenv";
import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the server directory
dotenv.config({ path: join(__dirname, ".env") });

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    try {
      // Parse job.data if it's a string (from JSON.stringify in index.js)
      const data =
        typeof job.data === "string" ? JSON.parse(job.data) : job.data;
      console.log(`Processing file:`, data);
      /*
        path is data.path which gives the path of the file where it is stored in the server
        read the pdf from path,
        make the chunks out of the pdf,
        make the embeddings of the chunks using openai embeddings model
        store the embeddings in the qdrant vector store
        */

      // Resolve the absolute path
      const filePath = join(__dirname, data.path);
      console.log(`Loading PDF from: ${filePath}`);

      // Check if file exists
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Load the PDF
      const loader = new PDFLoader(filePath);
      console.log("PDF loader created, loading documents...");
      const docs = await loader.load();
      console.log(`Loaded ${docs.length} documents (pages)`);

      // Log some sample document sizes to understand the data
      const sampleSizes = docs.slice(0, 5).map((doc, idx) => ({
        page: idx + 1,
        length: doc.pageContent?.length || 0,
      }));
      console.log("Sample document sizes (first 5 pages):", sampleSizes);
      const totalChars = docs.reduce(
        (sum, doc) => sum + (doc.pageContent?.length || 0),
        0
      );
      console.log(`Total characters across all pages: ${totalChars}`);

      // Split documents into chunks for better retrieval
      // IMPORTANT: We need to split by character count, not by pages
      // Strategy: Combine all pages into one document, then split it properly
      // This ensures chunks are based on character count with proper overlap

      // Use RecursiveCharacterTextSplitter instead of CharacterTextSplitter
      // It's smarter - tries to split on paragraphs, then sentences, then words, then characters
      // This ensures we get chunks close to the target size even if paragraphs are large
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000, // Target characters per chunk
        chunkOverlap: 200, // Overlap between chunks to maintain context
        separators: ["\n\n", "\n", ". ", " ", ""], // Try these separators in order
      });

      // Combine all page documents into one large document
      // This way splitDocuments will properly chunk by character count with overlap
      const combinedText = docs.map((doc) => doc.pageContent).join("\n\n");
      console.log(`Combined text length: ${combinedText.length} characters`);

      // Create a single combined document
      const combinedDoc = new Document({
        pageContent: combinedText,
        metadata: {
          ...docs[0]?.metadata,
          source: data.path,
          totalPages: docs.length,
        },
      });

      // Now split this single document
      let chunks = await textSplitter.splitDocuments([combinedDoc]);
      console.log(
        `Initial split: ${chunks.length} chunks (before overlap enforcement)`
      );

      // MANUALLY ENFORCE OVERLAP
      // RecursiveCharacterTextSplitter may not always apply overlap correctly
      // So we'll manually add overlap to ensure context is preserved
      const overlapSize = 200;
      const chunksWithOverlap = [];

      for (let i = 0; i < chunks.length; i++) {
        const currentChunk = chunks[i].pageContent;
        let chunkText = currentChunk;

        // For all chunks except the first, add overlap from previous chunk
        if (i > 0) {
          const previousChunk = chunks[i - 1].pageContent;
          // Get the last 'overlapSize' characters from previous chunk
          const overlapText = previousChunk.slice(-overlapSize);

          // Prepend overlap to current chunk
          // Check if overlap already exists to avoid duplication
          const first50Chars = chunkText.slice(0, 50);
          const overlapLast50 = overlapText.slice(-50);

          // Only add overlap if it's not already there
          if (first50Chars !== overlapLast50) {
            chunkText = overlapText + chunkText;
          }
        }

        // Create new document with overlapped text
        const overlappedChunk = new Document({
          pageContent: chunkText,
          metadata: {
            ...chunks[i].metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            chunkSize: chunkText.length,
            hasOverlap: i > 0, // Mark if this chunk has overlap from previous
          },
        });

        chunksWithOverlap.push(overlappedChunk);
      }

      chunks = chunksWithOverlap;

      console.log(
        `Final chunks: ${chunks.length} (with enforced ${overlapSize} char overlap)`
      );

      // Log chunk size distribution
      const chunkSizes = chunks.map((chunk) => chunk.pageContent.length);
      const avgChunkSize = Math.round(
        chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length
      );
      const minChunkSize = Math.min(...chunkSizes);
      const maxChunkSize = Math.max(...chunkSizes);
      console.log(`\n=== CHUNK STATISTICS ===`);
      console.log(`Total chunks: ${chunks.length}`);
      console.log(
        `Chunk size stats - Avg: ${avgChunkSize}, Min: ${minChunkSize}, Max: ${maxChunkSize}`
      );
      console.log(`First chunk length: ${chunks[0]?.pageContent.length} chars`);
      console.log(
        `Second chunk length: ${chunks[1]?.pageContent.length} chars`
      );
      console.log(`Third chunk length: ${chunks[2]?.pageContent.length} chars`);

      // Verify overlap is working - check multiple chunk pairs
      // Skip the first chunk if it's too small (special case)
      // overlapSize is already defined above (line 99)
      console.log(`\n=== OVERLAP VERIFICATION ===`);
      console.log(`Expected overlap: ${overlapSize} characters`);

      let overlapWorkingCount = 0;
      let overlapTestedCount = 0;

      // Test overlap on multiple chunk pairs (skip very small chunks)
      const pairsToTest = [
        [1, 2], // Chunk 1 -> Chunk 2
        [2, 3], // Chunk 2 -> Chunk 3
        [10, 11], // Chunk 10 -> Chunk 11
        [50, 51], // Chunk 50 -> Chunk 51
      ].filter(
        ([i, j]) =>
          chunks[i] &&
          chunks[j] &&
          chunks[i].pageContent.length >= overlapSize &&
          chunks[j].pageContent.length >= overlapSize
      );

      for (const [i, j] of pairsToTest) {
        const chunkIEnd = chunks[i].pageContent.slice(-overlapSize);
        const chunkJStart = chunks[j].pageContent.slice(0, overlapSize);

        // Check for exact or near-exact match
        const exactMatch = chunkIEnd === chunkJStart;
        // Check if at least 80% of the overlap matches
        const similarity =
          chunkIEnd.slice(0, Math.floor(overlapSize * 0.8)) ===
          chunkJStart.slice(0, Math.floor(overlapSize * 0.8));

        overlapTestedCount++;
        if (exactMatch || similarity) {
          overlapWorkingCount++;
          console.log(`✓ Chunks ${i}->${j}: Overlap working!`);
        } else {
          console.log(`✗ Chunks ${i}->${j}: No overlap detected`);
          console.log(`  Chunk ${i} ends:   "...${chunkIEnd.slice(-60)}"`);
          console.log(`  Chunk ${j} starts: "${chunkJStart.slice(0, 60)}..."`);
        }
      }

      const overlapPercentage =
        overlapTestedCount > 0
          ? Math.round((overlapWorkingCount / overlapTestedCount) * 100)
          : 0;

      console.log(
        `\nOverlap Summary: ${overlapWorkingCount}/${overlapTestedCount} pairs have overlap (${overlapPercentage}%)`
      );

      if (overlapPercentage >= 50) {
        console.log(`✓ Overlap is working correctly!`);
      } else if (overlapPercentage > 0) {
        console.log(`⚠ Partial overlap detected - may need adjustment`);
      } else {
        console.log(`⚠ Warning: Overlap is NOT working!`);
        console.log(
          `This may indicate RecursiveCharacterTextSplitter is not applying overlap correctly.`
        );
      }
      console.log(`=============================`);
      console.log(`=============================\n`);

      // Verify API key is loaded
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set in environment variables");
      }

      const embeddings = new OpenAIEmbeddings({
        model: "text-embedding-3-small",
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log("embeddings created");
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: process.env.QDRANT_URL,
          collectionName: "pdf-docs",
        }
      );
      console.log("vector store created");
      // Use chunks instead of full documents for better retrieval
      await vectorStore.addDocuments(chunks);
      console.log(`Added ${chunks.length} chunks to the vector store`);
    } catch (error) {
      console.error("Error processing file:", error);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    // Reduced concurrency from 100 to 3 for better resource management
    // Processing PDFs is CPU/memory intensive, so lower concurrency prevents:
    // - Memory exhaustion
    // - API rate limiting
    // - System overload
    concurrency: 3,
    connection: {
      host: "localhost",
      port: 6379,
    },
  }
);
