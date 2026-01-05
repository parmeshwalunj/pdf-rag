import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env file from the server directory
dotenv.config({ path: join(__dirname, ".env") });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const queue = new Queue("file-upload-queue", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});

// Cache vector store connections to avoid recreating on each request
// This significantly improves performance
let cachedEmbeddings = null;
let cachedVectorStore = null;

const getVectorStore = async () => {
  // Return cached instance if available
  if (cachedVectorStore && cachedEmbeddings) {
    return cachedVectorStore;
  }

  // Validate environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }
  if (!process.env.QDRANT_URL) {
    throw new Error("Qdrant URL not configured");
  }

  // Create new embeddings instance (lightweight, can be reused)
  cachedEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create and cache vector store connection
  cachedVectorStore = await QdrantVectorStore.fromExistingCollection(
    cachedEmbeddings,
    {
      url: process.env.QDRANT_URL,
      collectionName: "pdf-docs",
    }
  );

  console.log("Vector store connection cached");
  return cachedVectorStore;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize filename to prevent path traversal attacks
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

// File validation: only allow PDFs, max 10MB
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  return res.json({ status: "All good!" });
});

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  try {
    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Enqueuing all the files to the queue for processing
    // Fixed: Changed "file-ready" to "file-upload-queue" to match worker queue name
    await queue.add("file-upload-queue", {
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    });
    return res.json({ message: "File uploaded successfully!" });
  } catch (error) {
    console.error("Error uploading file:", error);
    // Handle multer errors (file size, type, etc.)
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File too large. Maximum size is 10MB" });
      }
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to upload file" });
  }
});

app.get("/chat", async (req, res) => {
  try {
    const userQuery = req.query.message;

    // Validate query parameter
    if (
      !userQuery ||
      typeof userQuery !== "string" ||
      userQuery.trim().length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Message query parameter is required" });
    }

    // Get cached vector store (or create if first request)
    const vectorStore = await getVectorStore();

    const ret = vectorStore.asRetriever({
      k: 2,
    });
    const result = await ret.invoke(userQuery);

    const SYSTEM_PROMPT = `
You are a helpful assistant that can answer questions about the documents.
You are given a question and a list of documents.
You need to answer the question based on the documents.
If the question is not related to the documents, you should say "This question is not related to the documents. Please ask a question that is related to the documents.".
Be concise and to the point.
Context: ${JSON.stringify(result)}
`;
    const chatResult = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuery },
      ],
    });

    return res.json({
      result: chatResult.choices[0].message.content,
      docs: result,
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    // Provide user-friendly error messages
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect")
    ) {
      return res
        .status(503)
        .json({
          error: "Vector database is unavailable. Please try again later.",
        });
    }
    return res.status(500).json({ error: "Failed to process chat request" });
  }
});

// Global error handler middleware (must be last)
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB" });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    console.error("Unhandled error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
  next();
});

app.listen(8000, () => console.log(`Server started on port: ${8000}`));
