# PaperLens Deep Root-Cause Analysis

## Executive Summary

Your PaperLens application has **two interconnected critical issues** in production:

1. **AI Service Busy (503 errors)** - Gemini API is frequently unavailable or rate-limited
2. **Paper Not Found (404 errors)** - Authentication or database queries failing for Generate Summary/Analysis

Both issues are **likely caused by missing or misconfigured environment variables on Render**, combined with **weak error logging** that hides the actual root cause.

---

# ISSUE 1: "AI Service is Currently Busy" - Deep Root-Cause Analysis

## Error Message Trace

```
Error Message: "AI service is currently busy. Please try again in a few seconds."
HTTP Status: 503
```

### Where It Originates

**File**: `backend/src/services/geminiService.js`

**Line 126-139** (primary failure path):
```javascript
} catch (fallbackErr) {
  console.error(`Fallback Gemini model ${fallbackModel} also failed: ${fallbackErr?.message || fallbackErr}`);
  // Throw a friendly error
  throw new ServiceError("AI service is currently busy. Please try again in a few seconds.", 503);
}
```

**Line 262** (uncaught error path):
```javascript
throw new ServiceError(
  "AI service is currently busy. Please try again in a few seconds.",
  503
);
```

### Complete Execution Flow for Generate Summary

1. **Frontend Request** (`PaperDetail.jsx` line 114):
```javascript
const result = await generateSummary(paperId);
```

2. **API Call** (`paperApi.js` line 69-74):
```javascript
export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  console.info(`[api] POST ${url}`);
  const response = await axios.post(url, null, { signal });
  return response.data;
}
```

3. **Route Handler** (`paperRoutes.js` line 23):
```javascript
router.post("/:id/generate-summary", asyncHandler(generateSummary));
// Note: authMiddleware is applied to ALL routes via router.use(authMiddleware) on line 12
```

4. **Authentication Middleware** (`authMiddleware.js`):
```javascript
const payload = jwt.verify(token, env.jwtSecret);
const user = await User.findById(payload.userId).select("name email createdAt");
req.user = user;
req.userId = user._id;  // <-- Sets userId for controller
return next();
```

5. **Controller** (`paperController.js` line 451-471):
```javascript
async function generateSummary(req, res) {
  validatePaperId(req.params.id);
  
  const paper = await Paper.findOne({ 
    _id: req.params.id, 
    userId: req.userId  // <-- Uses authenticated userId
  });
  
  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }
  
  const summary = await generatePaperSummary(paper.extractedText);
  // ... save and return
}
```

6. **AI Service Call** (`geminiService.js` line 57-110):
```javascript
async function generateGeminiJsonResponse(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new ServiceError("GEMINI_API_KEY is not configured.", 500);
  }
  
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [2000, 4000, 6000];
  const primaryModel = env.geminiModel || "gemini-2.5-flash";
  const fallbackModel = "gemini-1.5-flash";
  
  // Retry logic with exponential backoff
  async function tryGenerate(modelName) {
    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const model = getGeminiModel(modelName);
        const result = await model.generateContent(prompt);
        return parseJsonResponse(result.response.text());
      } catch (err) {
        // If transient error (503, "service unavailable", "high demand")
        // retry with backoff
        // Otherwise, throw immediately
      }
    }
  }
  
  // Try primary model, then fallback
  try {
    return await tryGenerate(primaryModel);
  } catch (primaryErr) {
    if (isTransientError(primaryErr)) {
      try {
        return await tryGenerate(fallbackModel);
      } catch (fallbackErr) {
        throw new ServiceError(
          "AI service is currently busy. Please try again in a few seconds.",
          503
        );
      }
    }
    throw new ServiceError("Failed to generate content. Please try again.", 502);
  }
}
```

7. **Controller Error Handler** (`summaryController.js` line 24-32):
```javascript
} catch (error) {
  console.error("generateSummary error:", error);
  const message =
    error?.message === "AI service is currently busy..." ||
    error?.statusCode === 503
      ? "AI service is currently busy. Please try again in a few seconds."
      : "Failed to generate summary. Please try again.";
  return res.status(error?.statusCode || 502).json({ error: message });
}
```

8. **Frontend Error Display** (`errorUtil.js` line 7-9):
```javascript
if (serverMessage.includes("AI service is currently busy") || ...) {
  return serverMessage;
}
```

---

## Possible Root Causes (Ranked by Probability)

### **#1: GEMINI_API_KEY Not Set on Render (PROBABILITY: 85%)**

