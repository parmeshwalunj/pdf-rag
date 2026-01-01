import dotenv from "dotenv";
import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
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
      console.log(`Loaded ${docs.length} documents`);
      console.log("First document metadata:", docs[0]?.metadata);
      // Make the chunks out of the pdf
      // const textsplitter = new CharacterTextSplitter({
      //     chunkSize: 500,
      //     chunkOverlap: 0,
      // });
      // const texts = await textSplitter.splitText(docs);
      // console.log(texts);

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
      await vectorStore.addDocuments(docs);
      console.log("Documents added to the vector store");
    } catch (error) {
      console.error("Error processing file:", error);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    concurrency: 100,
    connection: {
      host: "localhost",
      port: 6379,
    },
  }
);
