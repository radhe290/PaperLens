# AI PROVIDERS IMPLEMENTATION GUIDE

## Overview

This guide shows how to implement a robust multi-provider AI system with automatic fallback.

## File: backend/src/services/aiProviders.js (NEW FILE)

Create this new file with multi-provider support:

```javascript
const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");

const anthropic = env.anthropicApiKey
  ? new Anthropic({ apiKey: env.anthropicApiKey })
  : null;

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

const genai = env.geminiApiKey
  ? new GoogleGenerativeAI(env.geminiApiKey)
  : null;

class AIProviderError extends Error {
  constructor(provider, originalError, statusCode = 500) {
    super(`${provider} failed: ${originalError.message}`);
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

/**
 * Generate summary with automatic fallback
 * Priority: Claude → OpenAI → Gemini
 */
async function generateSummaryWithFallback(text) {
  const providers = [];

  // Build provider list based on configuration
  if (anthropic) {
    providers.push({
      name: "Claude 3.5 Sonnet",
      fn: () => generateSummaryClaude(text)
    });
  }

  if (openai) {
    providers.push({
      name: "OpenAI GPT-4 Turbo",
      fn: () => generateSummaryOpenAI(text)
    });
  }

  if (genai) {
    providers.push({
      name: "Google Gemini 1.5 Flash",
      fn: () => generateSummaryGemini(text)
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY"
    );
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`[AI] Attempting ${provider.name}...`);
      const result = await provider.fn();
      console.log(`[AI] ✓ ${provider.name} succeeded`);
      return result;
    } catch (error) {
      lastError = new AIProviderError(provider.name, error);
      console.error(`[AI] ✗ ${provider.name} failed:`, error.message);

      // If it's a rate limit error, try next provider
      if (error.status === 429 || error.statusCode === 429) {
        console.log(`[AI] Rate limited by ${provider.name}, trying next provider...`);
        continue;
      }

      // If it's an auth error, try next provider
      if (error.status === 401 || error.statusCode === 401) {
        console.log(`[AI] Auth failed for ${provider.name}, trying next provider...`);
        continue;
      }

      // Other errors, also try next
      continue;
    }
  }

  // All providers failed
  throw lastError || new Error("All AI providers failed");
}

/**
 * Generate analysis with automatic fallback
 * Priority: Claude → OpenAI → Gemini
 */
async function generateAnalysisWithFallback(text) {
  const providers = [];

  if (anthropic) {
    providers.push({
      name: "Claude 3.5 Sonnet",
      fn: () => generateAnalysisClaude(text)
    });
  }

  if (openai) {
    providers.push({
      name: "OpenAI GPT-4 Turbo",
      fn: () => generateAnalysisOpenAI(text)
    });
  }

  if (genai) {
    providers.push({
      name: "Google Gemini 1.5 Flash",
      fn: () => generateAnalysisGemini(text)
    });
  }

  if (providers.length === 0) {
    throw new Error("No AI providers configured");
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`[AI] Attempting ${provider.name}...`);
      const result = await provider.fn();
      console.log(`[AI] ✓ ${provider.name} succeeded`);
      return result;
    } catch (error) {
      lastError = new AIProviderError(provider.name, error);
      console.error(`[AI] ✗ ${provider.name} failed:`, error.message);
      continue;
    }
  }

  throw lastError || new Error("All AI providers failed");
}

// ==================== CLAUDE IMPLEMENTATION ====================

async function generateSummaryClaude(text) {
  if (!anthropic) {
    throw new Error("Claude not configured. Set ANTHROPIC_API_KEY");
  }

  // Chunk text if too long (Claude: 200K tokens limit)
  const chunks = chunkText(text, 100000);

  if (chunks.length > 1) {
    console.log(`[Claude] Text too long, processing ${chunks.length} chunks`);
  }

  const summaries = [];

  for (let i = 0; i < chunks.length; i++) {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Summarize this academic paper text in 3 parts:\n\n1. Short Summary (2-3 sentences)\n2. Key Contributions (3-4 bullet points)\n3. Beginner-Friendly Explanation (1 paragraph)\n\nPaper text (part ${i + 1}/${chunks.length}):\n\n${chunks[i]}`
        }
      ]
    });

    const content = message.content[0];
    if (content.type === "text") {
      summaries.push(content.text);
    }
  }

  return parseSummaryResponse(summaries.join("\n\n"));
}

async function generateAnalysisClaude(text) {
  if (!anthropic) {
    throw new Error("Claude not configured. Set ANTHROPIC_API_KEY");
  }

  const chunks = chunkText(text, 100000);

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Analyze this academic paper and provide:\n\n1. Concepts (list of key concepts, 5-7 items)\n2. Prerequisites (background knowledge needed, 3-5 items)\n3. Domain (field like "Machine Learning", "Biology", etc.)\n4. Subdomain (more specific area)\n5. Difficulty (one of: "Beginner", "Intermediate", "Advanced", "Expert")\n6. Estimated Reading Time (in minutes)\n7. Learning Path (topics to study before this, 3-5 items)\n\nFormat response as JSON.\n\nPaper text:\n\n${chunks[0]}`
      }
    ]
  });

  const content = message.content[0];
  if (content.type === "text") {
    return parseAnalysisResponse(content.text);
  }

  throw new Error("Unexpected Claude response format");
}

// ==================== OPENAI IMPLEMENTATION ====================

async function generateSummaryOpenAI(text) {
  if (!openai) {
    throw new Error("OpenAI not configured. Set OPENAI_API_KEY");
  }

  const chunks = chunkText(text, 50000);

  const summaries = [];

  for (let i = 0; i < chunks.length; i++) {
    const message = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Summarize this academic paper text in 3 parts:\n\n1. Short Summary (2-3 sentences)\n2. Key Contributions (3-4 bullet points)\n3. Beginner-Friendly Explanation (1 paragraph)\n\nPaper text (part ${i + 1}/${chunks.length}):\n\n${chunks[i]}`
        }
      ]
    });

    if (message.choices[0]?.message?.content) {
      summaries.push(message.choices[0].message.content);
    }
  }

  return parseSummaryResponse(summaries.join("\n\n"));
}

