import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OpenAI } from "openai";
import { uploadPDFToCloudinary } from "./services/cloudinary.js";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import {
  createPDFRecord,
  getUserPDFCount,
  getUserPDFs,
  getPDFById,
  deletePDFRecord,
  togglePDFActive,
  validatePDFOwnership,
} from "./services/database.js";
import { v4 as uuidv4 } from "uuid";

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
  "CLERK_PUBLISHABLE_KEY", // Required by @clerk/express middleware
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
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

  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  console.log(`[SERVER] Connecting to Qdrant:`, {
    url: qdrantUrl,
    collectionName: "pdf-docs",
    hasApiKey: !!qdrantApiKey,
  });

  // Create and cache vector store connection
  cachedVectorStore = await QdrantVectorStore.fromExistingCollection(
    cachedEmbeddings,
    {
      url: qdrantUrl,
      collectionName: "pdf-docs",
      // Qdrant Cloud requires API key for authentication
      ...(qdrantApiKey && { apiKey: qdrantApiKey }),
    }
  );

  console.log("[SERVER] Vector store connection cached");

  // Ensure indexes exist for filtering (Qdrant Cloud requirement)
  await ensureQdrantIndexes(qdrantUrl, qdrantApiKey);

  return cachedVectorStore;
};

/**
 * Ensure Qdrant payload indexes exist for metadata filtering
 * Qdrant Cloud requires indexes to be created before filtering on metadata fields
 */
