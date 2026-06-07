const { getGeminiModel } = require("../config/gemini");

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

  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return parseJsonResponse(responseText);
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new ServiceError("Gemini returned malformed JSON.", 502);
    }

    throw new ServiceError(
      error.message || "Failed to generate content from Gemini.",
      502
    );
  }
}

async function generatePaperSummary(paperText) {
  if (!paperText || !paperText.trim()) {
    throw new ServiceError("Paper text is required for summarization.", 400);
  }

  try {
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
      throw new ServiceError("Gemini returned an incomplete summary.", 502);
    }

    return {
      shortSummary: response.shortSummary.trim(),
      keyContributions: normalizeStringArray(response.keyContributions),
      beginnerFriendlyExplanation: response.beginnerFriendlyExplanation.trim()
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
        throw new ServiceError("Gemini returned malformed JSON.", 502);
    }

    throw new ServiceError(
      error.message || "Failed to generate summary from Gemini.",
      502
    );
  }
}

module.exports = {
  ServiceError,
  generateGeminiJsonResponse,
  generatePaperSummary
}