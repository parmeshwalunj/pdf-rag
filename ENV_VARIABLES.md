# Environment Variables Reference

## Server `.env` File (`server/.env`)

### ✅ Currently Set (Required)
You already have these set - keep them as is:
```bash
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=sk-proj-...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### ⚙️ Optional - Local Development (with defaults)
These have defaults, so you can comment them out for now:
```bash
# Redis/Valkey Host (default: localhost)
# REDIS_HOST=localhost

# Redis/Valkey Port (default: 6379)
# REDIS_PORT=6379

# Server Port (default: 8000)
# Most cloud platforms set this automatically
# PORT=8000
```

### 🚀 Production - Set After Backend Deployment
Add these when you deploy your backend:
```bash
# Redis/Valkey for Production (Upstash, Redis Cloud, etc.)
# Example for Upstash: your-redis-host.upstash.io
# REDIS_HOST=your-redis-host.upstash.io
# REDIS_PORT=6379
# REDIS_PASSWORD=your-redis-password-here
# REDIS_TLS=true

# Frontend URL for CORS (set after deploying frontend to Vercel)
# Single URL:
# FRONTEND_URL=https://your-app.vercel.app
# Multiple URLs (comma-separated):
# FRONTEND_URL=https://app1.vercel.app,https://app2.vercel.app
```

---

## Client `.env.local` File (`client/.env.local`)

### 🌐 Frontend Environment Variable
Set this after deploying your backend:
```bash
# Backend API URL
# Local: http://localhost:8000
# Production: https://your-backend.onrender.com (or your backend URL)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Summary

### For Local Development (Current Setup)
Your `server/.env` should have:
- ✅ `QDRANT_URL`
- ✅ `OPENAI_API_KEY`
- ✅ `CLOUDINARY_CLOUD_NAME`
- ✅ `CLOUDINARY_API_KEY`
- ✅ `CLOUDINARY_API_SECRET`

Everything else uses defaults (localhost:6379 for Redis, port 8000 for server).

### For Production Deployment
Add to `server/.env`:
- `REDIS_HOST` (from Upstash/Redis Cloud)
- `REDIS_PORT` (usually 6379)
- `REDIS_PASSWORD` (if required)
- `REDIS_TLS=true` (if using TLS)
- `FRONTEND_URL` (your Vercel frontend URL)

Add to `client/.env.local`:
- `NEXT_PUBLIC_API_URL` (your backend URL)

---

## Notes
- Server and Worker share the same `server/.env` file
- Frontend has its own `client/.env.local` file
- Never commit `.env` files to git (already in `.gitignore`)
- For production platforms, set environment variables in their dashboards:
  - **Render**: Environment tab in service settings
  - **Railway**: Variables tab in project settings
  - **Vercel**: Environment Variables in project settings