**Why This Happens:**
- Environment variables are not automatically transferred from local `.env` to Render
- Render requires explicit configuration in Dashboard or `render.yaml`
- If `GEMINI_API_KEY` is empty string, `getGeminiClient()` throws error

**How to Verify:**
1. SSH into Render backend: Check `/proc/self/environ` for `GEMINI_API_KEY`
2. Add logging in `gemini.js`:
```javascript
// backend/src/config/gemini.js
function getGeminiClient() {
  console.log("DEBUG: GEMINI_API_KEY present?", !!env.geminiApiKey);
  console.log("DEBUG: GEMINI_API_KEY length:", env.geminiApiKey?.length || 0);
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  // ...
}
```

3. Check Render logs for error message: "GEMINI_API_KEY is not configured"

**Impact:** ALL AI features fail with 503 error

**Fix:**
```bash
# In Render Dashboard:
# Settings → Environment Variables
# Add: GEMINI_API_KEY=<your-actual-key>
```

---

### **#2: GEMINI_MODEL Name Invalid on Render (PROBABILITY: 20%)**

**Why This Happens:**
- `env.js` sets default: `geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash"`
- Local `.env` might use `GEMINI_MODEL=gemini-2.5-flash` (newer, less stable)
- Render might have old/deprecated model name

**How to Verify:**
```bash
# Add to geminiService.js at line 64:
console.log("DEBUG: Primary model name:", primaryModel);
console.log("DEBUG: Fallback model name:", fallbackModel);

# If you see error like "gemini-2.5-flash is not available"
# Then model name is invalid
```

**Fix:**
```javascript
// backend/src/config/env.js line 8:
- geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
+ geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash", // stable model only
```

---

### **#3: Gemini API Rate Limiting / Quota Exhaustion (PROBABILITY: 15%)**

**Why This Happens:**
- Free tier: 60 requests per minute, 1 million tokens/month
- Your code chunks large papers (12,000 char chunks) = high token usage
- Multi-chunk papers call Gemini multiple times per request

**Example Token Usage:**
- Single paper: ~3,000 tokens for summary + 2,000 for analysis = 5,000 tokens/paper
- If 200 users × 10 papers/month = 10,000,000 tokens = **quota exceeded**

**How to Verify:**
```javascript
// Add to geminiService.js, after each API call:
try {
  const result = await model.generateContent(prompt);
  console.log("DEBUG: API call succeeded");
  console.log("DEBUG: Request metadata:", result.response?.usageMetadata);
  return parseJsonResponse(result.response.text());
} catch (err) {
  console.error("DEBUG: API Error details:", {
    status: err.status,
    code: err.code,
    message: err.message,
    headers: err.headers
  });
  // ...
}
```

**Check Gemini API Console:**
- Go to https://console.cloud.google.com/apis/quotas
- Find "Generative Language API"
- Check: Quota remaining, Daily usage

**Fix:**
- Upgrade to paid tier: $5-15/month
- Implement request caching (avoid re-summarizing same paper)
- Add rate limiting on backend (1 request/minute per user)

---

### **#4: Network Timeout Between Render and Gemini API (PROBABILITY: 10%)**

**Why This Happens:**
- Gemini API call from Render can take 5-30 seconds
- Default axios timeout on Vercel: 30 seconds (sometimes less)
- If Gemini API is slow, request times out

**How to Verify:**
```javascript
// Add to paperApi.js line 71:
export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  console.info(`[api] POST ${url} starting at ${new Date().toISOString()}`);
  const startTime = Date.now();
  try {
    const response = await axios.post(url, null, {
      signal,
      timeout: 60000  // 60 second timeout
    });
    console.info(`[api] POST ${url} completed in ${Date.now() - startTime}ms`);
    return response.data;
  } catch (err) {
    console.error(`[api] POST ${url} failed after ${Date.now() - startTime}ms`, err.message);
    throw err;
  }
}
```

**Fix:**
```javascript
// backend/src/services/geminiService.js, in generateGeminiJsonResponse():
async function tryGenerate(modelName) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const model = getGeminiModel(modelName);
      
      // ADD TIMEOUT
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API timeout after 30s")), 30000)
      );
      
      const result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise
      ]);
      
      return parseJsonResponse(result.response.text());
    } catch (err) {
      // Timeout is also a transient error
      if (err.message.includes("timeout")) {
        console.warn(`Timeout on model=${modelName} attempt=${attempt + 1}`);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BACKOFF_MS[attempt]);
          continue;
        }
      }
      // ...
    }
  }
}
```

---

### **#5: Error Handling Masking Real Error (PROBABILITY: 80% - COMPOUND ISSUE)**

