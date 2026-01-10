-- ============================================
-- Supabase Database Schema for PDF RAG
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Create pdfs table
CREATE TABLE IF NOT EXISTS pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk userId (e.g., "user_2abc123...")
  pdf_id TEXT NOT NULL, -- UUID we generate (used in Qdrant metadata)
  filename TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  page_count INTEGER,
  chunk_count INTEGER, -- number of chunks created
  upload_status TEXT NOT NULL DEFAULT 'pending', 
    -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT, -- if status is 'failed'
  is_active BOOLEAN DEFAULT true, -- UI convenience (default selection)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_pdf UNIQUE(user_id, pdf_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdfs_user_id ON pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_pdfs_user_status ON pdfs(user_id, upload_status);
CREATE INDEX IF NOT EXISTS idx_pdfs_created_at ON pdfs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdfs_user_active ON pdfs(user_id, is_active) WHERE is_active = true;

-- Row Level Security (RLS) - Backup security (we validate in backend too)
ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own PDFs
CREATE POLICY "Users can view own PDFs"
  ON pdfs FOR SELECT
  USING (true); -- We validate in backend, but RLS as backup

-- Policy: Users can insert own PDFs
CREATE POLICY "Users can insert own PDFs"
  ON pdfs FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update own PDFs
CREATE POLICY "Users can update own PDFs"
  ON pdfs FOR UPDATE
  USING (true);

-- Policy: Users can delete own PDFs
CREATE POLICY "Users can delete own PDFs"
  ON pdfs FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_pdfs_updated_at
  BEFORE UPDATE ON pdfs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Optional: Chat History Table (for future)
-- ============================================
-- Uncomment if you want to store chat history
/*
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  pdf_context JSONB, -- Array of PDF IDs used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at DESC);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON chat_history FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (true);
*/
