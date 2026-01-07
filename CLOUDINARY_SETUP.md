# Cloudinary Setup Guide

## Step 1: Get Your Cloudinary Credentials

1. Go to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Sign up or log in
3. Copy your credentials from the dashboard:
   - Cloud Name
   - API Key
   - API Secret

## Step 2: Configure Cloudinary Settings

### In Cloudinary Dashboard:

1. Go to **Settings** → **Security**
2. Under **Upload presets**, ensure:

   - **Allow unsigned uploading** is enabled (or create a signed preset)
   - For **Raw files**, make sure they're accessible

3. Go to **Settings** → **Upload**
   - Under **Upload manipulation**, ensure **Raw files** are allowed
   - Set **Access mode** to **Public** (or use signed URLs)

### Alternative: Enable Public Access for Raw Files

1. Go to **Settings** → **Security**
2. Scroll to **Restricted media types**
3. Make sure **Raw** is NOT restricted (or add exception for your folder)

## Step 3: Add to Environment Variables

Add these to your `server/.env` file:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Step 4: Test the Integration

1. Start your server: `cd server && pnpm run dev`
2. Start your worker: `cd server && pnpm run dev:worker`
3. Upload a PDF through the frontend
4. Check the server logs - you should see:
   - "Uploading file to Cloudinary..."
   - "File uploaded to Cloudinary: [URL]"
5. Check the worker logs - you should see:
   - "Downloading PDF from Cloudinary: [URL]"
   - Processing continues normally

## Troubleshooting

### If you get "Unauthorized" error:

1. **Check Cloudinary Security Settings:**

   - Settings → Security → Allow unsigned uploading
   - Make sure raw files are not restricted

2. **Verify File is Public:**

   - Go to Media Library in Cloudinary
   - Check if uploaded file shows a lock icon (private)
   - If private, click on it and change to "Public"

3. **Check Upload Settings:**

   - Settings → Upload → Access mode should be "Public"
   - Or use signed URLs if you prefer private files

4. **Test URL Directly:**
   - Copy the secure_url from upload response
   - Try opening it in browser - should download the PDF
   - If it asks for login, the file is private

## What Changed

- Files are now uploaded to Cloudinary instead of local `uploads/` directory
- Worker downloads PDF from Cloudinary URL as a buffer and processes it directly (no temp files - production-ready!)
- No more local file storage - everything is in the cloud!

## Benefits

✅ Files persist across server restarts
✅ Scalable - works in cloud environments
✅ CDN delivery for fast access
✅ Free tier: 25GB storage, 25GB bandwidth/month