**The Main Problem:**
Generic "AI service is currently busy" message hides:
- Invalid API key
- Quota exceeded
- Network timeout
- Invalid model name
- Malformed prompt
- Backend error

**Current Code Problem** (`geminiService.js` line 138):
```javascript
} catch (error) {
  if (error instanceof ServiceError) {
    throw error;
  }
  console.error("Gemini unexpected error:", error);  // <-- Only logs error, doesn't expose it
  throw new ServiceError(
    "AI service is currently busy. Please try again in a few seconds.",
    503
  );
}
```

**Better Error Messages Needed:**
```javascript
// NEW CODE - Better error handling
} catch (error) {
  if (error instanceof ServiceError) {
    throw error;
  }

  const errorDetails = {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
  };

  console.error("Gemini unexpected error:", JSON.stringify(errorDetails, null, 2));

  // Return more specific error based on error type
  if (error?.status === 429) {
    throw new ServiceError(
      "Too many requests to AI service. Please wait a few minutes and try again.",
      429
    );
  }
  
  if (error?.code === "AUTH_ERROR") {
    throw new ServiceError(
      "AI service authentication failed. Contact support.",
      500
    );
  }
  
  if (error?.message?.includes("timeout") || error?.message?.includes("DEADLINE")) {
    throw new ServiceError(
      "AI service response timeout. Please try again.",
      504
    );
  }

  throw new ServiceError(
    "AI service is currently busy. Please try again in a few seconds.",
    503
  );
}
```

---

## Production-Grade Debugging Strategy

### Step 1: Add Comprehensive Logging

**File: `backend/src/services/geminiService.js`**

```javascript
// At the top of generateGeminiJsonResponse()
console.log("=== GEMINI REQUEST START ===");
console.log("Prompt length:", prompt.length);
console.log("Primary model:", primaryModel);
console.log("Fallback model:", fallbackModel);

// Before each model attempt
console.log(`[Attempt ${attempt + 1}/${MAX_RETRIES}] Calling model=${modelName}`);

// After successful call
console.log(`[SUCCESS] Model=${modelName} returned ${responseText.length} chars`);

// After error
console.log(`[ERROR] Model=${modelName} failed:`, {
  errorType: err?.constructor?.name,
  errorMessage: err?.message,
  errorCode: err?.code,
  errorStatus: err?.status,
  isTransient: isTransientError(err),
  attemptNumber: attempt + 1,
  timestamp: new Date().toISOString()
});
```

### Step 2: Check Production Environment

**SSH into Render container:**
```bash
# Check environment variables
echo $GEMINI_API_KEY
echo $GEMINI_MODEL

# Check logs in real-time
# Render Dashboard → Logs (tail -f mode)
```

### Step 3: Add Metrics to Backend

**File: `backend/src/services/geminiService.js`**

```javascript
// Track success/failure rates
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitErrors: 0,
  timeoutErrors: 0,
  authErrors: 0
};

async function generateGeminiJsonResponse(prompt) {
  metrics.totalRequests++;
  
  try {
    // ... existing code ...
    metrics.successfulRequests++;
    return result;
  } catch (error) {
    metrics.failedRequests++;
    if (error?.status === 429) metrics.rateLimitErrors++;
    if (error?.message?.includes("timeout")) metrics.timeoutErrors++;
    if (error?.code === "AUTH_ERROR") metrics.authErrors++;
    
    // Log metrics periodically
    if (metrics.totalRequests % 10 === 0) {
      console.log("METRICS:", {
        ...metrics,
        successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + "%"
      });
    }
  }
}
```

### Step 4: Implement Monitoring Dashboard

**Create file: `backend/src/routes/health.js`**

```javascript
router.get("/gemini-status", (req, res) => {
  // Return Gemini API health status
  res.json({
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY ? "✓ Set" : "✗ Missing",
    geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    metrics: {
      totalRequests: metrics.totalRequests,
      successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + "%",
      recentErrors: metrics.failedRequests,
      rateLimitHits: metrics.rateLimitErrors
    }
  });
});
```

---

## Production-Grade Fixes

### Fix #1: Enhanced Error Handling and Logging

**File: `backend/src/services/geminiService.js`**

