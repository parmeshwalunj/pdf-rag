/**
 * Database Service Layer
 * Handles all Supabase database operations for PDFs
 */

import supabase from "../config/supabase.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new PDF record in the database
 * @param {string} userId - Clerk user ID
 * @param {Object} pdfData - PDF metadata
 * @param {string} pdfData.filename - Original filename
 * @param {string} pdfData.cloudinaryUrl - Cloudinary secure URL
 * @param {string} pdfData.cloudinaryPublicId - Cloudinary public ID
 * @param {number} pdfData.fileSize - File size in bytes
 * @returns {Promise<{id, pdf_id, ...}>} - Created PDF record
 */
export async function createPDFRecord(userId, pdfData) {
  const pdfId = uuidv4(); // Generate UUID for pdfId

  const { data, error } = await supabase
    .from("pdfs")
    .insert({
      user_id: userId,
      pdf_id: pdfId,
      filename: pdfData.filename,
      cloudinary_url: pdfData.cloudinaryUrl,
      cloudinary_public_id: pdfData.cloudinaryPublicId,
      file_size: pdfData.fileSize,
      upload_status: "pending",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating PDF record:", error);
    throw new Error(`Failed to create PDF record: ${error.message}`);
  }

  console.log(`PDF record created: ${data.id} (pdf_id: ${pdfId})`);
  return data;
}

/**
 * Get all PDFs for a user
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Array>} - Array of PDF records
 */
export async function getUserPDFs(userId) {
  const { data, error } = await supabase
    .from("pdfs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user PDFs:", error);
    throw new Error(`Failed to fetch PDFs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get PDF count for a user (for upload limit check)
 * @param {string} userId - Clerk user ID
 * @returns {Promise<number>} - Number of PDFs
 */
export async function getUserPDFCount(userId) {
  const { count, error } = await supabase
    .from("pdfs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("Error counting user PDFs:", error);
    throw new Error(`Failed to count PDFs: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get a single PDF by ID
 * @param {string} pdfId - PDF UUID (from database)
 * @param {string} userId - Clerk user ID (for ownership validation)
 * @returns {Promise<Object>} - PDF record
 */
export async function getPDFById(pdfId, userId) {
  const { data, error } = await supabase
    .from("pdfs")
    .select("*")
    .eq("id", pdfId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching PDF:", error);
    throw new Error(`Failed to fetch PDF: ${error.message}`);
  }

  return data;
}

/**
 * Update PDF status and metadata
 * @param {string} pdfId - PDF UUID (from database)
 * @param {string} userId - Clerk user ID (for ownership validation)
 * @param {Object} updates - Fields to update
 * @param {string} updates.upload_status - Status: 'pending', 'processing', 'completed', 'failed'
 * @param {number} updates.page_count - Number of pages
 * @param {number} updates.chunk_count - Number of chunks
 * @param {string} updates.error_message - Error message if failed
 * @returns {Promise<Object>} - Updated PDF record
 */
export async function updatePDFStatus(pdfId, userId, updates) {
  const { data, error } = await supabase
    .from("pdfs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pdfId)
    .eq("user_id", userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    console.error("Error updating PDF status:", error);
    throw new Error(`Failed to update PDF status: ${error.message}`);
  }

  if (!data) {
    throw new Error("PDF not found or access denied");
  }

  return data;
}

/**
 * Toggle PDF active status (for UI selection)
 * @param {string} pdfId - PDF UUID (from database)
 * @param {string} userId - Clerk user ID (for ownership validation)
 * @param {boolean} isActive - New active status
 * @returns {Promise<Object>} - Updated PDF record
 */
export async function togglePDFActive(pdfId, userId, isActive) {
  const { data, error } = await supabase
    .from("pdfs")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pdfId)
    .eq("user_id", userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    console.error("Error toggling PDF active status:", error);
    throw new Error(`Failed to toggle PDF status: ${error.message}`);
  }

  if (!data) {
    throw new Error("PDF not found or access denied");
  }

  return data;
}

/**
 * Delete a PDF record from the database
 * @param {string} pdfId - PDF UUID (from database)
 * @param {string} userId - Clerk user ID (for ownership validation)
 * @returns {Promise<boolean>} - True if deleted
 */
export async function deletePDFRecord(pdfId, userId) {
  const { error } = await supabase
    .from("pdfs")
    .delete()
    .eq("id", pdfId)
    .eq("user_id", userId); // Ensure ownership

  if (error) {
    console.error("Error deleting PDF record:", error);
    throw new Error(`Failed to delete PDF record: ${error.message}`);
  }

  return true;
}

/**
 * Validate PDF ownership - check if pdfIds belong to userId
 * Used for chat endpoint to validate selected PDFs
 * @param {string} userId - Clerk user ID
 * @param {Array<string>} pdfIds - Array of pdf_id values (not database IDs)
 * @returns {Promise<Array<string>>} - Array of valid pdfIds
 */
export async function validatePDFOwnership(userId, pdfIds) {
  if (!pdfIds || pdfIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("pdfs")
    .select("pdf_id")
    .eq("user_id", userId)
    .in("pdf_id", pdfIds);

  if (error) {
    console.error("Error validating PDF ownership:", error);
    throw new Error(`Failed to validate PDF ownership: ${error.message}`);
  }

  const validPDFIds = (data || []).map((pdf) => pdf.pdf_id);

  // Log rejected PDFs for security audit
  if (validPDFIds.length < pdfIds.length) {
    const rejected = pdfIds.filter((id) => !validPDFIds.includes(id));
    console.warn(
      `User ${userId} attempted to access unauthorized PDFs:`,
      rejected
    );
  }

  return validPDFIds;
}

/**
 * Get PDF by pdf_id (used in worker)
 * @param {string} pdfId - pdf_id value (not database ID)
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Object>} - PDF record
 */
export async function getPDFByPdfId(pdfId, userId) {
  const { data, error } = await supabase
    .from("pdfs")
    .select("*")
    .eq("pdf_id", pdfId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching PDF by pdf_id:", error);
    throw new Error(`Failed to fetch PDF: ${error.message}`);
  }

  return data;
}
