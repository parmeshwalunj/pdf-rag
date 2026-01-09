/**
 * Cloudinary Service
 * Handles file uploads to Cloudinary
 */
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, "../.env") });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a PDF file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID for folder organization
 * @returns {Promise<{url: string, public_id: string, secure_url: string}>}
 */
export async function uploadPDFToCloudinary(fileBuffer, originalName, userId) {
  // Security: userId is required - no fallback to shared folder
  if (!userId) {
    throw new Error("userId is required for file upload");
  }

  return new Promise((resolve, reject) => {
    // Create a unique folder name for organization by userId
    const folder = `pdf-rag/${userId}/uploads`;

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const publicId = `${folder}/${uniqueSuffix}-${sanitizedName}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || "pdf-rag", // Use your upload preset
        resource_type: "raw", // PDFs are treated as raw files
        folder: folder,
        public_id: publicId.split("/").pop(), // Just the filename without folder
        format: "pdf",
        // Note: upload preset settings (overwrite, use_filename, unique_filename, access_mode, type)
        // are handled by the preset, but we can override if needed
        access_mode: "public", // Ensure file is public
        type: "upload", // Ensure it's an uploaded file (not private)
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(new Error(`Failed to upload to Cloudinary: ${error.message}`));
        } else {
          console.log("File uploaded to Cloudinary:", result.secure_url);
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            secure_url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
          });
        }
      }
    );

    // Upload the buffer
    uploadStream.end(fileBuffer);
  });
}

/**
 * Download a file from Cloudinary
 * @param {string} cloudinaryUrlOrPublicId - Cloudinary secure URL or public_id
 * @returns {Promise<Buffer>} - File buffer
 */
export async function downloadFromCloudinary(cloudinaryUrlOrPublicId) {
  try {
    let downloadUrl = cloudinaryUrlOrPublicId;

    // Check if it's a URL or just a public_id
    if (!cloudinaryUrlOrPublicId.startsWith("http")) {
      // It's a public_id, construct the URL
      console.log("Constructing URL from public_id:", cloudinaryUrlOrPublicId);
      downloadUrl = cloudinary.url(cloudinaryUrlOrPublicId, {
        resource_type: "raw",
        secure: true,
        sign_url: false, // Files are public
      });
      console.log("Constructed URL:", downloadUrl);
    }

    // Use the secure URL directly - it should be publicly accessible
    // With your upload preset (access mode: public), files should be accessible
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      // If unauthorized, the file might still be private
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `File is not publicly accessible. Check Cloudinary settings: ` +
            `Settings > Security > Allow unsigned uploading, or make the file public in Media Library.`
        );
      }
      throw new Error(
        `Failed to download from Cloudinary: ${response.statusText} (${response.status})`
      );
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error("Error downloading from Cloudinary:", error);
    throw error;
  }
}

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} userId - User ID for ownership validation (optional for now, required in Phase 2)
 * @returns {Promise<{result: string}>} - Deletion result
 * @throws {Error} - If deletion fails or ownership validation fails
 */
export async function deleteFromCloudinary(publicId, userId = null) {
  // Security: Validate publicId format
  if (!publicId || typeof publicId !== "string") {
    throw new Error("Invalid publicId: must be a non-empty string");
  }

  // Security: If userId provided, validate the publicId belongs to that user
  // This prevents users from deleting files they don't own
  if (userId) {
    // Check if publicId contains the userId in the path
    // Cloudinary publicId format: "pdf-rag/{userId}/uploads/filename"
    const expectedPath = `pdf-rag/${userId}/`;
    if (!publicId.startsWith(expectedPath)) {
      throw new Error(
        `Security violation: publicId does not belong to user ${userId}`
      );
    }
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });

    // Check if deletion was successful
    if (result.result === "not found") {
      console.warn(`File not found in Cloudinary: ${publicId}`);
      // Don't throw - file might already be deleted (idempotent operation)
      return result;
    }

    if (result.result !== "ok") {
      throw new Error(
        `Failed to delete file from Cloudinary: ${result.result}`
      );
    }

    console.log(`Successfully deleted file from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    // Re-throw with more context
    if (error.message.includes("Security violation")) {
      throw error; // Security errors should be thrown as-is
    }
    throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
  }
}

export default cloudinary;
