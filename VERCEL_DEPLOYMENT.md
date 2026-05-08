# Vercel Deployment Guide

## Setup Steps

### 1. Configure Environment Variables on Vercel

Go to your Vercel project settings and add these environment variables:

- **GEMINI_API_KEY**: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Commit and Push Changes

```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

Vercel will automatically detect the changes and deploy.

### 3. Verify Deployment

After deployment completes, verify the API endpoints:

- `https://your-domain.vercel.app/api/schema` (GET)
- `https://your-domain.vercel.app/api/execute` (POST)
- `https://your-domain.vercel.app/api/upload` (POST)
- `https://your-domain.vercel.app/api/evaluate` (POST)

## Troubleshooting

### 404 Errors on API Endpoints

**Issue**: API endpoints return 404 errors.

**Solution**: 
- Ensure all files in the `api/` directory are committed to git
- Check that `vercel.json` is in the root directory
- Verify environment variables are set in Vercel dashboard

### Gemini API 400 Errors

**Issue**: The Gemini API returns 400 errors.

**Possible causes**:
1. Invalid or missing `GEMINI_API_KEY`
   - Generate a new key at: https://aistudio.google.com/app/apikey
   - Ensure it's set in Vercel environment variables

2. The model name might be incorrect
   - Current: `gemini-3-flash-preview`
   - Available models: `gemini-1.5-flash`, `gemini-1.5-pro`, etc.
   - Update `src/services/gemini.ts` if needed

3. CORS issues (if calling API from browser)
   - API calls should use relative paths like `/api/schema`
   - Serverless functions handle CORS automatically

### "Failed to fetch schema" / 404 on /api/upload

**Solution**:
- Clear browser cache
- Do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check Vercel deployment logs for errors

## Database Persistence

Note: Vercel's serverless functions don't persist files. Each function invocation gets fresh storage. The SQLite database is created fresh on each deployment.

For production, consider:
- Using Vercel's PostgreSQL add-on
- Using a cloud database (Supabase, PlanetScale, etc.)
- Configuring persistent storage if needed

## Local Development

```bash
npm install
npm run dev
```

Then visit `http://localhost:5173`
