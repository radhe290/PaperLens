# PRODUCTION DEPLOYMENT & ENVIRONMENT CONFIGURATION GUIDE

## CRITICAL: Set These Environment Variables on Render Before Deploying

### Step 1: Get Your API Keys

#### Required: Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key in new project"
3. Select your GCP project or create new
4. Copy the API key
5. **Set in Render as:** `GEMINI_API_KEY`

#### Optional: OpenAI API Key (Fallback Provider)
1. Go to [OpenAI Platform](https://platform.openai.com/account/api-keys)
2. Create new API key
3. Set in Render as: `OPENAI_API_KEY`

#### Optional: Anthropic Claude API Key (Better Alternative)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create new API key
3. Set in Render as: `ANTHROPIC_API_KEY`

### Step 2: Configure Environment Variables in Render

**Login to Render Dashboard** → Your Backend Service → Environment

Add all of these:

```
NODE_ENV=production
MONGODB_URI=<your-mongodb-atlas-connection-string>
JWT_SECRET=<generate-a-random-32-char-string>
CORS_ORIGIN=https://paper-lens-virid.vercel.app
GEMINI_API_KEY=<from-step-1>
GEMINI_MODEL=gemini-1.5-flash
CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
CLOUDINARY_API_KEY=<your-cloudinary-key>
CLOUDINARY_API_SECRET=<your-cloudinary-secret>
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=<optional-fallback>
ANTHROPIC_API_KEY=<optional-fallback>
```

**CRITICAL CHECKS:**
- [ ] All required fields are filled (non-empty)
- [ ] No typos in key names
- [ ] API keys are correct (copy-paste from source)
- [ ] MONGODB_URI includes credentials
- [ ] CORS_ORIGIN matches your Vercel frontend URL

### Step 3: Verify Configuration

After deploying with these env vars, your backend logs should show:

```
[STARTUP] Environment validation passed
[STARTUP] Node environment: production
[STARTUP] Port: 10000 (Render's default)
[STARTUP] CORS origins configured: https://paper-lens-virid.vercel.app
```

If you see errors instead, the env vars are not set correctly.

### Step 4: Test the Configuration

Make a test request:

```bash
curl -X POST https://your-backend-url.render.com/api/papers/{paperId}/generate-summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected responses:
- ✓ 200: Summary generated
- ✓ 401: Unauthorized (token missing or expired) - Auth middleware working
- ✓ 404: Paper not found - Now with detailed debug logs
- ✓ 500: Internal error (check logs for GEMINI_API_KEY issue)

---

## AI PROVIDER RECOMMENDATION

### Current Issue
- Only using Google Gemini (free tier: 60 req/min, 1M tokens/month)
- No fallback if service fails
- Quality inconsistent for some papers

### Recommended Production Stack

**Primary (First choice):** Claude 3.5 Sonnet (via Anthropic)
- **Pros:** Better writing quality, more reliable, handles longer content
- **Cons:** Slightly slower, pricing ~$3/1M input tokens
- **Cost estimate:** ~$50/month for 1000 papers

**Secondary (Fallback):** OpenAI GPT-4 Turbo
- **Pros:** Reliable, good quality, fast
- **Cons:** More expensive (~$10/1M input tokens)
- **Cost estimate:** ~$100-150/month for 1000 papers

**Tertiary (Free tier):** Google Gemini 1.5 Flash
- **Pros:** Fastest, free tier available
- **Cons:** Quality varies, rate limits
- **Cost estimate:** Free until quota

### Migration Steps

1. **Install providers:**
```bash
cd backend
npm install @anthropic-ai/sdk
npm install openai
```

2. **Update geminiService.js** (See AI_PROVIDERS_IMPLEMENTATION.md)

3. **Test fallback logic:**
   - Stop Claude provider, verify fallback to OpenAI works
   - Stop OpenAI, verify fallback to Gemini works

---

## DEBUGGING PRODUCTION ISSUES

### If 404 "Paper Not Found" Returns

Check logs with this pattern:
```
[SUMMARY-abc123] ========== REQUEST START ==========
[SUMMARY-abc123] paperId: 67890abc...
[SUMMARY-abc123] userId: 123def...
```

**Diagnosis:**
- If `userId` is empty: Auth middleware not setting req.userId
- If `paperId` has wrong format: Frontend sending invalid ID
- If `✓ Paper found` followed by `✗ Paper not found`: Ownership mismatch (user doesn't own paper)

### If 503 "AI Service is Busy" Returns

1. **Check GEMINI_API_KEY is set:**
   ```bash
   curl https://your-backend.render.com/api/health
   # Should show all required env vars configured
   ```

2. **Check Render logs:**
   ```
   [ANALYSIS-xyz] analyzePaper service failed
   Error: GEMINI_API_KEY is not configured
   ```

3. **If rate limited:**
   ```
   Error: Rate limit exceeded. 60 requests per minute.
   ```
   → Wait 1 minute or implement queue system

4. **If quota exceeded:**
   ```
   Error: Quota of 1M tokens exceeded for free tier
   ```
   → Upgrade to paid Gemini tier or use Claude/OpenAI

### Tail Production Logs

```bash
# Via Render Dashboard
Your Backend Service → Logs

# Via Render CLI
npm install -g render
render log -s your-service-id --tail
```

---

## PRODUCTION CHECKLIST

### Before Launch
- [ ] GEMINI_API_KEY set and working
- [ ] MONGODB_URI connects successfully
- [ ] JWT_SECRET is secure random value
- [ ] CORS_ORIGIN matches frontend domain
- [ ] All required env vars present (no empty strings)

### Monitoring
- [ ] Check backend logs daily for errors
- [ ] Monitor Render dashboard for crashes/restarts
- [ ] Set up alerts for 500 errors
- [ ] Track AI API usage and costs

### User Communication
- [ ] Tell users if AI features are temporarily down
- [ ] Provide ETA for restoration
- [ ] Show loading states for AI operations

---

## QUICK REFERENCE: Route Changes

**Old routes (deprecated but still work if backend supports):**
```
POST /api/summarize → Use new route instead
POST /api/analyze → Use new route instead
```

**New routes (active):**
```
POST /api/papers/:id/generate-summary
POST /api/papers/:id/generate-analysis
```

**Frontend uses new routes** ✓

