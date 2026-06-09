# PaperLens Production Fix - Implementation Guide

## Quick Start (5 minutes)

### CRITICAL: Check Render Environment Variables

Before implementing any code fixes, verify that your production environment is configured:

**In Render Dashboard:**
1. Go to your Backend service
2. Click "Environment"
3. Verify these variables are present:
   - `GEMINI_API_KEY` = `<your actual Gemini API key>`
   - `GEMINI_MODEL` = `gemini-1.5-flash` (or your preferred model)
   - `MONGODB_URI` = (should already be set)
   - `JWT_SECRET` = (should already be set)

**If GEMINI_API_KEY is missing:**
```bash
# Get your Gemini API key from: https://aistudio.google.com/apikey
# Then add it to Render Dashboard → Environment → Add Variable

GEMINI_API_KEY=<paste-your-key-here>
```

---

## Step-by-Step Implementation

### Step 1: Add Comprehensive Logging to Gemini Service

**File: `backend/src/services/geminiService.js`**

This is the HIGHEST PRIORITY FIX.

```bash
# BEFORE implementing code changes, back up the original
cp backend/src/services/geminiService.js backend/src/services/geminiService.js.bak
```

**Changes to make:**

1. Add metrics tracking at the top (after imports):
```javascript
// Metrics tracking for monitoring
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitErrors: 0,
  timeoutErrors: 0,
  authErrors: 0,
  lastErrorTime: null,
  lastErrorMessage: null
};
```

2. Add request ID logging at start of `generateGeminiJsonResponse()`:
```javascript
async function generateGeminiJsonResponse(prompt) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  metrics.totalRequests++;

  console.log(`[GEMINI-${requestId}] Request started at ${new Date().toISOString()}`);
  console.log(`[GEMINI-${requestId}] API key length: ${process.env.GEMINI_API_KEY?.length || 0}`);
  console.log(`[GEMINI-${requestId}] Prompt length: ${prompt.length}`);
  
  // ... rest of function ...
}
```

3. Add detailed error classification in the catch block (around line 138):
```javascript
} catch (error) {
  if (error instanceof ServiceError) {
    throw error;
  }

  const duration = Date.now() - startTime;
  const errorInfo = {
    type: error?.constructor?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    duration: duration + "ms"
  };

  console.error(`[GEMINI-${requestId}] UNEXPECTED ERROR:`, JSON.stringify(errorInfo, null, 2));

  // Classify specific errors
  if (error?.status === 429) {
    metrics.rateLimitErrors++;
    throw new ServiceError("API rate limit exceeded. Wait a few minutes.", 429);
  }

  if (error?.code === "AUTH_ERROR" || error?.message?.includes("API_KEY")) {
    metrics.authErrors++;
    throw new ServiceError("AI service auth failed. Contact support.", 500);
  }

  if (error?.message?.includes("timeout") || error?.message?.includes("DEADLINE")) {
    metrics.timeoutErrors++;
    throw new ServiceError("AI service response timeout. Try again.", 504);
  }

  metrics.failedRequests++;
  metrics.lastErrorTime = new Date().toISOString();
  metrics.lastErrorMessage = error?.message;

  throw new ServiceError(
    "AI service is currently busy. Please try again in a few seconds.",
    503
  );
}
```

4. Export metrics function at end of file:
```javascript
function getMetrics() {
  const successRate = metrics.totalRequests > 0 
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : "N/A";

  return {
    ...metrics,
    successRate: successRate + "%"
  };
}

module.exports = {
  ServiceError,
  generateGeminiJsonResponse,
  generatePaperSummary,
  getMetrics  // <-- ADD THIS
};
```

---

### Step 2: Add Health Check Endpoint

**File: `backend/src/routes/health.js`**

Add a new route to check Gemini API health:

```javascript
const express = require("express");
const { getMetrics } = require("../services/geminiService");
const env = require("../config/env");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv
  });
});

// NEW: Gemini health check
router.get("/gemini", (req, res) => {
  const metrics = getMetrics();
  
  res.json({
    timestamp: new Date().toISOString(),
    gemini: {
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      apiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
      model: env.geminiModel || "gemini-1.5-flash",
      metrics: metrics
    }
  });
});

module.exports = router;
```

Now you can check Gemini health at: `https://paperlens-a7li.onrender.com/api/health/gemini`

---

### Step 3: Enhanced Paper Controller Logging

**File: `backend/src/controllers/paperController.js`**

Add comprehensive logging to `generateSummary()` and `generateAnalysis()`:

At the TOP of the file (after imports), add:
```javascript
// Request deduplication to prevent duplicate API calls
const requestDeduplication = new Map();
```

Then replace the `generateSummary()` function (around line 451):

```javascript
async function generateSummary(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  const paperId = req.params.id;
  const userId = req.userId;

  console.log(`[SUMMARY-${requestId}] ========== REQUEST START ==========`);
  console.log(`[SUMMARY-${requestId}] paperId: ${paperId}`);
  console.log(`[SUMMARY-${requestId}] userId: ${userId}`);
  console.log(`[SUMMARY-${requestId}] timestamp: ${new Date().toISOString()}`);

  try {
    // VALIDATION
    validatePaperId(paperId);
    console.log(`[SUMMARY-${requestId}] ✓ Paper ID format valid`);

    // DATABASE QUERY
    console.log(`[SUMMARY-${requestId}] Querying database...`);
    const paper = await Paper.findOne({
      _id: paperId,
      userId
    });

    if (!paper) {
      console.error(`[SUMMARY-${requestId}] ✗ Paper not found`, {
        searchedPaperId: paperId,
        searchedUserId: userId
      });

      // DEBUG: Check if paper exists with different user
      const paperExists = await Paper.findById(paperId).select("userId");
      if (paperExists) {
        console.error(`[SUMMARY-${requestId}] DEBUG: Paper exists but owned by different user`, {
          paperOwnerId: paperExists.userId.toString(),
          requestedBy: userId.toString()
        });
      }

      throw createHttpError(404, "Paper not found.");
    }

    console.log(`[SUMMARY-${requestId}] ✓ Paper found: ${paper.title}`);

    // CHECK CACHE
    if (paper.summary && paper.summary.shortSummary) {
      console.log(`[SUMMARY-${requestId}] ✓ Using cached summary`);
      return res.status(200).json({
        message: "Summary retrieved from cache",
        paper,
        fromCache: true
      });
    }

    // GENERATE SUMMARY
    console.log(`[SUMMARY-${requestId}] Starting AI generation...`);
    const summary = await generatePaperSummary(paper.extractedText);
    console.log(`[SUMMARY-${requestId}] ✓ Summary generated`);

    // UPDATE DATABASE
    const updated = await Paper.findOneAndUpdate(
      { _id: paper._id, userId },
      { summary, summaryGeneratedAt: new Date() },
      { new: true, runValidators: true }
    );
    console.log(`[SUMMARY-${requestId}] ✓ Paper updated`);

    // RECORD ACTIVITY
    await recordActivity({
      userId,
      type: "summary_generated",
      title: paper.title,
      metadata: { paperId: paper._id }
    });

    const duration = Date.now() - startTime;
    console.log(`[SUMMARY-${requestId}] ========== SUCCESS ========== (${duration}ms)`);

    return res.status(200).json({
      message: "Summary generated successfully",
      paper: updated
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SUMMARY-${requestId}] ========== FAILED ========== (${duration}ms)`, {
      errorType: error?.constructor?.name,
      errorMessage: error?.message,
      errorStatus: error?.statusCode
    });

    return res.status(error?.statusCode || 502).json({
      error: error?.message || "Failed to generate summary."
    });
  }
}
```

---

### Step 4: Frontend Enhanced Error Handling

**File: `frontend/src/components/PaperDetail.jsx`**

Replace the `handleGenerateSummary()` function (around line 106):

```javascript
const handleGenerateSummary = async () => {
  console.log("[SUMMARY] Button clicked");
  
  if (!paper) {
    setError("Paper not loaded. Please refresh the page.");
    return;
  }

  if (!paperId) {
    setError("Paper ID not available. Please refresh the page.");
    return;
  }

  const { token } = useAuth();
  if (!token) {
    setError("Not authenticated. Please log in.");
    return;
  }

  setIsGeneratingSummary(true);
  setError("");

  const startTime = Date.now();
  console.log("[SUMMARY] Starting request for paperId:", paperId);

  try {
    const result = await generateSummary(paperId);
    
    const duration = Date.now() - startTime;
    console.log(`[SUMMARY] Success in ${duration}ms`);
    
    if (result?.paper) {
      setPaper(result.paper);
    }
  } catch (apiError) {
    const duration = Date.now() - startTime;
    
    console.error(`[SUMMARY] Failed after ${duration}ms`, {
      status: apiError?.response?.status,
      message: apiError?.message,
      data: apiError?.response?.data
    });

    // Better error messages
    let errorMessage = "Failed to generate summary.";
    
    if (apiError?.response?.status === 404) {
      errorMessage = "Paper not found. It may have been deleted.";
    } else if (apiError?.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (apiError?.response?.status === 429) {
      errorMessage = "Too many requests. Please wait a few minutes.";
    } else if (apiError?.response?.status === 503) {
      errorMessage = "AI service is busy. Please try again in a few minutes.";
    } else if (apiError?.message?.includes("Network")) {
      errorMessage = "Network error. Please check your connection.";
    }
    
    setError(errorMessage);
  } finally {
    setIsGeneratingSummary(false);
  }
};
```

---

### Step 5: Frontend Request Retry Logic

**File: `frontend/src/services/paperApi.js`**

Replace the `generateSummary()` function to add retries:

```javascript
export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  console.info(`[api] POST ${url}`);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 5000]; // milliseconds

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, null, {
        signal,
        timeout: 120000  // 2 minute timeout
      });
      
      console.info(`[api] POST ${url} - Success on attempt ${attempt + 1}`);
      return response.data;
      
    } catch (error) {
      // Don't retry on 404 or 401 errors
      if (error.response?.status === 404 || error.response?.status === 401) {
        console.error(`[api] POST ${url} - Non-retryable error: ${error.response?.status}`);
        throw error;
      }

      // Only retry on 503, 429, 504, or network errors
      const shouldRetry = 
        error.response?.status === 503 ||
        error.response?.status === 429 ||
        error.response?.status === 504 ||
        error.message?.includes("timeout") ||
        error.message?.includes("Network");

      if (!shouldRetry || attempt === MAX_RETRIES - 1) {
        console.error(`[api] POST ${url} - Failed after ${attempt + 1} attempts`);
        throw error;
      }

      const delay = RETRY_DELAYS[attempt];
      console.warn(`[api] POST ${url} - Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Verification Steps

### 1. Check Render Logs

**In Render Dashboard:**
1. Go to your Backend service
2. Click "Logs" tab
3. Search for: `[GEMINI-` or `[SUMMARY-`

You should see log entries like:
```
[GEMINI-abc123] Request started at 2026-06-09T10:00:00.000Z
[GEMINI-abc123] API key length: 32
[GEMINI-abc123] Prompt length: 5000
[GEMINI-abc123] ✓ SUCCESS on attempt 1, model=gemini-1.5-flash, duration=2500ms
```

### 2. Check Gemini Health Endpoint

Open in browser or Postman:
```
https://paperlens-a7li.onrender.com/api/health/gemini
```

Expected response:
```json
{
  "timestamp": "2026-06-09T10:00:00.000Z",
  "gemini": {
    "apiKeyConfigured": true,
    "apiKeyLength": 32,
    "model": "gemini-1.5-flash",
    "metrics": {
      "totalRequests": 10,
      "successfulRequests": 9,
      "failedRequests": 1,
      "successRate": "90.00%"
    }
  }
}
```

### 3. Test Generate Summary in Production

1. Log in to https://paper-lens-virid.vercel.app
2. Upload a test paper
3. Click "Generate Summary"
4. Check browser DevTools → Network → Request headers for `Authorization: Bearer ...`
5. Check browser Console for logs like `[api] POST ... - Success on attempt 1`

---

## Troubleshooting

### Issue: "GEMINI_API_KEY is not configured"

**Check:**
1. Is GEMINI_API_KEY set in Render Environment? (Settings → Environment Variables)
2. Did you restart the backend after adding the variable?
3. Is the key valid? (Should be 20+ characters)

**Fix:**
```bash
# In Render Dashboard
# 1. Go to your Backend service
# 2. Settings → Environment Variables
# 3. Add: GEMINI_API_KEY=<your-key>
# 4. Click "Save"
# 5. Service will auto-restart
```

### Issue: "Paper not found" Error

**Check:**
1. Is Authorization header being sent? (DevTools → Network → Headers)
2. Are you logged in? (Check browser Console: localStorage.getItem("paperlens.authToken"))
3. Does the paper belong to your account?

**Debug:**
```javascript
// In browser console:
const token = localStorage.getItem("paperlens.authToken");
console.log("Token:", token);

const parts = token.split(".");
const payload = JSON.parse(atob(parts[1]));
console.log("Token payload:", payload);
```

### Issue: "AI service is currently busy" Every Time

**This means:**
1. GEMINI_API_KEY might be invalid or not set
2. You're hitting rate limits (60 req/min or quota exhausted)
3. Network timeout between Render and Gemini

**Fix in Priority Order:**
1. Check Render logs for specific error message
2. Visit `/api/health/gemini` and check success rate
3. Check Gemini API console: https://console.cloud.google.com/apis/quotas
4. Upgrade Gemini to paid plan

---

## Production Monitoring

### Set Up Log Alerts

**In Render Dashboard:**
1. Logs → Create Alert
2. Alert if logs contain: `[GEMINI] CRITICAL` or `metrics.failedRequests`

### Monitor Success Rate

Add this to your monitoring dashboard:
```
Health Check URL: https://paperlens-a7li.onrender.com/api/health/gemini
Check every: 5 minutes
Alert if: successRate < 80%
```

---

## Long-Term Improvements

### 1. Cache Results (Prevent Re-Processing)

Current code already checks for cached summary:
```javascript
if (paper.summary && paper.summary.shortSummary) {
  return cached result
}
```

This is good! Users won't be charged twice for same paper.

### 2. Implement Rate Limiting

Add to backend:
```javascript
// In summaryController or analysisController
const userRequests = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = userId.toString();
  
  if (!userRequests.has(userKey)) {
    userRequests.set(userKey, []);
  }
  
  const requests = userRequests.get(userKey);
  // Remove requests older than 1 minute
  const recent = requests.filter(t => now - t < 60000);
  
  if (recent.length >= 10) { // Max 10 requests per minute
    throw new Error("Rate limit exceeded. Max 10 requests/minute");
  }
  
  recent.push(now);
  userRequests.set(userKey, recent);
}
```

### 3. Use Queue for Heavy Processing

Consider using Bull.js or similar for async job processing:
```bash
npm install bull redis
```

---

## Rollback Plan

If something breaks, you can quickly revert:

```bash
# Restore original file
cp backend/src/services/geminiService.js.bak backend/src/services/geminiService.js
git commit -am "Rollback geminiService changes"
git push origin main
```

Render will auto-redeploy.

---

## Next Steps

1. ✓ Check Render environment variables
2. ✓ Implement geminiService.js logging
3. ✓ Add health check endpoint
4. ✓ Enhance paperController logging
5. ✓ Add frontend retry logic
6. ✓ Test in production
7. ✓ Monitor success rates
8. ✓ Set up alerts

After implementing these fixes, your production deployment should be much more stable and easier to debug!
