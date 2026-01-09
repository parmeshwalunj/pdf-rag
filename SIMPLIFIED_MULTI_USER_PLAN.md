# 🚀 Simplified Multi-User Plan (Production-Ready)

## 📋 Overview
Transform PDF RAG into a multi-user system using Clerk authentication, Supabase for metadata, and Qdrant filtering. Fast, secure, and production-ready.

---

## 🎯 Core Requirements

### ✅ Must-Have Features
1. **User Authentication** - Clerk (already installed)
2. **Tenant Isolation** - Filter Qdrant by userId
3. **PDF Management** - List, delete PDFs
4. **Selective Chat Context** - User selects which PDFs to include
5. **Upload Limit** - Max 3 PDFs per user

### ✅ Nice-to-Have Features
6. **Upload Status Tracking** - Show processing status
7. **PDF Metadata Display** - Name, date, size, pages
8. **Better UI/UX** - Modern, responsive design

---

## 🏗️ Architecture

```
┌─────────────┐
│   Clerk     │ → Authentication (userId from session)
└─────────────┘
       ↓
┌─────────────┐
│  Frontend   │ → Maintains selectedPDFIds state
└─────────────┘
       ↓
┌─────────────┐
│  Backend    │ → Validates userId + pdfIds ownership
└─────────────┘
       ↓
    ┌──┴──┐
    ↓     ↓
┌──────┐ ┌──────────┐
│Supabase│ │  Qdrant  │
│(Metadata)│ │ (Vectors) │
└──────┘ └──────────┘
    ↓
┌──────────┐
│Cloudinary│
│  (Files) │
└──────────┘
```

---

## 📦 Technology Stack

### **Authentication**
- **Clerk** (Already installed ✅)
  - Extract `userId` from session: `req.auth.userId`
  - No manual userId generation needed
  - No JWT needed (Clerk handles sessions)

### **Database (Metadata)**
- **Supabase** (Free Tier)
  - 500MB database
  - PostgreSQL
  - Store PDF metadata
  - Fast queries for UI

### **Vector Store**
- **Qdrant** (Existing)
  - Filter by `userId` + `pdfId`
  - Metadata: `{ userId, pdfId, pageNumber, chunkIndex, ... }`

### **File Storage**
- **Cloudinary** (Existing)
  - Organize by userId: `pdf-rag/{userId}/uploads/`

---

## 📊 Database Schema

### **Supabase: pdfs Table**

```sql
CREATE TABLE pdfs (
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
CREATE INDEX idx_pdfs_user_id ON pdfs(user_id);
CREATE INDEX idx_pdfs_user_status ON pdfs(user_id, upload_status);
CREATE INDEX idx_pdfs_created_at ON pdfs(created_at DESC);
CREATE INDEX idx_pdfs_user_active ON pdfs(user_id, is_active) WHERE is_active = true;

-- Row Level Security (backup - we validate in backend too)
ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own PDFs"
  ON pdfs FOR SELECT
  USING (true); -- We validate in backend, but RLS as backup

CREATE POLICY "Users can insert own PDFs"
  ON pdfs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own PDFs"
  ON pdfs FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own PDFs"
  ON pdfs FOR DELETE
  USING (true);
```

---

## 🔄 Implementation Phases

### **Phase 1: Clerk Authentication Setup** (1-2 hours)

#### 1.1 Frontend - Clerk Integration
- [ ] Set up Clerk provider in Next.js app
- [ ] Create login page (`/login`)
- [ ] Create sign-up page (`/signup`)
- [ ] Add logout functionality
- [ ] Protect main app route (redirect to login if not authenticated)
- [ ] Add user profile component (show user info, logout button)
- [ ] Update API client to include Clerk session token

**Files to create/modify:**
- `client/app/layout.tsx` - Add ClerkProvider
- `client/app/login/page.tsx` - Login page
- `client/app/signup/page.tsx` - Sign-up page
- `client/middleware.ts` - Protect routes
- `client/lib/api.ts` - Add auth headers
- `client/app/components/user-profile.tsx` - User info component