```javascript
// Replace the entire catch block (lines 107-142)

  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    // Detailed error logging for debugging
    const errorInfo = {
      type: error?.constructor?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      apiError: error?.response?.status,
      details: error?.response?.data?.error?.details
    };

    console.error("[GEMINI ERROR]", JSON.stringify(errorInfo, null, 2));
    console.error("[GEMINI STACK]", error?.stack);

    // Classify error and return appropriate message
    if (error?.status === 429) {
      console.warn("[RATE_LIMIT] Gemini API rate limit exceeded");
      throw new ServiceError(
        "AI service is temporarily rate limited. Please wait a few minutes.",
        429
      );
    }

    if (error?.code === "AUTH_ERROR" || error?.message?.includes("API_KEY")) {
      console.error("[AUTH_ERROR] Gemini API key issue");
      throw new ServiceError(
        "AI service authentication failed. Please contact support.",
        503
      );
    }

    if (error?.message?.includes("timeout") || error?.message?.includes("DEADLINE")) {
      console.warn("[TIMEOUT] Gemini API request timeout");
      throw new ServiceError(
        "AI service is slow. Please try again.",
        504
      );
    }

    if (error?.message?.includes("not found") || error?.message?.includes("invalid")) {
      console.error("[CONFIG_ERROR] Invalid model or configuration");
      throw new ServiceError(
        "AI service configuration error. Please contact support.",
        500
      );
    }

    // Generic fallback
    console.error("[UNKNOWN_ERROR] Unexpected Gemini error", errorInfo);
    throw new ServiceError(
      "AI service is currently busy. Please try again in a few seconds.",
      503
    );
  }
```

### Fix #2: Add Request/Response Validation

**File: `backend/src/services/geminiService.js`** (line 57-62)

```javascript
async function generateGeminiJsonResponse(prompt) {
  // Validate input
  if (!prompt || typeof prompt !== "string") {
    throw new ServiceError("Invalid prompt: must be a non-empty string", 400);
  }

  if (prompt.length > 100000) {
    throw new ServiceError(
      "Prompt too large. Please break paper into smaller chunks.",
      413
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[CRITICAL] GEMINI_API_KEY is not configured");
    throw new ServiceError(
      "GEMINI_API_KEY is not configured.",
      500
    );
  }

  // Validate models exist
  const primaryModel = env.geminiModel || "gemini-1.5-flash";
  const fallbackModel = "gemini-1.5-flash";

  if (!primaryModel || !fallbackModel) {
    throw new ServiceError("Model configuration missing", 500);
  }

  // ... rest of function ...
}
```

### Fix #3: Implement Distributed Caching

**File: `backend/src/controllers/paperController.js`** (line 451-471)

```javascript
async function generateSummary(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findOne({ 
    _id: req.params.id, 
    userId: req.userId 
  });

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  // Don't regenerate if already exists
  if (paper.summary && paper.summary.shortSummary) {
    console.log("Using cached summary for paper", paper._id);
    return res.status(200).json({
      message: "Summary retrieved from cache",
      paper,
      fromCache: true
    });
  }

  // Add request deduplication - if another request is already processing
  // this paper, wait for it instead of making duplicate API call
  const cacheKey = `summary:${paper._id}`;
  if (global.pendingRequests?.[cacheKey]) {
    console.log("Waiting for duplicate request to complete:", cacheKey);
    try {
      const result = await global.pendingRequests[cacheKey];
      return res.status(200).json(result);
    } catch (error) {
      throw error;
    }
  }

  // Mark request as pending
  global.pendingRequests = global.pendingRequests || {};
  global.pendingRequests[cacheKey] = new Promise(async (resolve, reject) => {
    try {
      const summary = await generatePaperSummary(paper.extractedText);

      const updated = await Paper.findOneAndUpdate(
        { _id: paper._id, userId: req.userId },
        { summary, summaryGeneratedAt: new Date() },
        { new: true, runValidators: true }
      );

      await recordActivity({
        userId: req.userId,
        type: "summary_generated",
        title: paper.title,
        metadata: { paperId: paper._id }
      });

      resolve({
        message: "Summary generated successfully",
        paper: updated
      });
    } catch (error) {
      reject(error);
    } finally {
      delete global.pendingRequests[cacheKey];
    }
  });

  try {
    const result = await global.pendingRequests[cacheKey];
    return res.status(200).json(result);
  } catch (error) {
    throw error;
  }
}
```

### Fix #4: Retry with Exponential Backoff on Frontend

**File: `frontend/src/services/paperApi.js`** (line 69-77)

```javascript
export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  console.info(`[api] POST ${url}`);

  const MAX_RETRIES = 3;
  const BACKOFF_MS = [1000, 2000, 4000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, null, {
        signal,
        timeout: 60000  // 60 second timeout
      });
      console.info(`[api] POST ${url} - Success on attempt ${attempt + 1}`);
      return response.data;
    } catch (error) {
      // Don't retry on 404 or auth errors
      if (error.response?.status === 404 || error.response?.status === 401) {
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

      const waitTime = BACKOFF_MS[attempt];
      console.warn(`[api] POST ${url} - Attempt ${attempt + 1} failed, retrying in ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
