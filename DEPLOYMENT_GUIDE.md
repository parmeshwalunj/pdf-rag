# 🚀 Deployment Guide

Step-by-step guide to deploy your PDF RAG application to production.

## 📋 Pre-Deployment Checklist

- [x] ✅ All production-ready changes completed
- [x] ✅ Environment variables configured
- [x] ✅ Cloudinary integration working
- [ ] Test locally with all services running
- [ ] Set up production services (Redis, Qdrant)
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Test end-to-end

---

## 🧪 Step 1: Test Locally First

Before deploying, make sure everything works locally:

```bash
# 1. Start Docker services (Redis/Valkey and Qdrant)
docker-compose up -d

# 2. Start the server (in one terminal)
cd server
pnpm start

# 3. Start the worker (in another terminal)
cd server
pnpm run start:worker

# 4. Start the frontend (in another terminal)
cd client
pnpm dev

# 5. Test the flow:
# - Upload a PDF at http://localhost:3000
# - Wait for processing (check worker logs)
# - Ask a question in the chat
```

If everything works locally, you're ready to deploy!

---

## 🌐 Step 2: Set Up Production Services

### 2.1 Set Up Upstash Redis (Free Tier)

1. Go to [https://upstash.com](https://upstash.com)
2. Sign up (free tier: 10K commands/day)
3. Create a new Redis database
4. Copy the connection details:
   - **Endpoint** (host)
   - **Port** (usually 6379)
   - **Password**
   - **TLS** (usually enabled)

**Save these for Step 3!**

### 2.2 Set Up Qdrant Cloud (Free Tier)

**Option A: Qdrant Cloud (Recommended)**
1. Go to [https://cloud.qdrant.io](https://cloud.qdrant.io)
2. Sign up (free tier: 1GB storage)
3. Create a new cluster
4. Copy the cluster URL

**Option B: Keep Local Qdrant (for now)**
- You can keep using local Qdrant if you're deploying backend locally
- For cloud deployment, use Qdrant Cloud

**Save the Qdrant URL for Step 3!**

---

## 🖥️ Step 3: Deploy Backend (Render/Railway)

### Option A: Render (Recommended - Free Tier Available)

1. **Sign up at [render.com](https://render.com)**

2. **Deploy Server:**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name:** `pdf-rag-server`
     - **Root Directory:** `server`
     - **Environment:** `Node`
     - **Build Command:** `pnpm install`
     - **Start Command:** `pnpm start`
     - **Plan:** Free (or paid for better performance)

3. **Set Environment Variables:**
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
   PORT=8000
   ```
   (Render sets PORT automatically, but include it anyway)

4. **Deploy Worker (Separate Service):**
   - Click "New" → "Background Worker"
   - Connect same repository
   - Settings:
     - **Name:** `pdf-rag-worker`
     - **Root Directory:** `server`
     - **Environment:** `Node`
     - **Build Command:** `pnpm install`
     - **Start Command:** `pnpm run start:worker`
   - **Set same environment variables** (except PORT - not needed for worker)

5. **Get your backend URL:**
   - Server URL: `https://pdf-rag-server.onrender.com`
   - Save this for frontend deployment!

### Option B: Railway

1. **Sign up at [railway.app](https://railway.app)**

2. **Deploy Server:**
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Add service → Select `server` directory
   - Settings:
     - **Start Command:** `pnpm start`
   - Add environment variables (same as Render)

3. **Deploy Worker:**
   - Add another service → Same repository
   - **Root Directory:** `server`
   - **Start Command:** `pnpm run start:worker`
   - Add same environment variables

4. **Get your backend URL:**
   - Railway provides a URL like: `https://your-app.up.railway.app`
   - Save this for frontend deployment!

---

## 🎨 Step 4: Deploy Frontend (Vercel)

1. **Sign up at [vercel.com](https://vercel.com)**

2. **Import Project:**
   - Click "Add New" → "Project"
   - Import from GitHub
   - Select your repository

3. **Configure:**
   - **Root Directory:** `client`
   - **Framework Preset:** Next.js
   - **Build Command:** `pnpm build` (or leave default)
   - **Output Directory:** `.next`

4. **Set Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   ```
   (Replace with your actual backend URL from Step 3)

5. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Get your frontend URL: `https://your-app.vercel.app`

---

## 🔗 Step 5: Connect Everything

### 5.1 Update Backend CORS

Go back to your backend deployment (Render/Railway) and add:

```
FRONTEND_URL=https://your-app.vercel.app
```

(Replace with your actual Vercel URL)

### 5.2 Verify Environment Variables

**Backend (Server):**
- ✅ All required variables set
- ✅ `FRONTEND_URL` set to Vercel URL

**Backend (Worker):**
- ✅ All required variables set
- ✅ Same Redis connection as server

**Frontend:**
- ✅ `NEXT_PUBLIC_API_URL` set to backend URL

---

## ✅ Step 6: Test Production

1. **Visit your Vercel URL:** `https://your-app.vercel.app`

2. **Test the flow:**
   - Upload a PDF
   - Wait for processing (check worker logs in Render/Railway)
   - Ask a question in the chat

3. **Check logs:**
   - **Backend logs:** Render/Railway dashboard
   - **Worker logs:** Render/Railway dashboard
   - **Frontend logs:** Vercel dashboard

---

## 🐛 Troubleshooting

### Backend not starting?
- Check environment variables are all set
- Check logs in Render/Railway dashboard
- Verify Redis connection (Upstash dashboard)

### Worker not processing?
- Check worker logs
- Verify Redis connection
- Check Qdrant connection

### Frontend can't connect to backend?
- Check `NEXT_PUBLIC_API_URL` is correct
- Check backend CORS settings (`FRONTEND_URL`)
- Check backend is running (visit backend URL directly)

### CORS errors?
- Make sure `FRONTEND_URL` in backend matches your Vercel URL exactly
- Check browser console for specific error

---

## 📊 Monitoring

### Free Monitoring Options:
- **Render:** Built-in logs and metrics
- **Railway:** Built-in logs
- **Vercel:** Built-in analytics
- **Upstash:** Dashboard shows command usage

---

## 💰 Cost Estimate (Free Tier)

- **Render:** Free tier available (limited hours/month)
- **Vercel:** Free tier (unlimited for personal projects)
- **Upstash Redis:** Free tier (10K commands/day)
- **Qdrant Cloud:** Free tier (1GB storage)
- **Cloudinary:** Free tier (25GB storage, 25GB bandwidth/month)

**Total: $0/month** (for small-scale usage)

---

## 🎯 Next Steps After Deployment

1. Set up custom domain (optional)
2. Add monitoring/alerting
3. Set up CI/CD (automatic deployments)
4. Add rate limiting (if needed)
5. Set up backups for Qdrant data

---

## 📝 Quick Reference

### Backend URLs:
- Server: `https://your-backend.onrender.com`
- Health check: `https://your-backend.onrender.com/`

### Environment Variables Summary:

**Backend Server:**
```
OPENAI_API_KEY
QDRANT_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
REDIS_TLS=true
FRONTEND_URL
```

**Backend Worker:**
```
OPENAI_API_KEY
QDRANT_URL
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
REDIS_TLS=true
```

**Frontend:**
```
NEXT_PUBLIC_API_URL
```

---

Good luck with your deployment! 🚀

