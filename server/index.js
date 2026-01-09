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
import { uploadPDFToCloudinary } from "./services/cloudinary.js";
import { clerkMiddleware, requireAuth } from "@clerk/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env file from the server directory
dotenv.config({ path: join(__dirname, ".env") });

// ============================================
// Environment Variable Validation
// ============================================
const requiredEnvVars = [
  "OPENAI_API_KEY",
  "QDRANT_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLERK_SECRET_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error("\nPlease set these in your .env file or environment.");
  console.error("See .env.example for reference.\n");
  process.exit(1);
}

console.log("✅ All required environment variables are set");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Redis/Valkey connection configuration
// Use environment variables for production (e.g., Upstash Redis)
// Falls back to localhost for local development
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  // For production Redis services (Upstash, Redis Cloud, etc.)
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  ...(process.env.REDIS_TLS === "true" && {
    tls: {
      // Upstash requires TLS but doesn't need certificate verification
      rejectUnauthorized: false,
    },
  }),
  // Connection retry settings for better reliability
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

console.log("Redis connection config:", {
  host: redisConnection.host,
  port: redisConnection.port,
  hasPassword: !!redisConnection.password,
  hasTLS: !!redisConnection.tls,
});

const queue = new Queue("file-upload-queue", {
  connection: redisConnection,
});

// Handle Redis connection errors
queue.on("error", (error) => {
  console.error("Queue Redis connection error:", error);
});

// Log when queue is ready
queue.on("ready", () => {
  console.log("✅ Queue connected to Redis successfully");
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
      // Qdrant Cloud requires API key for authentication
      ...(process.env.QDRANT_API_KEY && { apiKey: process.env.QDRANT_API_KEY }),
    }
  );

  console.log("Vector store connection cached");
  return cachedVectorStore;
};

// File validation: only allow PDFs, max 10MB
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Use memory storage - we'll upload to Cloudinary instead of disk
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory, then upload to Cloudinary
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const app = express();

// CORS configuration
// In production, set FRONTEND_URL environment variable (e.g., https://your-app.vercel.app)
// For local development, allow localhost origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim()) // Support multiple origins (comma-separated)
  : [
      "http://localhost:3000", // Next.js default
      "http://localhost:3001", // Alternative port
      "http://127.0.0.1:3000",
    ];

console.log("CORS allowed origins:", allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies/auth headers if needed
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Clerk authentication middleware
// This validates JWT tokens and attaches user info to req.auth
app.use(clerkMiddleware());

// Health check endpoint (no auth required)
app.get("/", (req, res) => {
  return res.json({ status: "All good!" });
});

// Protected routes - require authentication
app.post(
  "/upload/pdf",
  requireAuth(),
  upload.single("pdf"),
  async (req, res) => {
    try {
      // Extract userId from Clerk session
      const userId = req.auth.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Upload to Cloudinary
      console.log(`Uploading file to Cloudinary for user: ${userId}...`);
      const cloudinaryResult = await uploadPDFToCloudinary(
        req.file.buffer,
        req.file.originalname,
        userId // Pass userId for folder organization
      );

      // Enqueue job with Cloudinary URL and userId
      await queue.add("file-upload-queue", {
        userId: userId, // Add userId to job data
        filename: req.file.originalname,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        // Keep path for backward compatibility, but it's now a Cloudinary URL
        path: cloudinaryResult.secure_url,
      });

      console.log(
        `File uploaded to Cloudinary and queued for processing (user: ${userId})`
      );
      return res.json({
        message: "File uploaded successfully!",
        cloudinaryUrl: cloudinaryResult.secure_url,
      });
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
      // Handle Cloudinary errors
      if (error.message?.includes("Cloudinary")) {
        return res
          .status(500)
          .json({ error: "Failed to upload file to cloud storage" });
      }
      return res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

app.get("/chat", requireAuth(), async (req, res) => {
  try {
    // Extract userId from Clerk session
    const userId = req.auth.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

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

    // Parse pdfIds from query (optional - for multi-select)
    let pdfIds = [];
    if (req.query.pdfIds) {
      try {
        pdfIds = JSON.parse(req.query.pdfIds);
        if (!Array.isArray(pdfIds)) {
          pdfIds = [];
        }
      } catch (e) {
        console.warn("Invalid pdfIds format, ignoring:", e);
        pdfIds = [];
      }
    }

    // Get cached vector store (or create if first request)
    const vectorStore = await getVectorStore();

    // Build Qdrant filter
    const filter = {
      must: [
        {
          key: "userId",
          match: {
            value: userId,
          },
        },
      ],
    };

    // Add pdfIds filter if provided
    if (pdfIds.length > 0) {
      filter.must.push({
        key: "pdfId",
        match: {
          any: pdfIds,
        },
      });
    }

    const ret = vectorStore.asRetriever({
      k: 5,
      filter: filter,
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
      return res.status(503).json({
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

// Use environment variable for port (required by most cloud platforms)
// Falls back to 8000 for local development
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server started on port: ${PORT}`));
