/**
 * CRITICAL FIXES FOR GEMINI SERVICE
 * 
 * This file contains production-grade error handling and logging
 * for the Gemini API integration.
 * 
 * Changes from original:
 * 1. Enhanced error classification with specific messages
 * 2. Comprehensive logging for debugging
 * 3. Better distinction between transient and permanent errors
 * 4. Request validation
 * 5. Metrics tracking
 */

const { getGeminiModel } = require("../config/gemini");
const env = require("../config/env");

class ServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

// Metrics tracking
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

function stripJsonCodeFence(content) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonResponse(responseText) {
  const cleanedText = stripJsonCodeFence(responseText);
  const jsonStart = cleanedText.indexOf("{");
  const jsonEnd = cleanedText.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new ServiceError("Gemini returned an invalid JSON format.", 502);
  }

  return JSON.parse(cleanedText.slice(jsonStart, jsonEnd + 1));
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((item) => String(item).trim()).filter(Boolean);
}

function parseSummaryResponse(responseText) {
  const summary = parseJsonResponse(responseText);

  if (
    typeof summary.shortSummary !== "string" ||
    !Array.isArray(summary.keyContributions) ||
    typeof summary.beginnerFriendlyExplanation !== "string"
  ) {
    throw new ServiceError("Gemini returned an incomplete summary.", 502);
  }

  return {
    shortSummary: summary.shortSummary.trim(),
    keyContributions: normalizeStringArray(summary.keyContributions),
    beginnerFriendlyExplanation: summary.beginnerFriendlyExplanation.trim()
  };
}

