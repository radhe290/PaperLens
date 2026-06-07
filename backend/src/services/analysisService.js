const {
  ServiceError,
  generateGeminiJsonResponse
} = require("./geminiService");

function ensureTextInput(paperText) {
  if (!paperText || !paperText.trim()) {
    throw new ServiceError("Paper text is required for analysis.", 400);
  }
}

function normalizeAnalysisResponse(response) {
  const concepts = Array.isArray(response.concepts) ? response.concepts : [];
  const prerequisites = Array.isArray(response.prerequisites)
    ? response.prerequisites
    : [];
  const learningPath = Array.isArray(response.learningPath)
    ? response.learningPath
    : [];
  const domain = response.domain && typeof response.domain === "object" ? response.domain : {};
  const difficulty =
    response.difficulty && typeof response.difficulty === "object"
      ? response.difficulty
      : {};

  if (
    concepts.length === 0 ||
    prerequisites.length === 0 ||
    learningPath.length === 0 ||
    typeof domain.domain !== "string" ||
    typeof domain.subdomain !== "string" ||
    typeof difficulty.difficulty !== "string" ||
    typeof difficulty.estimatedReadingTime !== "string"
  ) {
    throw new ServiceError("Gemini returned an incomplete analysis.", 502);
  }

  return {
    concepts: concepts.map((item) => String(item).trim()).filter(Boolean),
    prerequisites: prerequisites.map((item) => String(item).trim()).filter(Boolean),
    domain: domain.domain.trim(),
    subdomain: domain.subdomain.trim(),
    difficulty: difficulty.difficulty.trim(),
    estimatedReadingTime: difficulty.estimatedReadingTime.trim(),
    learningPath: learningPath.map((item) => String(item).trim()).filter(Boolean)
  };
}

async function analyzePaper(paperText) {
  ensureTextInput(paperText);

  const prompt = `You analyze research papers for students before they read them.

Return ONLY valid JSON with this exact structure:
{
  "concepts": ["5-10 important concepts"],
  "prerequisites": ["3-8 prerequisite topics"],
  "domain": {
    "domain": "Broad research area",
    "subdomain": "Specific subfield"
  },
  "difficulty": {
    "difficulty": "Beginner | Intermediate | Advanced",
    "estimatedReadingTime": "25 minutes"
  },
  "learningPath": [
    "step 1: what to learn first",
    "step 2: what to review next",
    "step 3: how to prepare for the paper"
  ]
}

Rules:
- Return 5 to 10 concepts.
- Return 3 to 8 prerequisites.
- Make the domain and subdomain specific and concise.
- Use only one of Beginner, Intermediate, or Advanced for difficulty.
- estimatedReadingTime should be a human-readable time estimate.
- learningPath must contain exactly 3 short, practical steps.
- Do not add markdown fences, headings, or extra commentary.

Paper text:
${paperText}`;

  const response = await generateGeminiJsonResponse(prompt);

  return normalizeAnalysisResponse(response);
}

module.exports = {
  analyzePaper
};