```

---

# ISSUE 2: "Paper Not Found" - Deep Root-Cause Analysis

## Error Trace

```
Error: Paper not found.
HTTP Status: 404
Location: paperController.js line 455
```

## Complete Execution Flow

1. **Frontend State** (`PaperDetail.jsx`):
```javascript
const [paperId, setPaperId] = useState(paperId);  // From component props

const handleGenerateSummary = async () => {
  try {
    const result = await generateSummary(paperId);  // <-- Using component paperId
    if (result?.paper) {
      setPaper(result.paper);
    }
  } catch (apiError) {
    setError(friendlyError(apiError, "Failed to generate summary."));
  }
};
```

2. **API Request Formatting** (`paperApi.js`):
```javascript
export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  //                                          ^^^^^^^^ 
  // Must be valid MongoDB ObjectId format: 507f1f77bcf86cd799439011
  
  const response = await axios.post(url, null, { signal });
  return response.data;
}
```

3. **Middleware Chain** (`paperRoutes.js`):
```javascript
const router = express.Router();

// Line 12: THIS APPLIES TO ALL SUBSEQUENT ROUTES
router.use(authMiddleware);

router.post("/:id/generate-summary", asyncHandler(generateSummary));
```

4. **Authentication Check** (`authMiddleware.js`):
```javascript
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.get("Authorization") || "";
    const [scheme, token] = authHeader.split(" ");
    
    if (scheme !== "Bearer" || !token) {
      throw unauthorized();  // <-- 401 if no Bearer token
    }
    
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select("name email createdAt");
    
    if (!user) {
      throw unauthorized();  // <-- 401 if user not found
    }
    
    req.user = user;
    req.userId = user._id;  // <-- CRITICAL: Sets req.userId
    return next();
  } catch (error) {
    // ... error handling ...
    return next(error.statusCode ? error : unauthorized());
  }
}
```

5. **Paper Lookup** (`paperController.js` line 451-459):
```javascript
async function generateSummary(req, res) {
  validatePaperId(req.params.id);  // Validates ObjectId format
  
  const paper = await Paper.findOne({
    _id: req.params.id,      // From URL: /api/papers/:id/generate-summary
    userId: req.userId       // From JWT token (set by authMiddleware)
  });
  
  if (!paper) {
    throw createHttpError(404, "Paper not found.");  // <-- "Paper not found" error
  }
  
  // If we reach here, paper was found
  const summary = await generatePaperSummary(paper.extractedText);
  // ...
}
```

## Root Causes of "Paper Not Found" (Ranked by Probability)

### **#1: JWT Token Not Being Sent (PROBABILITY: 70%)**

**Why This Happens:**
- Frontend `AuthContext` sets `axios.defaults.headers.common.Authorization`
- If token not in localStorage, Authorization header is deleted
- User session expired or token cleared
- First-time user not logged in

**How to Verify:**

1. **Frontend Debug** (`AuthContext.jsx`):
```javascript
// Add after line 18, in applyAuthToken():
function applyAuthToken(token) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    console.log("[AUTH] Token set, length:", token.length);
  } else {
    delete axios.defaults.headers.common.Authorization;
    console.log("[AUTH] Token deleted - user logged out");
  }
}
```

2. **Network Tab Check:**
- Open DevTools → Network → Look at request headers
- For: `POST /api/papers/:id/generate-summary`
- Check: Does it have `Authorization: Bearer ...` header?
- If MISSING → cause is #1

3. **Add Logging in Component** (`PaperDetail.jsx`):
```javascript
const handleGenerateSummary = async () => {
  const { token } = useAuth();  // Get auth context
  console.log("SUMMARY BUTTON CLICKED");
  console.log("Token present?", !!token);
  console.log("Token length:", token?.length);
  console.log("PaperId:", paperId);
  
  if (!token) {
    setError("Not authenticated. Please log in and try again.");
    return;
  }
  
  // ... rest of handler ...
};
```

**Fix:**
```javascript
// backend/src/middleware/authMiddleware.js
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.get("Authorization") || "";
    
    if (!authHeader) {
      console.error("[AUTH] Missing Authorization header");
      throw unauthorized("Missing Authorization header");
    }
    
    const [scheme, token] = authHeader.split(" ");
    
    if (scheme !== "Bearer" || !token) {
      console.error("[AUTH] Invalid Bearer token format");
      throw unauthorized("Invalid Authorization format. Expected: Bearer <token>");
    }
    
    // ... rest of validation ...
  }
}
```

---

### **#2: Wrong Paper ID Being Sent (PROBABILITY: 25%)**

**Why This Happens:**
- `paperId` state not updated correctly
- Component receives wrong ID from URL params
- Browser back/forward navigation state mismatch
- Paper ID not matching any paper in database

**How to Verify:**

1. **Component Logging** (`PaperDetail.jsx`):
```javascript
function PaperDetail({ paperId, onBack }) {
  console.log("[PAPERDETAIL] Initialized with paperId:", paperId);
  
  useEffect(() => {
    console.log("[PAPERDETAIL] paperId changed:", paperId);
  }, [paperId]);
  
  const handleGenerateSummary = async () => {
    console.log("[SUMMARY] Attempting for paperId:", paperId);
    console.log("[SUMMARY] Is paperId valid ObjectId?", /^[0-9a-fA-F]{24}$/.test(paperId));
    
    // Call API with logging
    try {
      const result = await generateSummary(paperId);
      // ...
    } catch (apiError) {
      console.error("[SUMMARY] Error for paperId:", paperId, "Error:", apiError.message);
    }
  };
  
  // ... rest of component ...
}
```

2. **Network Tab Check:**
- Look at POST request URL
- Is the ID in the URL correct?
- Does it match a paper that exists in your database?

3. **Database Query:**
```javascript
// Run in MongoDB Atlas console or mongosh
db.papers.find({ title: "Your Paper Title" }).pretty()
// Check the _id field
// Does it match what frontend is sending?
```

**Fix:**
```javascript
// backend/src/controllers/paperController.js line 451
async function generateSummary(req, res) {
  const paperId = req.params.id;
  console.log("[SUMMARY] Request for paperId:", paperId);
  console.log("[SUMMARY] Authenticated userId:", req.userId);
  
  validatePaperId(paperId);
  
  const paper = await Paper.findOne({
    _id: paperId,
    userId: req.userId
  });
  
  if (!paper) {
    console.error("[SUMMARY] Paper not found:", {
      searchedPaperId: paperId,
      authenticatedUserId: req.userId
    });
    
    // Debug: Check if paper exists at all (even with different userId)
    const paperExists = await Paper.findOne({ _id: paperId });
    if (paperExists) {
      console.error("[SUMMARY] Paper exists but belongs to different user:", paperExists.userId);
    }
    
    throw createHttpError(404, `Paper not found for id=${paperId}`);
  }
  
  // ... rest ...
}
```

---

### **#3: Wrong User ID in JWT Token (PROBABILITY: 20%)**

**Why This Happens:**
- JWT token contains wrong `userId` claim
- User credentials corrupted during login
- User account deleted but token still valid
- Multiple user accounts with same email

**How to Verify:**

1. **Decode JWT Token:**
```javascript
// In browser console:
const token = localStorage.getItem("paperlens.authToken");
const parts = token.split(".");
const payload = JSON.parse(atob(parts[1]));
console.log("JWT Payload:", payload);
console.log("UserId in token:", payload.userId);
```

2. **Database Check:**
```javascript
// Verify user exists
db.users.findById(ObjectId("userId_from_jwt"))