async function ensureQdrantIndexes(qdrantUrl, qdrantApiKey) {
  try {
    const client = new QdrantClient({
      url: qdrantUrl,
      ...(qdrantApiKey && { apiKey: qdrantApiKey }),
    });

    // Check if collection exists
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(
      (col) => col.name === "pdf-docs"
    );

    if (!collectionExists) {
      console.log(
        "[SERVER] Collection 'pdf-docs' does not exist yet, skipping index creation"
      );
      return;
    }

    // Create index for metadata.userId if it doesn't exist
    try {
      await client.createPayloadIndex("pdf-docs", {
        field_name: "metadata.userId",
        field_schema: "keyword",
      });
      console.log("[SERVER] ✅ Created index for metadata.userId");
    } catch (error) {
      if (error.data?.status?.error?.includes("already exists")) {
        // Index already exists, that's fine
      } else {
        console.warn(
          "[SERVER] ⚠️  Could not create index for metadata.userId:",
          error.message
        );
      }
    }

    // Create index for metadata.pdfId if it doesn't exist
    try {
      await client.createPayloadIndex("pdf-docs", {
        field_name: "metadata.pdfId",
        field_schema: "keyword",
      });
      console.log("[SERVER] ✅ Created index for metadata.pdfId");
    } catch (error) {
      if (error.data?.status?.error?.includes("already exists")) {
        // Index already exists, that's fine
      } else {
        console.warn(
          "[SERVER] ⚠️  Could not create index for metadata.pdfId:",
          error.message
        );
      }
    }
  } catch (error) {
    console.warn(
      "[SERVER] ⚠️  Could not ensure Qdrant indexes:",
      error.message
    );
    // Don't throw - indexes might already exist or collection might not exist yet
  }
}

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
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Added DELETE, PATCH, PUT
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

      // Check upload limit (max 3 PDFs per user)
      const pdfCount = await getUserPDFCount(userId);
      if (pdfCount >= 3) {
        return res.status(400).json({
          error:
            "Upload limit reached. Maximum 3 PDFs per user. Please delete a PDF to upload a new one.",
        });
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

      // Create PDF record in Supabase (status: 'pending')
      const pdfRecord = await createPDFRecord(userId, {
        filename: req.file.originalname,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        fileSize: req.file.size,
      });

      // Enqueue job with Cloudinary URL, userId, and pdfId
      const jobData = {
        userId: userId,
        pdfId: pdfRecord.pdf_id, // Use pdf_id from database record
        databaseId: pdfRecord.id, // Database UUID for status updates
        filename: req.file.originalname,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        // Keep path for backward compatibility, but it's now a Cloudinary URL
        path: cloudinaryResult.secure_url,
      };

      console.log(`[UPLOAD] Queuing job with data:`, {
        userId: jobData.userId,
        pdfId: jobData.pdfId,
        databaseId: jobData.databaseId,
        filename: jobData.filename,
      });

      await queue.add("file-upload-queue", jobData);

      console.log(
        `File uploaded to Cloudinary and queued for processing (user: ${userId}, pdfId: ${pdfRecord.pdf_id})`
      );
      return res.json({
        message: "File uploaded successfully!",
        pdfId: pdfRecord.pdf_id,
        id: pdfRecord.id,
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

    console.log(
      `[CHAT] userId: ${userId}, query: ${userQuery}, pdfIds from query:`,
      pdfIds
    );

    // Validate PDF ownership if pdfIds provided
    let validPDFIds = [];
    if (pdfIds.length > 0) {
      validPDFIds = await validatePDFOwnership(userId, pdfIds);
      console.log(`[CHAT] Validated pdfIds:`, validPDFIds);
      if (validPDFIds.length === 0) {
        return res.status(400).json({
          error:
            "No valid PDFs selected. Please select at least one PDF that belongs to you.",
        });
      }

      // Check if selected PDFs are processed (status = 'completed')
      const userPDFs = await getUserPDFs(userId);
      const selectedPDFs = userPDFs.filter((pdf) =>
        validPDFIds.includes(pdf.pdf_id)
      );
      const unprocessedPDFs = selectedPDFs.filter(
        (pdf) => pdf.upload_status !== "completed"
      );

      if (unprocessedPDFs.length > 0) {
        return res.status(400).json({
          error:
            "Some selected PDFs are still processing. Please wait for processing to complete before chatting.",
        });
      }
    } else {
      // If no pdfIds provided, check if user has any completed PDFs
      const userPDFs = await getUserPDFs(userId);
      const completedPDFs = userPDFs.filter(
        (pdf) => pdf.upload_status === "completed"
      );
      if (completedPDFs.length === 0) {
        return res.status(400).json({
          error:
            "No PDFs are ready for chat. Please upload a PDF and wait for processing to complete.",
        });
      }
    }

    // Get cached vector store (or create if first request)
    const vectorStore = await getVectorStore();

    // Build Qdrant filter
    // NOTE: LangChain stores metadata under "metadata" key in Qdrant payload
    const filter = {
      must: [
        {
          key: "metadata.userId",
          match: {
            value: userId,
          },
        },
      ],
    };

    // Add pdfIds filter if provided and validated
    if (validPDFIds.length > 0) {
      // Use 'value' for single pdfId, 'any' for multiple
      if (validPDFIds.length === 1) {
        filter.must.push({
          key: "metadata.pdfId",
          match: {
            value: validPDFIds[0],
          },
        });
      } else {
        filter.must.push({
          key: "metadata.pdfId",
          match: {
            any: validPDFIds,
          },
        });
      }
    }

    console.log(`[CHAT] Qdrant filter:`, JSON.stringify(filter, null, 2));

    // DEBUG: Test query without filter first to see if any chunks exist
    try {
      const debugRetriever = vectorStore.asRetriever({ k: 1 });
      const debugResult = await debugRetriever.invoke(userQuery);
      console.log(
        `[CHAT] DEBUG - Query without filter: ${
          debugResult?.length || 0
        } chunks found`
      );
      if (debugResult && debugResult.length > 0) {
        console.log(
          `[CHAT] DEBUG - Sample metadata (no filter):`,
          JSON.stringify(debugResult[0]?.metadata || {}, null, 2)
        );
      }
    } catch (debugError) {
      console.error(`[CHAT] DEBUG query error:`, debugError);
    }

    const ret = vectorStore.asRetriever({
      k: 5,
      filter: filter,
    });
    let result = await ret.invoke(userQuery);

    console.log(
      `[CHAT] Qdrant result count (with pdfId filter):`,
      result?.length || 0
    );

    // If no results with pdfId filter, try without pdfId (for legacy PDFs uploaded before pdfId was added)
    // But still filter by userId for security
    if ((!result || result.length === 0) && validPDFIds.length > 0) {
      console.log(
        `[CHAT] No results with pdfId filter, trying userId-only filter for legacy PDFs`
      );
      const legacyFilter = {
        must: [
          {
            key: "metadata.userId",
            match: {
              value: userId,
            },
          },
        ],
      };
      const legacyRet = vectorStore.asRetriever({
        k: 5,
        filter: legacyFilter,
      });
      result = await legacyRet.invoke(userQuery);
      console.log(
        `[CHAT] Qdrant result count (legacy userId-only filter):`,
        result?.length || 0
      );
    }

    if (result && result.length > 0) {
      console.log(
        `[CHAT] First result metadata:`,
        JSON.stringify(result[0]?.metadata || {}, null, 2)
      );
    }

    // Check if we got any results
    if (!result || result.length === 0) {
      // If pdfIds were provided but no results, PDFs might not be processed yet
      if (validPDFIds.length > 0) {
        return res.status(400).json({
          error:
            "No documents found for the selected PDFs. The PDFs might still be processing. Please wait for processing to complete and try again.",
        });
      }
      // If no pdfIds provided, check if user has any PDFs
      const userPDFs = await getUserPDFs(userId);
      if (userPDFs.length === 0) {
        return res.status(400).json({
          error:
            "You don't have any PDFs uploaded yet. Please upload a PDF first.",
        });
      }
      // User has PDFs but no results - might be processing or no matching content
      return res.status(400).json({
        error:
          "No matching content found. The PDFs might still be processing, or your question doesn't match the content. Please wait for processing to complete or try a different question.",
      });
    }

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

// ============================================
// PDF Management Endpoints
// ============================================

// Get user's PDFs list
app.get("/api/pdfs", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const pdfs = await getUserPDFs(userId);
    return res.json(pdfs);
  } catch (error) {
    console.error("Error fetching PDFs:", error);
    return res.status(500).json({ error: "Failed to fetch PDFs" });
  }
});

// Get single PDF by ID
app.get("/api/pdfs/:id", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const pdfId = req.params.id;
    const pdf = await getPDFById(pdfId, userId);

    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    return res.json(pdf);
  } catch (error) {
    console.error("Error fetching PDF:", error);
    return res.status(500).json({ error: "Failed to fetch PDF" });
  }
});