async function generateAnalysisOpenAI(text) {
  if (!openai) {
    throw new Error("OpenAI not configured. Set OPENAI_API_KEY");
  }

  const chunks = chunkText(text, 50000);

  const message = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `Analyze this academic paper and provide a JSON object with:\n- concepts: array of strings\n- prerequisites: array of strings\n- domain: string\n- subdomain: string\n- difficulty: one of "Beginner", "Intermediate", "Advanced", "Expert"\n- estimatedReadingTime: number (minutes)\n- learningPath: array of strings\n\nPaper text:\n\n${chunks[0]}`
      }
    ]
  });

  if (message.choices[0]?.message?.content) {
    return parseAnalysisResponse(message.choices[0].message.content);
  }

  throw new Error("Unexpected OpenAI response format");
}

// ==================== GEMINI IMPLEMENTATION ====================

async function generateSummaryGemini(text) {
  if (!genai) {
    throw new Error("Gemini not configured. Set GEMINI_API_KEY");
  }

  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chunks = chunkText(text, 100000);

  const summaries = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await model.generateContent(
      `Summarize this academic paper text in 3 parts:\n\n1. Short Summary (2-3 sentences)\n2. Key Contributions (3-4 bullet points)\n3. Beginner-Friendly Explanation (1 paragraph)\n\nPaper text (part ${i + 1}/${chunks.length}):\n\n${chunks[i]}`
    );

    const response = await result.response;
    summaries.push(response.text());
  }

  return parseSummaryResponse(summaries.join("\n\n"));
}

async function generateAnalysisGemini(text) {
  if (!genai) {
    throw new Error("Gemini not configured. Set GEMINI_API_KEY");
  }

  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chunks = chunkText(text, 100000);

  const result = await model.generateContent(
    `Analyze this academic paper and provide a JSON object with:\n- concepts: array of strings\n- prerequisites: array of strings\n- domain: string\n- subdomain: string\n- difficulty: one of "Beginner", "Intermediate", "Advanced", "Expert"\n- estimatedReadingTime: number (minutes)\n- learningPath: array of strings\n\nPaper text:\n\n${chunks[0]}`
  );

  const response = await result.response;
  return parseAnalysisResponse(response.text());
}

// ==================== HELPER FUNCTIONS ====================

function chunkText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = "";

  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function parseSummaryResponse(text) {
  // Extract sections from response text
  const shortMatch = text.match(/Short Summary[:\s]+(.+?)(?=Key Contributions|$)/is);
  const keyMatch = text.match(/Key Contributions[:\s]+(.+?)(?=Beginner|$)/is);
  const beginnerMatch = text.match(/Beginner[:\s]+(.+?)$/is);

  return {
    shortSummary: shortMatch ? shortMatch[1].trim() : "",
    keyContributions: keyMatch
      ? keyMatch[1]
          .split(/[-•*]\s+/)
          .map(k => k.trim())
          .filter(Boolean)
      : [],
    beginnerFriendlyExplanation: beginnerMatch ? beginnerMatch[1].trim() : ""
  };
}

function parseAnalysisResponse(text) {
  // Try to parse as JSON first
  try {
    return JSON.parse(text);
  } catch (e) {
    // If not JSON, extract fields from text
    console.log("[AI] Response not JSON format, attempting text parsing");
    return {
      concepts: [],
      prerequisites: [],
      domain: "Unknown",
      subdomain: "Unknown",
      difficulty: "Intermediate",
      estimatedReadingTime: 30,
      learningPath: []
    };
  }
}

module.exports = {
  generateSummaryWithFallback,
  generateAnalysisWithFallback,
  AIProviderError
};
```

---

## File: Update backend/src/config/env.js

Add these fields:

```javascript
const env = {
  // ... existing fields ...
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4-turbo"
};
```

---

## File: Update backend/src/services/geminiService.js

Replace contents with:

```javascript
const { generateSummaryWithFallback, generateAnalysisWithFallback } = require("./aiProviders");

async function generatePaperSummary(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("Paper text is empty");
  }

  return generateSummaryWithFallback(text);
}

async function analyzePaper(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("Paper text is empty");
  }

  return generateAnalysisWithFallback(text);
}

module.exports = {
  generatePaperSummary,
  analyzePaper
};
```

---

## Installation

```bash
cd backend

# Install new providers
npm install @anthropic-ai/sdk openai

# Verify installation
npm list @anthropic-ai/sdk openai
```

---

## Testing

```bash
# Test which providers are available
curl https://your-backend.render.com/api/papers/health

# Should show:
# "Claude available: true"
# "OpenAI available: true"
# "Gemini available: true"
```

---

## Fallback Behavior

1. **Primary provider fails** → Try secondary provider
2. **Rate limited** → Try next provider immediately
3. **Auth error** → Try next provider
4. **All fail** → Return error with list of attempted providers

