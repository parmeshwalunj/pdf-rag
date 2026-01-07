# 🚀 Deployment Checklist

## ✅ Pre-Deployment (Completed)
- [x] Local testing passed
- [x] All environment variables configured
- [x] Production-ready code changes completed

---

## 📋 Step-by-Step Deployment

### Step 1: Set Up Production Services (15-20 mins)

#### 1.1 Upstash Redis
- [ ] Sign up at [upstash.com](https://upstash.com)
- [ ] Create Redis database
- [ ] Copy connection details:
  - [ ] Host (endpoint)
  - [ ] Port (usually 6379)
  - [ ] Password
  - [ ] TLS enabled (usually yes)

#### 1.2 Qdrant Cloud
- [ ] Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
- [ ] Create cluster
- [ ] Copy cluster URL

**OR** Keep using local Qdrant if deploying backend on same machine

---

### Step 2: Deploy Backend (30-45 mins)

#### Option A: Render (Recommended)
- [ ] Sign up at [render.com](https://render.com)
- [ ] Deploy Server:
  - [ ] New → Web Service
  - [ ] Connect GitHub repo
  - [ ] Root Directory: `server`
  - [ ] Build: `pnpm install`
  - [ ] Start: `pnpm start`
  - [ ] Set environment variables (see below)
- [ ] Deploy Worker:
  - [ ] New → Background Worker
  - [ ] Same repo, Root: `server`
  - [ ] Start: `pnpm run start:worker`
  - [ ] Set environment variables
- [ ] Copy backend URL: `https://your-app.onrender.com`

#### Option B: Railway
- [ ] Sign up at [railway.app](https://railway.app)
- [ ] Deploy Server + Worker (same steps as Render)
- [ ] Copy backend URL

**Backend Environment Variables:**
```
OPENAI_API_KEY=sk-proj-...
QDRANT_URL=https://your-cluster.qdrant.io
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
FRONTEND_URL=https://your-app.vercel.app (set after frontend deploy)
```

**Worker Environment Variables:** (Same as above, except no PORT or FRONTEND_URL needed)

---

### Step 3: Deploy Frontend (10-15 mins)

- [ ] Sign up at [vercel.com](https://vercel.com)
- [ ] Import project from GitHub
- [ ] Root Directory: `client`
- [ ] Set environment variable:
  ```
  NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
  ```
- [ ] Deploy
- [ ] Copy frontend URL: `https://your-app.vercel.app`

---

### Step 4: Connect Everything (5 mins)

- [ ] Go back to backend (Render/Railway)
- [ ] Add environment variable:
  ```
  FRONTEND_URL=https://your-app.vercel.app
  ```
- [ ] Restart backend services (if needed)

---

### Step 5: Test Production (5 mins)

- [ ] Visit your Vercel URL
- [ ] Upload a PDF
- [ ] Wait for processing (check worker logs)
- [ ] Ask a question in chat
- [ ] Verify everything works!

---

## 🎯 Quick Start Commands

### For Render:
1. Create Web Service → Connect GitHub → Set root: `server` → Start: `pnpm start`
2. Create Background Worker → Same repo → Start: `pnpm run start:worker`

### For Vercel:
1. Import Project → Root: `client` → Set `NEXT_PUBLIC_API_URL` → Deploy

---

## 📝 Environment Variables Quick Copy

**Backend Server:**
```bash
OPENAI_API_KEY=your_key
QDRANT_URL=your_qdrant_url
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_secret
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_TLS=true
FRONTEND_URL=https://your-app.vercel.app
```

**Backend Worker:**
```bash
OPENAI_API_KEY=your_key
QDRANT_URL=your_qdrant_url
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_TLS=true
```

**Frontend:**
```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## 🆘 Need Help?

If you get stuck:
1. Check logs in Render/Railway/Vercel dashboard
2. Verify all environment variables are set correctly
3. Check CORS settings (FRONTEND_URL matches Vercel URL)
4. Verify Redis and Qdrant connections

---

**Estimated Total Time: 60-90 minutes**

Good luck! 🚀