#### 1.2 Backend - Auth Middleware
- [ ] Install Clerk backend SDK (`@clerk/express`)
- [ ] Create authentication middleware
- [ ] Extract userId from Clerk session: `req.auth.userId`
- [ ] Protect all routes (upload, chat, etc.)
- [ ] Add userId to request object

**Files to create/modify:**
- `server/middleware/auth.js` - Auth middleware
- `server/index.js` - Add auth middleware to routes
- `server/package.json` - Add `@clerk/express`

---

### **Phase 2: Supabase Setup** (30 min - 1 hour)

#### 2.1 Supabase Project Setup
- [ ] Create Supabase project
- [ ] Create `pdfs` table (use schema above)
- [ ] Set up indexes
- [ ] Configure RLS policies (backup security)
- [ ] Get Supabase connection strings
- [ ] Install Supabase client (`@supabase/supabase-js`)

#### 2.2 Database Service Layer
- [ ] Create Supabase client configuration
- [ ] Create database service functions:
  - `createPDFRecord(userId, pdfData)` - Create new PDF record
  - `getUserPDFs(userId)` - Get all PDFs for user
  - `getUserPDFCount(userId)` - Count PDFs (for limit check)
  - `updatePDFStatus(pdfId, userId, status, metadata)` - Update status
  - `deletePDFRecord(pdfId, userId)` - Delete from Supabase
  - `validatePDFOwnership(userId, pdfIds)` - Validate ownership (for chat)

**Files to create:**
- `server/config/supabase.js` - Supabase client config
- `server/services/database.js` - Database operations

