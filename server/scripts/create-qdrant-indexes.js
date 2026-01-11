/**
 * Script to create Qdrant payload indexes for metadata filtering
 * Run this once to set up indexes for userId and pdfId filtering
 * 
 * Usage: node scripts/create-qdrant-indexes.js
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { QdrantClient } from "@qdrant/js-client-rest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, "..", ".env") });

const COLLECTION_NAME = "pdf-docs";

async function createIndexes() {
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (!qdrantUrl) {
    console.error("❌ QDRANT_URL environment variable is required");
    process.exit(1);
  }

  console.log(`🔗 Connecting to Qdrant: ${qdrantUrl}`);
  
  const client = new QdrantClient({
    url: qdrantUrl,
    ...(qdrantApiKey && { apiKey: qdrantApiKey }),
  });

  try {
    // Check if collection exists
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(
      (col) => col.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      console.error(`❌ Collection "${COLLECTION_NAME}" does not exist`);
      console.log("💡 Please create the collection first by uploading a PDF");
      process.exit(1);
    }

    console.log(`✅ Collection "${COLLECTION_NAME}" found`);

    // Create index for metadata.userId
    console.log("\n📝 Creating index for metadata.userId...");
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: "metadata.userId",
        field_schema: "keyword",
      });
      console.log("✅ Index created for metadata.userId");
    } catch (error) {
      if (error.data?.status?.error?.includes("already exists")) {
        console.log("ℹ️  Index for metadata.userId already exists");
      } else {
        throw error;
      }
    }

    // Create index for metadata.pdfId
    console.log("\n📝 Creating index for metadata.pdfId...");
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: "metadata.pdfId",
        field_schema: "keyword",
      });
      console.log("✅ Index created for metadata.pdfId");
    } catch (error) {
      if (error.data?.status?.error?.includes("already exists")) {
        console.log("ℹ️  Index for metadata.pdfId already exists");
      } else {
        throw error;
      }
    }

    console.log("\n🎉 All indexes created successfully!");
    console.log("💡 You can now use filters on metadata.userId and metadata.pdfId");
  } catch (error) {
    console.error("\n❌ Error creating indexes:", error.message);
    if (error.data) {
      console.error("Details:", JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

createIndexes();
