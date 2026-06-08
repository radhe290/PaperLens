const { getGeminiModel } = require("../config/gemini");
const env = require("../config/env");
class ServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

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
  if (!process.env.GEMINI_API_KEY) {
    throw new ServiceError("GEMINI_API_KEY is not configured.", 500);
  }
  // Retry and fallback configuration
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [2000, 4000, 6000];
  const primaryModel = env.geminiModel || "gemini-2.5-flash";
  const fallbackModel = "gemini-1.5-flash";

  function isTransientError(err) {
    const msg = String(err?.message || "").toLowerCase();
    if (err?.status === 503) return true;
    if (msg.includes("503") || msg.includes("service unavailable") || msg.includes("high demand")) return true;
    return false;
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Try generating using a specific model with retries
  async function tryGenerate(modelName) {
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const model = getGeminiModel(modelName);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.info(`Gemini: model=${modelName} succeeded on attempt=${attempt + 1}`);
        return parseJsonResponse(responseText || "");
      } catch (err) {
        lastError = err;
        console.warn(`Gemini attempt ${attempt + 1} failed for model=${modelName}:`, err?.message || err);

        // If not transient, stop retrying
        if (!isTransientError(err)) break;

        // Wait before next retry if any
        if (attempt < MAX_RETRIES - 1) {
          const wait = BACKOFF_MS[attempt] || BACKOFF_MS[BACKOFF_MS.length - 1];
          console.info(`Gemini: retrying model=${modelName} after ${wait}ms`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(wait);
        }
      }
    }

    // throw the last error to be handled by caller
    throw lastError || new Error("Failed to generate content from Gemini.");
  }

  // First try primary model, then fallback model
  try {
    try {
      const resp = await tryGenerate(primaryModel);
      return resp;
    } catch (primaryErr) {
      console.warn(`Primary Gemini model ${primaryModel} failed: ${primaryErr?.message || primaryErr}`);
      // Attempt fallback only for transient scenarios
      if (isTransientError(primaryErr)) {
        try {
          const resp = await tryGenerate(fallbackModel);
          console.info(`Gemini: falling back to model=${fallbackModel}`);
          return resp;
        } catch (fallbackErr) {
          console.error(`Fallback Gemini model ${fallbackModel} also failed: ${fallbackErr?.message || fallbackErr}`);
          // Throw a friendly error
          throw new ServiceError("AI service is currently busy. Please try again in a few seconds.", 503);
        }
      }

      // Non-transient primary error
      throw new ServiceError("Failed to generate content. Please try again.", 502);
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    console.error("Gemini unexpected error:", error);
    throw new ServiceError("AI service is currently busy. Please try again in a few seconds.", 503);
  }
}

async function generatePaperSummary(paperText) {
  if (!paperText || !paperText.trim()) {
    throw new ServiceError("Paper text is required for summarization.", 400);
  }
  try {
    // If text is large, chunk it to avoid token overload
    const MAX_CHUNK_CHARS = 12000; // conservative character limit per chunk
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

    // Multi-chunk flow: summarize each chunk, then combine
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

    // Combine chunk summaries into final prompt
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

module.exports = {
  ServiceError,
  generateGeminiJsonResponse,
  generatePaperSummary
}