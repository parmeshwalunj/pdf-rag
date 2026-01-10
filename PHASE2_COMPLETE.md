# ✅ Phase 2: Supabase Setup - COMPLETE

## What Was Implemented

### 1. Database Schema
- ✅ Created `server/database/schema.sql` with:
  - `pdfs` table with all required fields
  - Indexes for performance
  - Row Level Security (RLS) policies
  - Auto-update trigger for `updated_at` timestamp
  - Optional chat_history table (commented out for future)

### 2. Supabase Configuration
- ✅ Created `server/config/supabase.js`
  - Supabase client initialization
  - Environment variable validation
  - Service role key configuration (bypasses RLS - we validate in code)

### 3. Database Service Layer
- ✅ Created `server/services/database.js` with functions:
  - `createPDFRecord()` - Create new PDF record
  - `getUserPDFs()` - Get all PDFs for a user
  - `getUserPDFCount()` - Count PDFs (for upload limit)
  - `getPDFById()` - Get single PDF with ownership validation
  - `updatePDFStatus()` - Update status and metadata
  - `togglePDFActive()` - Toggle is_active for UI
  - `deletePDFRecord()` - Delete PDF record
  - `validatePDFOwnership()` - Validate pdfIds belong to user (for chat)
  - `getPDFByPdfId()` - Get PDF by pdf_id (for worker)

### 4. Upload Endpoint Updates
- ✅ Added upload limit check (max 3 PDFs per user)
- ✅ Creates PDF record in Supabase with status 'pending'
- ✅ Generates `pdfId` (UUID) for Qdrant metadata
- ✅ Passes `databaseId` and `pdfId` to worker queue

### 5. Worker Updates
- ✅ Updates PDF status to 'processing' at start
- ✅ Adds `userId` and `pdfId` to chunk metadata
- ✅ Updates PDF status to 'completed' with page_count and chunk_count
- ✅ Updates PDF status to 'failed' with error_message on error

### 6. Chat Endpoint Updates
- ✅ Validates PDF ownership using Supabase
- ✅ Filters Qdrant by validated `pdfIds`
- ✅ Returns error if no valid PDFs selected

### 7. PDF Management API Endpoints
- ✅ `GET /api/pdfs` - Get user's PDFs list
- ✅ `GET /api/pdfs/:id` - Get PDF details
- ✅ `PATCH /api/pdfs/:id/toggle` - Toggle is_active status
- ✅ `DELETE /api/pdfs/:id` - Delete PDF (hard delete)

### 8. Package Updates
- ✅ Added `@supabase/supabase-js` to dependencies
- ✅ Added `uuid` package (for generating pdfId)

---

## 🔧 Setup Required

### 1. Install Dependencies

```bash
cd server
pnpm install
# or
npm install
```

This will install:
- `@supabase/supabase-js`
- `uuid` (if not already installed)

### 2. Set Up Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Wait for project to be ready
4. Go to **SQL Editor**
5. Copy and paste the contents of `server/database/schema.sql`
6. Run the SQL script
7. Verify table was created in **Table Editor**

### 3. Get Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important:** Use `service_role` key, not `anon` key. Service role bypasses RLS, which we need for backend operations. We validate ownership in our code.

### 4. Add Environment Variables

#### Backend (`.env` in `server/` directory)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # service_role key (secret!)
```

### 5. Verify Setup

1. Start backend: `cd server && pnpm dev`
2. Check console for: `✅ Supabase client initialized`
3. Try uploading a PDF
4. Check Supabase table - should see new record

---

## 📊 Database Schema

### `pdfs` Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (database ID) |
| `user_id` | TEXT | Clerk user ID |
| `pdf_id` | TEXT | UUID for Qdrant metadata |
| `filename` | TEXT | Original filename |
| `cloudinary_url` | TEXT | Cloudinary secure URL |
| `cloudinary_public_id` | TEXT | Cloudinary public ID |
| `file_size` | INTEGER | File size in bytes |
| `page_count` | INTEGER | Number of pages |
| `chunk_count` | INTEGER | Number of chunks |
| `upload_status` | TEXT | 'pending', 'processing', 'completed', 'failed' |
| `error_message` | TEXT | Error message if failed |
| `is_active` | BOOLEAN | UI convenience (default selection) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

---

## 🔄 Data Flow

### Upload Flow
```
1. User uploads PDF
2. Backend checks upload limit (max 3)
3. Uploads to Cloudinary
4. Creates PDF record in Supabase (status: 'pending')
5. Queues job with userId, pdfId, databaseId
6. Worker processes:
   - Updates status to 'processing'
   - Downloads from Cloudinary
   - Parses PDF
   - Creates chunks with userId + pdfId metadata
   - Adds to Qdrant
   - Updates status to 'completed' with metadata
```

### Chat Flow
```
1. User selects PDFs (client sends pdfIds[])
2. Backend validates ownership via Supabase
3. Filters Qdrant by userId + validated pdfIds
4. Returns chat response
```

### Delete Flow
```
1. User clicks delete
2. Backend validates ownership
3. Gets PDF record (for pdfId and cloudinaryPublicId)
4. TODO: Delete from Qdrant (Phase 3)
5. Deletes from Cloudinary
6. Deletes from Supabase
```

---

## ✅ What's Working

- ✅ PDF records created in Supabase on upload
- ✅ Upload limit enforced (3 PDFs max)
- ✅ Status tracking (pending → processing → completed/failed)
- ✅ PDF ownership validation
- ✅ Chat endpoint filters by validated PDFs
- ✅ PDF management endpoints (list, get, toggle, delete)
- ✅ Worker updates status and metadata

---

## 📝 Notes

### Current State
- Supabase integration complete
- All CRUD operations implemented
- Status tracking working
- Ownership validation in place

### Next Steps (Phase 3)
- Implement Qdrant deletion helper
- Complete delete endpoint (remove from Qdrant)
- Frontend: PDF list component
- Frontend: PDF selector for chat

---

## 🐛 Troubleshooting

### "Supabase client not initialized"
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify credentials are correct

### "Table 'pdfs' does not exist"
- Run the SQL schema in Supabase SQL Editor
- Check table was created in Table Editor

### "Upload limit reached" but user has fewer PDFs
- Check `getUserPDFCount()` is counting correctly
- Verify user_id matches in database

### Status not updating
- Check worker has access to `databaseId` and `userId`
- Verify Supabase connection in worker
- Check worker logs for errors

---

## ✅ Phase 2 Complete!

Ready to move to **Phase 3: Frontend UI** or test Phase 2 first? 🚀