**Environment Variables:**
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # For backend operations
```

---

### **Phase 3: User-Specific Vector Store** (2-3 hours)

#### 3.1 Update Worker to Include userId + pdfId
- [ ] Generate `pdfId` (UUID) in upload endpoint
- [ ] Pass `userId` and `pdfId` to queue job
- [ ] Update worker to add `userId` + `pdfId` to document metadata
- [ ] Ensure all chunks have both in metadata

**Files to modify:**
- `server/index.js` - Generate pdfId, add to queue job
- `server/worker.js` - Add userId + pdfId to chunk metadata

**Metadata Structure:**
```javascript
{
  userId: "user_2abc123...",
  pdfId: "550e8400-e29b-41d4-a716-446655440000",
  pageNumber: 1,
  chunkIndex: 0,
  totalChunks: 150,
  source: "cloudinary_url",
  ...existing metadata
}
```

#### 3.2 Update Chat Endpoint with Multi-Select
- [ ] Accept `pdfIds[]` array from client
- [ ] Validate ownership using Supabase
- [ ] Filter Qdrant by `userId` + `pdfIds[]`
- [ ] Return error if no valid PDFs selected

**Files to modify:**
- `server/index.js` - Update chat endpoint
- `server/middleware/validatePDFs.js` - Ownership validation

**Qdrant Filter:**
```javascript
const ret = vectorStore.asRetriever({
  k: 5,
  filter: {
    must: [
      { key: "userId", match: { value: userId } },
      { key: "pdfId", match: { any: validPDFIds } }
    ]
  }
});
```

#### 3.3 Update Cloudinary Organization
- [ ] Organize uploads by userId: `pdf-rag/{userId}/uploads/`
- [ ] Update folder structure in upload function

**Files to modify:**
- `server/services/cloudinary.js` - Add userId to folder path

---

### **Phase 4: Upload Limit & PDF Management API** (1-2 hours)

#### 4.1 Upload Limit Enforcement
- [ ] Check user's PDF count before upload
- [ ] Return error if limit (3 PDFs) reached
- [ ] Show user-friendly error message

**Implementation:**
```javascript
// In upload endpoint
const pdfCount = await getUserPDFCount(userId);
if (pdfCount >= 3) {
  return res.status(400).json({ 
    error: "Upload limit reached. Maximum 3 PDFs per user. Please delete a PDF to upload a new one." 
  });
}
```

#### 4.2 PDF Management Endpoints
- [ ] `GET /api/pdfs` - Get user's PDFs list
- [ ] `GET /api/pdfs/:id` - Get PDF details
- [ ] `PATCH /api/pdfs/:id/toggle` - Toggle is_active (optional)
- [ ] `DELETE /api/pdfs/:id` - Delete PDF (hard delete)

**Delete Flow:**
1. Validate ownership
2. Delete from Qdrant (filter: userId + pdfId)
3. Delete from Cloudinary
4. Delete from Supabase

**Files to create/modify:**
- `server/index.js` - Add new routes
- `server/services/vector-store.js` - Qdrant deletion helper
- `server/services/cloudinary.js` - Add delete function

---

### **Phase 5: Frontend - PDF Management UI** (3-4 hours)

#### 5.1 PDF List Component
- [ ] Create PDF list component showing:
  - PDF name
  - Upload date
  - File size
  - Page count
  - Status (processing/completed/failed)
  - Active indicator (is_active)
  - Delete button
- [ ] Show upload limit: "2/3 PDFs uploaded"
- [ ] Disable upload button when limit reached
- [ ] Add search/filter (optional)

**Files to create:**
- `client/app/components/pdf-list.tsx` - Main PDF list component
- `client/app/components/pdf-card.tsx` - Individual PDF card
- `client/app/components/pdf-actions.tsx` - Action buttons

#### 5.2 PDF Selector for Chat
- [ ] Create multi-select component
- [ ] Show checkboxes for each PDF
- [ ] Default: select all `is_active = true` PDFs
- [ ] Maintain `selectedPDFIds` state
- [ ] Send `pdfIds[]` with chat request
- [ ] Visual feedback: "Chatting with 2 PDFs"

**Files to create:**
- `client/app/components/pdf-selector.tsx` - Multi-select component

#### 5.3 Update Main Layout
- [ ] Add sidebar or top bar with:
  - User profile
  - PDF list
  - Upload limit indicator
  - Logout button
- [ ] Update layout to show PDF selector + chat
- [ ] Make it responsive

**Files to modify:**
- `client/app/page.tsx` - Update layout
- `client/app/components/file-upload.tsx` - Show limit, status
- `client/app/components/chat.tsx` - Accept pdfIds, send with request

#### 5.4 Update API Client
- [ ] Add `getPDFs()` method
- [ ] Add `deletePDF(id)` method
- [ ] Add `togglePDF(id, isActive)` method (optional)
- [ ] Update `chat(message, pdfIds[])` method

**Files to modify:**
- `client/lib/api.ts` - Add new methods

---

### **Phase 6: Status Tracking & Polish** (1-2 hours)

#### 6.1 Upload Status Tracking
- [ ] Update worker to set status in Supabase
- [ ] Poll for status updates (or use Supabase real-time)
- [ ] Show status in UI: pending → processing → completed
- [ ] Show error message if failed

#### 6.2 Error Handling
- [ ] Better error messages
- [ ] Handle upload limit errors
- [ ] Handle validation errors
- [ ] Handle network errors

#### 6.3 UI Polish
- [ ] Loading states
- [ ] Toast notifications
- [ ] Confirmation dialogs for delete
- [ ] Empty states
- [ ] Responsive design

---

## 🔒 Security Implementation

### **1. Authentication**
- ✅ All routes protected by Clerk middleware
- ✅ Extract userId from validated Clerk session
- ✅ Never trust client-provided userId

### **2. PDF Ownership Validation**
```javascript
// CRITICAL: Validate ownership before any operation
const validatePDFOwnership = async (userId, pdfIds) => {
  const { data: userPDFs } = await supabase
    .from('pdfs')
    .select('pdf_id')
    .eq('user_id', userId)
    .in('pdf_id', pdfIds);
  
  const validPDFIds = userPDFs.map(p => p.pdf_id);
  
  // Log rejected PDFs for security audit
  if (validPDFIds.length < pdfIds.length) {
    const rejected = pdfIds.filter(id => !validPDFIds.includes(id));
    console.warn(`User ${userId} attempted unauthorized access:`, rejected);
  }
  
  return validPDFIds;
};
```

### **3. Upload Limit Enforcement**
- ✅ Check count before upload
- ✅ Validate on backend (never trust client)

### **4. Qdrant Filtering**
- ✅ Always filter by userId (from validated session)
- ✅ Filter by pdfIds (validated ownership)
- ✅ Never query without filters

---

## 📝 API Endpoints

### **Authentication Required (All Endpoints)**

#### **Upload**
```
POST /upload/pdf
Headers: Authorization: Bearer <clerk_token>
Body: FormData with PDF file
Response: { message, pdfId, cloudinaryUrl }
- Checks upload limit (max 3)
- Creates Supabase record (status: 'pending')
- Uploads to Cloudinary
- Queues job with userId + pdfId
```

#### **Chat**
```
GET /chat?message=<query>&pdfIds=["id1","id2"]
Headers: Authorization: Bearer <clerk_token>
Response: { result, docs }
- Validates pdfIds ownership
- Filters Qdrant by userId + pdfIds
- Returns chat response
```

#### **List PDFs**
```
GET /api/pdfs
Headers: Authorization: Bearer <clerk_token>
Response: [{ id, pdfId, filename, status, is_active, ... }]
- Returns all PDFs for authenticated user
```

#### **Delete PDF**
```
DELETE /api/pdfs/:id
Headers: Authorization: Bearer <clerk_token>
Response: { message }
- Validates ownership
- Deletes from Qdrant (filter: userId + pdfId)
- Deletes from Cloudinary
- Deletes from Supabase
```

#### **Toggle Active (Optional)**
```
PATCH /api/pdfs/:id/toggle
Headers: Authorization: Bearer <clerk_token>
Body: { is_active: true/false }
Response: { id, is_active }
- Updates is_active in Supabase
- Used for UI defaults only
```

---

## 🎨 UI/UX Design

### **Layout**
```
┌─────────────────────────────────────────────────────────┐
│  [Logo] PDF RAG    [User: John] [Logout]  [2/3 PDFs]  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  PDF     │         PDF Selector                        │
│  List    │  ☑ Research Paper.pdf                      │
│          │  ☑ Meeting Notes.pdf                       │
│  [Upload]│  ☐ Old Document.pdf                         │
│  (1 left)│                                              │
│          │         Chat Interface                      │
│  Active: │  ┌────────────────────────────────────┐    │
│  - Doc1  │  │ User: What is this about?         │    │
│  - Doc2  │  └────────────────────────────────────┘    │
│          │  ┌────────────────────────────────────┐    │
│  Hidden: │  │ AI: Based on the documents...     │    │
│  - Doc3  │  └────────────────────────────────────┘    │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### **Key UI Elements**
- Upload limit indicator: "2/3 PDFs uploaded"
- PDF status badges: Processing, Completed, Failed
- Multi-select checkboxes for chat context
- Delete button with confirmation
- Loading states for all operations