// Toggle PDF active status (for UI selection)
app.patch("/api/pdfs/:id/toggle", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const pdfId = req.params.id;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ error: "is_active must be a boolean" });
    }

    const pdf = await togglePDFActive(pdfId, userId, is_active);
    return res.json(pdf);
  } catch (error) {
    console.error("Error toggling PDF status:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to toggle PDF status" });
  }
});

// Delete PDF (hard delete - removes from Qdrant, Cloudinary, and Supabase)
app.delete("/api/pdfs/:id", requireAuth(), async (req, res) => {
  console.log(`[DELETE] Request received:`, {
    method: req.method,
    url: req.url,
    params: req.params,
    headers: {
      authorization: req.headers.authorization ? "present" : "missing",
    },
  });

  try {
    const userId = req.auth.userId;
    console.log(`[DELETE] Extracted userId:`, userId);
    if (!userId) {
      console.error(`[DELETE] No userId found in auth`);
      return res.status(401).json({ error: "Authentication required" });
    }

    const pdfId = req.params.id;
    console.log(`[DELETE] pdfId=${pdfId}, userId=${userId}`);

    // Get PDF record to get pdfId and cloudinaryPublicId
    const pdf = await getPDFById(pdfId, userId);
    if (!pdf) {
      console.log(`PDF not found: pdfId=${pdfId}, userId=${userId}`);
      return res.status(404).json({ error: "PDF not found" });
    }

    console.log(`Deleting PDF: ${pdf.filename} (pdf_id: ${pdf.pdf_id})`);

    // Delete from Qdrant (filter: userId + pdfId)
    try {
      const qdrantUrl = process.env.QDRANT_URL;
      const qdrantApiKey = process.env.QDRANT_API_KEY;

      if (qdrantUrl) {
        const qdrantClient = new QdrantClient({
          url: qdrantUrl,
          ...(qdrantApiKey && { apiKey: qdrantApiKey }),
        });

        // Delete all points matching userId and pdfId
        const deleteFilter = {
          must: [
            {
              key: "metadata.userId",
              match: {
                value: userId,
              },
            },
            {
              key: "metadata.pdfId",
              match: {
                value: pdf.pdf_id,
              },
            },
          ],
        };

        // Scroll to get all point IDs matching the filter
        const scrollResult = await qdrantClient.scroll("pdf-docs", {
          filter: deleteFilter,
          limit: 10000, // Large limit to get all points
          with_payload: false,
          with_vector: false,
        });

        if (scrollResult.points && scrollResult.points.length > 0) {
          const pointIds = scrollResult.points.map((point) => point.id);
          console.log(
            `[DELETE] Found ${pointIds.length} vectors to delete from Qdrant`
          );

          // Delete the points
          await qdrantClient.delete("pdf-docs", {
            wait: true,
            points: pointIds,
          });

          console.log(
            `[DELETE] Deleted ${pointIds.length} vectors from Qdrant`
          );
        } else {
          console.log(
            `[DELETE] No vectors found in Qdrant for pdfId: ${pdf.pdf_id}`
          );
        }
      }
    } catch (error) {
      console.warn(
        "[DELETE] Error deleting from Qdrant (continuing):",
        error.message
      );
      // Continue even if Qdrant deletion fails - we still want to delete from other services
    }

    // Delete from Cloudinary
    const { deleteFromCloudinary } = await import("./services/cloudinary.js");
    try {
      await deleteFromCloudinary(pdf.cloudinary_public_id, userId);
      console.log(`Deleted from Cloudinary: ${pdf.cloudinary_public_id}`);
    } catch (error) {
      console.warn("Error deleting from Cloudinary (continuing):", error);
      // Continue even if Cloudinary deletion fails
    }

    // Delete from Supabase
    await deletePDFRecord(pdfId, userId);
    console.log(`Deleted from Supabase: pdfId=${pdfId}`);

    return res.json({
      message: "PDF deleted successfully",
      id: pdfId,
    });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    console.error("Error stack:", error.stack);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: "Failed to delete PDF",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
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