async function generateGeminiJsonResponse(prompt) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  metrics.totalRequests++;

  console.log(`[GEMINI-${requestId}] Request started at ${new Date().toISOString()}`);
  
  // VALIDATE INPUT
  if (!prompt || typeof prompt !== "string") {
    throw new ServiceError("Invalid prompt: must be a non-empty string", 400);
  }

  if (prompt.length > 100000) {
    throw new ServiceError("Prompt too large (max 100KB). Break paper into smaller chunks.", 413);
  }

  // CHECK API KEY
  if (!process.env.GEMINI_API_KEY) {
    console.error("[GEMINI] CRITICAL: GEMINI_API_KEY is not set");
    metrics.authErrors++;
    metrics.failedRequests++;
    throw new ServiceError("GEMINI_API_KEY is not configured. Contact admin.", 500);
  }

  if (process.env.GEMINI_API_KEY.length < 10) {
    console.error("[GEMINI] CRITICAL: GEMINI_API_KEY is too short (invalid)");
    metrics.authErrors++;
    metrics.failedRequests++;
    throw new ServiceError("GEMINI_API_KEY is invalid. Contact admin.", 500);
  }

  console.log(`[GEMINI-${requestId}] API key configured (length: ${process.env.GEMINI_API_KEY.length})`);

  // GET MODEL NAMES
  const primaryModel = env.geminiModel || "gemini-1.5-flash";
  const fallbackModel = "gemini-1.5-flash";

  console.log(`[GEMINI-${requestId}] Primary model: ${primaryModel}, Fallback: ${fallbackModel}`);

  function isTransientError(err) {
    const msg = String(err?.message || "").toLowerCase();
    const status = err?.status;
    
    console.log(`[GEMINI-${requestId}] Error analysis:`, {
      status,
      message: err?.message,
      isTransient: status === 503 || msg.includes("503") || msg.includes("service unavailable") || msg.includes("high demand") || msg.includes("timeout") || msg.includes("deadline")
    });

    if (status === 503 || status === 429 || status === 504) return true;
    if (msg.includes("503") || msg.includes("service unavailable") || msg.includes("high demand")) return true;
    if (msg.includes("timeout") || msg.includes("deadline") || msg.includes("deadline exceeded")) return true;
    
    return false;
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function tryGenerate(modelName) {
    let lastError = null;
    const MAX_RETRIES = 3;
    const BACKOFF_MS = [2000, 4000, 6000];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[GEMINI-${requestId}] Attempt ${attempt + 1}/${MAX_RETRIES} with model: ${modelName}`);
        
        const model = getGeminiModel(modelName);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const duration = Date.now() - startTime;
        console.log(`[GEMINI-${requestId}] ✓ SUCCESS on attempt ${attempt + 1}, model=${modelName}, duration=${duration}ms`);
        
        metrics.successfulRequests++;
        return parseJsonResponse(responseText || "");
        
      } catch (err) {
        lastError = err;
        const duration = Date.now() - startTime;
        const transient = isTransientError(err);
        
        console.warn(`[GEMINI-${requestId}] ✗ FAILED attempt ${attempt + 1}/${MAX_RETRIES}, model=${modelName}:`, {
          duration: duration + "ms",
          errorType: err?.constructor?.name,
          errorMessage: err?.message,
          errorCode: err?.code,
          errorStatus: err?.status,
          isTransient: transient
        });

        // If not transient, stop retrying immediately
        if (!transient) {
          console.error(`[GEMINI-${requestId}] Non-transient error, stopping retries`);
          break;
        }

        // Wait before next retry if any
        if (attempt < MAX_RETRIES - 1) {
          const wait = BACKOFF_MS[attempt];
          console.info(`[GEMINI-${requestId}] Retrying after ${wait}ms...`);
          await sleep(wait);
        }
      }
    }

    throw lastError || new Error("Failed to generate content from Gemini.");
  }

  // EXECUTE WITH PRIMARY MODEL, THEN FALLBACK
  try {
    try {
      console.log(`[GEMINI-${requestId}] Trying PRIMARY model`);
      const resp = await tryGenerate(primaryModel);
      return resp;
    } catch (primaryErr) {
      const duration = Date.now() - startTime;
      console.warn(`[GEMINI-${requestId}] Primary model failed after ${duration}ms:`, {
        message: primaryErr?.message,
        isTransient: isTransientError(primaryErr)
      });

      // Only fallback for transient errors
      if (isTransientError(primaryErr)) {
        try {
          console.log(`[GEMINI-${requestId}] Trying FALLBACK model`);
          const resp = await tryGenerate(fallbackModel);
          const duration = Date.now() - startTime;
          console.info(`[GEMINI-${requestId}] ✓ Fallback succeeded after ${duration}ms`);
          return resp;
        } catch (fallbackErr) {
          const duration = Date.now() - startTime;
          console.error(`[GEMINI-${requestId}] ✗ Fallback also failed after ${duration}ms`);
          console.error(`[GEMINI-${requestId}] Fallback error:`, {
            message: fallbackErr?.message,
            status: fallbackErr?.status,
            code: fallbackErr?.code
          });

          metrics.failedRequests++;
          metrics.lastErrorTime = new Date().toISOString();
          metrics.lastErrorMessage = fallbackErr?.message;

          throw new ServiceError(
            "AI service is currently busy. Please try again in a few seconds.",
            503
          );
        }
      }

      // Non-transient primary error
      metrics.failedRequests++;
      throw new ServiceError("Failed to generate content. Please try again.", 502);
    }
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
    console.error(`[GEMINI-${requestId}] Stack:`, error?.stack);

    // Classify the error more specifically
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
}

async function generatePaperSummary(paperText) {
  if (!paperText || !paperText.trim()) {
    throw new ServiceError("Paper text is required for summarization.", 400);
  }
  
  try {
    const MAX_CHUNK_CHARS = 12000;
    const OVERLAP_CHARS = 300;

    function chunkText(text) {
      const chunks = [];
      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + MAX_CHUNK_CHARS, text.length);
        const chunk = text.slice(start, end);
        chunks.push(chunk);
        if (end === text.length) break;
        start = end - OVERLAP_CHARS;
      }
      return chunks;
    }

    const chunks = chunkText(paperText);

    if (chunks.length === 1) {
      const prompt = `You summarize academic papers for students.

Return ONLY valid JSON with this exact structure:
{
  "shortSummary": "100-150 words, concise and accurate.",
  "keyContributions": ["bullet 1", "bullet 2", "bullet 3"],
  "beginnerFriendlyExplanation": "simple explanation with no jargon."
}

Rules:
- Keep shortSummary between 100 and 150 words.
- keyContributions must be 3 to 5 short bullet points.
- beginnerFriendlyExplanation should be easy for a non-expert to understand.
- Do not add markdown fences, headings, or extra commentary.

Paper text:
${paperText}`;

      const response = await generateGeminiJsonResponse(prompt);

      if (
        typeof response.shortSummary !== "string" ||
        !Array.isArray(response.keyContributions) ||
        typeof response.beginnerFriendlyExplanation !== "string"
      ) {
        throw new ServiceError("AI returned an incomplete summary.", 502);
      }

      return {
        shortSummary: response.shortSummary.trim(),
        keyContributions: normalizeStringArray(response.keyContributions),
        beginnerFriendlyExplanation: response.beginnerFriendlyExplanation.trim()
      };
    }

    // Multi-chunk flow
    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `You summarize the following excerpt from an academic paper into a short JSON fragment with keys: shortSummary (30-60 words) and keyContributions (1-2 bullets).

Return ONLY valid JSON.

Excerpt:
${chunks[i]}`;

      // eslint-disable-next-line no-await-in-loop
      const chunkResp = await generateGeminiJsonResponse(chunkPrompt);
      const short = (chunkResp.shortSummary || "").trim();
      const keys = normalizeStringArray(chunkResp.keyContributions || []);

      chunkSummaries.push({ short, keys });
    }

    const combinedShorts = chunkSummaries.map((c, idx) => `Chunk ${idx + 1}: ${c.short}`).join('\n\n');
    const combinedKeys = chunkSummaries.flatMap((c) => c.keys).slice(0, 15);

    const finalPrompt = `You are given multiple short summaries from parts of an academic paper. Produce the final JSON with the structure:
{
  "shortSummary": "100-150 words",
  "keyContributions": ["3-5 concise bullets"],
  "beginnerFriendlyExplanation": "simple explanation"
}

Combine the following fragment summaries into a single coherent final summary. When aggregating key contributions, deduplicate and return the top 5 most important items.

Fragments:
${combinedShorts}

Candidate contributions:
${combinedKeys.join('\n')}`;

    const finalResp = await generateGeminiJsonResponse(finalPrompt);

    if (
      typeof finalResp.shortSummary !== "string" ||
      !Array.isArray(finalResp.keyContributions) ||
      typeof finalResp.beginnerFriendlyExplanation !== "string"
    ) {
      throw new ServiceError("AI returned an incomplete summary.", 502);
    }

    return {
      shortSummary: finalResp.shortSummary.trim(),
      keyContributions: normalizeStringArray(finalResp.keyContributions).slice(0, 5),
      beginnerFriendlyExplanation: finalResp.beginnerFriendlyExplanation.trim()
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    console.error("generatePaperSummary error:", error);
    throw new ServiceError(
      "AI service is currently busy. Please try again in a few seconds.",
      503
    );
  }
}

// Export metrics for monitoring
function getMetrics() {
  const successRate = metrics.totalRequests > 0 
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : "N/A";

  return {
    ...metrics,
    successRate: successRate + "%",
    uptime: "OK"
  };
}

module.exports = {
  ServiceError,
  generateGeminiJsonResponse,
  generatePaperSummary,
  getMetrics
};