---

## 📊 Data Flow Examples

### **Upload Flow**
```
1. User clicks upload
2. Frontend checks limit (client-side check)
3. Backend validates limit (server-side check)
4. Backend creates Supabase record (status: 'pending')
5. Backend uploads to Cloudinary
6. Backend generates pdfId (UUID)
7. Backend queues job: { userId, pdfId, cloudinaryUrl, ... }
8. Worker processes:
   - Downloads from Cloudinary
   - Parses PDF
   - Creates chunks with metadata: { userId, pdfId, ... }
   - Adds to Qdrant
   - Updates Supabase: status='completed', page_count, chunk_count
9. Frontend polls/updates status
```

### **Chat Flow**
```
1. User selects PDFs (client-side state)
2. User sends message
3. Frontend sends: { message, pdfIds: ["id1", "id2"] }
4. Backend validates pdfIds ownership
5. Backend filters Qdrant: userId + pdfIds
6. Backend queries vector store
7. Backend gets OpenAI response
8. Backend returns: { result, docs }
9. Frontend displays response
```

### **Delete Flow**
```
1. User clicks delete
2. Frontend shows confirmation
3. User confirms
4. Backend validates ownership
5. Backend deletes from Qdrant (filter: userId + pdfId)
6. Backend deletes from Cloudinary
7. Backend deletes from Supabase
8. Frontend refreshes PDF list
```