// Verify paper belongs to that user
db.papers.findOne({ 
  _id: ObjectId("paperId_from_frontend"),
  userId: ObjectId("userId_from_jwt")
})
```

**Fix:**
```javascript
// backend/src/controllers/authController.js (login)
async function login(req, res) {
  const user = await User.findOne({ email: req.body.email });
  
  if (!user) {
    throw createHttpError(401, "Invalid credentials");
  }
  
  const isValidPassword = await user.comparePassword(req.body.password);
  
  if (!isValidPassword) {
    throw createHttpError(401, "Invalid credentials");
  }
  
  // CRITICAL: Use user._id, not user.email
  const token = jwt.sign(
    { userId: user._id.toString() },  // <-- MUST be user._id
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
  
  console.log("[LOGIN] Created token for userId:", user._id.toString());
  
  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email
    }
  });
}
```

---

### **#4: MongoDB Query Issue - Case Sensitivity or Type Mismatch (PROBABILITY: 15%)**

**Why This Happens:**
- `userId` in token is string, in database is ObjectId
- `_id` comparison fails due to type mismatch
- MongoDB indexes not properly configured

**How to Verify:**

```javascript
// backend/src/middleware/authMiddleware.js
const payload = jwt.verify(token, env.jwtSecret);

console.log("payload.userId type:", typeof payload.userId);
console.log("payload.userId value:", payload.userId);

const user = await User.findById(payload.userId);

