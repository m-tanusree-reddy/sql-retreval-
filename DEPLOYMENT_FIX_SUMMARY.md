# Vercel Deployment Fix - Summary of Changes

## What Was Wrong

Your app was deployed to Vercel, but had several issues:

1. **404 on API endpoints** - Express server routes defined in `server.ts` don't work on Vercel because Vercel uses serverless functions, not traditional Node.js servers
2. **API routes not found** - The `/api/schema`, `/api/upload`, `/api/execute`, `/api/evaluate` endpoints were unreachable
3. **Gemini API 400 errors** - Missing or improperly configured environment variables

## Changes Made

### 1. Created Vercel Serverless Functions (`/api` directory)
Created individual handler files for each API endpoint:
- `api/schema.ts` - GET /api/schema
- `api/execute.ts` - POST /api/execute  
- `api/upload.ts` - POST /api/upload
- `api/evaluate.ts` - POST /api/evaluate

Each file is a serverless function that handles requests independently.

### 2. Created `vercel.json` Configuration
Added Vercel build and routing configuration:
- Tells Vercel to build the `api/` directory as Node.js serverless functions
- Configures routing to serve static files from `dist/` and API routes from `api/`
- Enables SPA routing (404s go to index.html for client-side routing)

### 3. Updated `package.json`
- Added `@vercel/node` dependency for serverless functions
- Added Node.js engine specification (`18.x`)

### 4. Updated `vite.config.ts`
- Added explicit build output configuration
- Ensures `dist/` directory is properly emptied on rebuild

### 5. Created `VERCEL_DEPLOYMENT.md`
Documentation for deploying and troubleshooting on Vercel

## What You Need to Do Next

### Step 1: Set Environment Variables on Vercel Dashboard

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add:
- **GEMINI_API_KEY**: Your API key from https://aistudio.google.com/app/apikey

### Step 2: Commit and Deploy

```bash
git add .
git commit -m "Fix Vercel deployment with serverless functions"
git push origin main
```

Vercel will automatically redeploy with these changes.

### Step 3: Test Your Deployment

After deployment completes:
1. Visit your Vercel domain
2. Check browser console for errors (F12 → Console tab)
3. Verify API endpoints are working (should see data, not 404)

## Common Issues & Solutions

### Still Getting 404 Errors?
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check Vercel deployment shows "Ready"
- Check Vercel logs for errors

### Gemini API Still Giving 400 Errors?
- Verify `GEMINI_API_KEY` is set in Vercel environment variables
- Make sure key is valid: https://aistudio.google.com/app/apikey
- The model name might need updating if Google deprecates the current model

### Database Issues?
SQLite data persists only within a single serverless function execution. For production:
- Data in each function is fresh per invocation
- Consider using Supabase, Vercel Postgres, or MongoDB for persistent data

## File Structure After Changes

```
/api                    ← NEW: Serverless functions directory
  ├── schema.ts         ← NEW: GET /api/schema
  ├── execute.ts        ← NEW: POST /api/execute
  ├── upload.ts         ← NEW: POST /api/upload
  └── evaluate.ts       ← NEW: POST /api/evaluate
vercel.json            ← NEW: Vercel deployment config
VERCEL_DEPLOYMENT.md   ← NEW: Deployment guide
package.json           ← UPDATED: Added @vercel/node
vite.config.ts         ← UPDATED: Added build output config
```

## Local Development

Everything still works locally:
```bash
npm install
npm run dev  # Runs on localhost:5173 with Vite dev server
```

The serverless functions use the same logic as before, just refactored to work with Vercel's architecture.