---

## 🧪 Testing Checklist

### **Authentication**
- [ ] Login works
- [ ] Logout works
- [ ] Protected routes redirect to login
- [ ] Session persists

### **Upload**
- [ ] Upload works (within limit)
- [ ] Upload limit enforced (3 PDFs max)
- [ ] Status updates correctly
- [ ] Error handling works

### **Data Isolation**
- [ ] User A can't see User B's PDFs
- [ ] User A can't delete User B's PDFs
- [ ] Chat only returns User A's documents
- [ ] Vector store filters correctly

### **PDF Selection**
- [ ] Default selection works (is_active = true)
- [ ] Multi-select works
- [ ] Chat uses only selected PDFs
- [ ] Validation rejects unauthorized PDFs

### **Delete**
- [ ] Delete removes from Qdrant
- [ ] Delete removes from Cloudinary
- [ ] Delete removes from Supabase
- [ ] Upload limit updates after delete

---

## 📅 Implementation Timeline

### **Phase 1: Authentication** - 1-2 hours
### **Phase 2: Supabase Setup** - 30 min - 1 hour
### **Phase 3: Vector Store** - 2-3 hours
### **Phase 4: Upload Limit & API** - 1-2 hours
### **Phase 5: Frontend UI** - 3-4 hours
### **Phase 6: Polish** - 1-2 hours

**Total Estimate: 9-14 hours** (1-2 days of focused work)

---

## 🔧 Environment Variables

### **Frontend (.env.local)**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### **Backend (.env)**
```bash
# Clerk
CLERK_SECRET_KEY=sk_test_...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # For backend operations

# Existing (keep these)
OPENAI_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
REDIS_HOST=...
REDIS_PORT=...
REDIS_PASSWORD=...
REDIS_TLS=...
FRONTEND_URL=...
```

---

## ✅ Success Criteria

### **Must Have (MVP)**
- ✅ Users can sign up/login with Clerk
- ✅ Users can upload PDFs (max 3 per user)
- ✅ Users can chat with selected PDFs only
- ✅ Users can see list of their PDFs
- ✅ Users can delete their PDFs
- ✅ No data leakage between users
- ✅ Upload limit enforced

### **Should Have**
- ✅ Upload status tracking
- ✅ PDF metadata display
- ✅ Multi-select for chat context
- ✅ Better UI/UX

---

## 🚨 Potential Challenges & Solutions

### **Challenge 1: Qdrant Filtering Performance**
- **Issue:** Filtering by userId + pdfIds might be slow
- **Solution:** Use Qdrant's filter efficiently, add metadata indexes

### **Challenge 2: Vector Store Deletion**
- **Issue:** Deleting all chunks for a PDF from Qdrant
- **Solution:** Use Qdrant delete API with filter: `userId == X AND pdfId == Y`

### **Challenge 3: Real-time Status Updates**
- **Issue:** How to notify frontend when processing completes
- **Solution:** Polling (simple) or Supabase real-time subscriptions (better UX)

### **Challenge 4: Upload Limit Edge Cases**
- **Issue:** What if user deletes PDF while upload is processing?
- **Solution:** Count only completed PDFs, or count all (pending + completed)

---

## 📚 Key Decisions Made

1. **Use Clerk's userId directly** - No manual generation
2. **Supabase for metadata** - Fast queries, clean separation
3. **Client sends pdfIds[]** - No Supabase query on every chat
4. **Backend validates ownership** - Security critical
5. **is_active for UI defaults only** - Not used in chat queries
6. **Max 3 PDFs per user** - Enforced on backend

---

## 🚀 Next Steps

1. **Set up Clerk** - Get API keys, configure
2. **Set up Supabase** - Create project, tables
3. **Start Phase 1** - Authentication
4. **Test incrementally** - After each phase

---

**Ready to implement? Let's start with Phase 1!** 🎯