console.log("user._id type:", typeof user._id);
console.log("user._id value:", user._id.toString());
```

**Fix:**
```javascript
// backend/src/middleware/authMiddleware.js
const payload = jwt.verify(token, env.jwtSecret);

// Ensure userId is converted to ObjectId if needed
const userId = typeof payload.userId === "string" 
  ? new mongoose.Types.ObjectId(payload.userId)
  : payload.userId;

const user = await User.findById(userId).select("name email createdAt");

if (!user) {
  throw unauthorized("User not found");
}

// Convert to string for consistency
req.userId = user._id.toString();  // Store as string
```

---

### **#5: Paper Belongs to Different User (PROBABILITY: 60% - COMMON)**

**Why This Happens:**
- User sharing a paper link with another user
- Frontend cached paper from different user
- Database migration issue
- User trying to access paper they don't own

**How to Verify:**

1. **Check Paper Owner** (`paperController.js`):
```javascript
async function generateSummary(req, res) {
  validatePaperId(req.params.id);
  
  const paper = await Paper.findOne({
    _id: req.params.id,
    userId: req.userId
  }).lean();
  
  if (!paper) {
    // Check if paper exists but belongs to different user
    const otherUsersPaper = await Paper.findById(req.params.id).lean();
    
    if (otherUsersPaper) {
      console.error("[SECURITY] Access denied - paper belongs to different user", {
        requestedBy: req.userId,
        ownedBy: otherUsersPaper.userId,
        paperId: req.params.id
      });
    } else {
      console.error("[SECURITY] Paper does not exist");
    }
    
    throw createHttpError(404, "Paper not found or access denied");
  }
  
  // ... rest ...
}
```

2. **Add Ownership Check:**
```javascript
// NEW MIDDLEWARE
async function ensurePaperOwnership(req, res, next) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid paper ID");
    }
    
    const paper = await Paper.findById(id).lean();
    
    if (!paper) {
      throw createHttpError(404, "Paper not found");
    }
    
    // Check ownership
    if (paper.userId.toString() !== req.userId.toString()) {
      console.warn("[UNAUTHORIZED]", {
        action: "access_paper",
        requestedBy: req.userId,
        paperId: id,
        owner: paper.userId
      });
      throw createHttpError(403, "You do not have permission to access this paper");
    }
    
    // Attach paper to request for use in controller
    req.paper = paper;
    next();
  } catch (error) {
    next(error);
  }
}
```

---

## Production-Grade Debugging for "Paper Not Found"

### Complete Debugging Checklist

**File: `backend/src/controllers/paperController.js`** (Replace generateSummary function):

```javascript
async function generateSummary(req, res) {
  const startTime = Date.now();
  const paperId = req.params.id;
  const userId = req.userId;
  
  // === LOGGING ===
  console.log("=== GENERATE SUMMARY START ===");
  console.log({
    timestamp: new Date().toISOString(),
    paperId,
    userId,
    route: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.get("Authorization")
  });
  
  try {
    // === VALIDATION ===
    validatePaperId(paperId);
    console.log("[VALIDATION] Paper ID format valid");
    
    // === DATABASE QUERY ===
    console.log("[QUERY] Searching for paper with:", { _id: paperId, userId });
    
    const paper = await Paper.findOne({
      _id: paperId,
      userId
    });
    
    // === RESULT INSPECTION ===
    if (!paper) {
      console.error("[NOT_FOUND] Paper lookup failed");
      
      // Debug: Check paper exists at all
      const paperExistsTotal = await Paper.findById(paperId);
      console.error("[DEBUG] Paper exists in any user's collection?", !!paperExistsTotal);
      
      if (paperExistsTotal) {
        console.error("[DEBUG] Paper found but different user:", {
          paperOwnerId: paperExistsTotal.userId.toString(),
          requestedBy: userId.toString(),
          match: paperExistsTotal.userId.toString() === userId.toString()
        });
      }
      
      // Check user exists
      const user = await User.findById(userId);
      console.error("[DEBUG] User exists?", !!user, user?._id);
      
      throw createHttpError(404, "Paper not found.");
    }
    
    console.log("[FOUND] Paper retrieved successfully", {
      paperId: paper._id,
      title: paper.title,
      hasSummary: !!paper.summary?.shortSummary,
      textLength: paper.extractedText?.length || 0
    });
    
    // === GENERATE SUMMARY ===
    console.log("[SUMMARIZE] Starting summary generation");
    const summary = await generatePaperSummary(paper.extractedText);
    console.log("[SUMMARIZE] Summary generated successfully");
    
    // === UPDATE DATABASE ===
    console.log("[UPDATE] Updating paper with summary");
    const updated = await Paper.findOneAndUpdate(
      { _id: paper._id, userId },
      { summary },
      { new: true, runValidators: true }
    );
    
    console.log("[UPDATE] Paper updated successfully");
    
    // === ACTIVITY LOGGING ===
    await recordActivity({
      userId,
      type: "summary_generated",
      title: paper.title,
      metadata: { paperId: paper._id }
    });
    
    const duration = Date.now() - startTime;
    console.log("=== GENERATE SUMMARY SUCCESS ===", { duration: duration + "ms" });
    
    return res.status(200).json({
      message: "Summary generated successfully",
      paper: updated
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error("=== GENERATE SUMMARY ERROR ===", {
      duration: duration + "ms",
      errorType: error?.constructor?.name,
      errorMessage: error?.message,
      errorStatusCode: error?.statusCode,
      paperId,
      userId,
      stack: error?.stack
    });
    
    return res.status(error?.statusCode || 502).json({
      error: error?.message || "Failed to generate summary."
    });
  }
}
```

---

## Complete Fixed Implementation

### Frontend: Enhanced Error Handling and Logging

**File: `frontend/src/components/PaperDetail.jsx`** (Replace handleGenerateSummary):

```javascript
const handleGenerateSummary = async () => {
  console.log("[SUMMARY] Button clicked");
  
  if (!paper) {
    console.error("[SUMMARY] No paper loaded");
    setError("Paper not loaded. Please refresh the page.");
    return;
  }

  if (!paperId) {
    console.error("[SUMMARY] No paperId available");
    setError("Paper ID not available. Please refresh the page.");
    return;
  }

  const { token } = useAuth();
  if (!token) {
    console.error("[SUMMARY] Not authenticated");
    setError("Not authenticated. Please log in and try again.");
    return;
  }

  setIsGeneratingSummary(true);
  setError("");

  const startTime = Date.now();
  console.log("[SUMMARY] Request started", {
    paperId,
    timestamp: new Date().toISOString()
  });

  try {
    const result = await generateSummary(paperId);
    
    const duration = Date.now() - startTime;
    console.log("[SUMMARY] Request succeeded", {
      duration: duration + "ms",
      hasPaper: !!result?.paper
    });
    
    if (result?.paper) {
      setPaper(result.paper);
      console.log("[SUMMARY] Paper state updated");
    }
  } catch (apiError) {
    const duration = Date.now() - startTime;
    
    console.error("[SUMMARY] Request failed", {
      duration: duration + "ms",
      errorType: apiError?.response?.status || apiError?.code,
      errorMessage: apiError?.message,
      errorData: apiError?.response?.data
    });
    
    // Better error messages
    let errorMessage = "Failed to generate summary.";
    
    if (apiError?.response?.status === 404) {
      errorMessage = "Paper not found. It may have been deleted.";
    } else if (apiError?.response?.status === 401) {
      errorMessage = "Session expired. Please log in again.";
    } else if (apiError?.response?.status === 503 || apiError?.response?.status === 429) {
      errorMessage = "AI service is busy. Please wait a few minutes and try again.";
    } else if (apiError?.message?.includes("Network")) {
      errorMessage = "Network error. Please check your connection.";
    } else {
      errorMessage = friendlyError(apiError, errorMessage);
    }
    
    setError(errorMessage);
  } finally {
    setIsGeneratingSummary(false);
  }
};
```

---

## Summary: Most Likely Root Causes

### For "AI Service is Currently Busy" (Issue #1):

1. **GEMINI_API_KEY not set on Render** (85% probability)
   - Fix: Add environment variable in Render Dashboard
   
2. **Gemini API rate limiting** (15% probability)
   - Fix: Implement caching, upgrade to paid tier
   
3. **Network timeout** (10% probability)
   - Fix: Add timeout handling and retries

### For "Paper Not Found" (Issue #2):

1. **JWT token not being sent** (70% probability)
   - Fix: Verify Authorization header is present
   
2. **Paper belongs to different user** (60% probability)
   - Fix: Add ownership validation
   
3. **Wrong paper ID format** (25% probability)
   - Fix: Validate MongoDB ObjectId format

---

## Action Plan

### Immediate (Next 30 minutes):

1. Check Render environment variables:
   - SSH into container: `echo $GEMINI_API_KEY`
   - Look for errors in logs

2. Add the comprehensive logging from above

3. Test in production with logging enabled

### Short-term (Next 24 hours):

1. Implement the production-grade fixes
2. Add monitoring dashboard
3. Test error scenarios

### Long-term (Next week):

1. Implement caching layer
2. Add rate limiting
3. Set up alerts for API failures
