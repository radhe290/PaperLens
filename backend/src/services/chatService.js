const { ServiceError, generateGeminiJsonResponse } = require("./geminiService");

const CHUNK_WORD_SIZE = 220;
const CHUNK_WORD_OVERLAP = 45;
const MAX_CONTEXT_CHUNKS = 5;
const MAX_SNIPPET_LENGTH = 280;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "this",
  "that",
  "than",
  "then",
  "them",
  "they",
  "their",
  "there",
  "these",
  "those",
  "from",
  "have",
  "into",
  "paper",
  "study",
  "using",
  "used",
  "does",
  "show",
  "find",
  "findings"
]);

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getQuestionTerms(question) {
  return normalizeWhitespace(question)
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((term) => !STOP_WORDS.has(term)) || [];
}

function estimatePageForChunk(index, totalChunks, pageCount) {
  if (!pageCount || !totalChunks) {
    return null;
  }

  return Math.min(
    pageCount,
    Math.max(1, Math.ceil(((index + 1) / totalChunks) * pageCount))
  );
}

function splitPaperIntoChunks(text, pageCount = 0) {
  const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const chunks = [];
  const step = Math.max(CHUNK_WORD_SIZE - CHUNK_WORD_OVERLAP, 1);

  for (let start = 0; start < words.length; start += step) {
    const chunkWords = words.slice(start, start + CHUNK_WORD_SIZE);

    if (chunkWords.length === 0) {
      break;
    }

    chunks.push({
      chunkId: chunks.length + 1,
      text: chunkWords.join(" "),
      wordStart: start
    });

    if (start + CHUNK_WORD_SIZE >= words.length) {
      break;
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    page: estimatePageForChunk(index, chunks.length, pageCount)
  }));
}

function scoreChunk(chunk, terms) {
  if (terms.length === 0) {
    return 0;
  }

  const chunkText = chunk.text.toLowerCase();
  return terms.reduce((score, term) => {
    const matches = chunkText.match(new RegExp(`\\b${term}\\b`, "g"));
    return score + (matches ? matches.length : 0);
  }, 0);
}

function selectRelevantChunks(chunks, question) {
  const terms = getQuestionTerms(question);
  const rankedChunks = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, terms)
    }))
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.chunkId - second.chunkId;
    });

  const relevantChunks = rankedChunks.filter((chunk) => chunk.score > 0);
  const selected = relevantChunks.length > 0 ? relevantChunks : rankedChunks;

  return selected.slice(0, MAX_CONTEXT_CHUNKS);
}

function makeSnippet(text) {
  const normalized = normalizeWhitespace(text);

  if (normalized.length <= MAX_SNIPPET_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SNIPPET_LENGTH).trim()}...`;
}

function buildSourcePayload(chunks) {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    page: chunk.page,
    snippet: makeSnippet(chunk.text)
  }));
}

function buildPrompt({ question, chunks }) {
  const paperContent = chunks
    .map((chunk) => {
      const pageLabel = chunk.page ? `Page ${chunk.page}` : "Page unavailable";
      return `[Chunk ${chunk.chunkId} | ${pageLabel}]\n${chunk.text}`;
    })
    .join("\n\n");

  return `You are a research assistant.

Answer ONLY using the provided paper content.

Return ONLY valid JSON with this exact structure:
{
  "answer": "Concise answer grounded in the paper content.",
  "sources": [
    {
      "chunkId": 1,
      "page": 1,
      "snippet": "Relevant supporting text from the source chunk."
    }
  ]
}

Rules:
- If the paper content does not contain enough evidence, say that the paper content provided does not answer the question.
- Do not use outside knowledge.
- Keep the answer concise and accurate.
- Include only sources that support the answer.
- The snippet must be copied or tightly paraphrased from the provided chunk.

Paper Content:
${paperContent}

Question:
${question}`;
}

function normalizeSources(sources, selectedSources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return selectedSources;
  }

  const sourceByChunkId = new Map(
    selectedSources.map((source) => [Number(source.chunkId), source])
  );

  return sources
    .map((source) => {
      const fallback = sourceByChunkId.get(Number(source.chunkId));

      if (!fallback) {
        return null;
      }

      return {
        chunkId: fallback.chunkId,
        page: Number.isFinite(Number(source.page))
          ? Number(source.page)
          : fallback.page,
        snippet:
          typeof source.snippet === "string" && source.snippet.trim()
            ? makeSnippet(source.snippet)
            : fallback.snippet
      };
    })
    .filter(Boolean);
}

async function answerQuestionFromPaper({ paperText, pageCount, question }) {
  const chunks = splitPaperIntoChunks(paperText, pageCount);

  if (chunks.length === 0) {
    throw new ServiceError("This paper does not have extracted text to chat with.", 400);
  }

  const selectedChunks = selectRelevantChunks(chunks, question);
  const fallbackSources = buildSourcePayload(selectedChunks);
  const response = await generateGeminiJsonResponse(
    buildPrompt({ question, chunks: selectedChunks })
  );

  if (typeof response.answer !== "string" || !response.answer.trim()) {
    throw new ServiceError("Gemini returned an incomplete chat answer.", 502);
  }

  return {
    answer: response.answer.trim(),
    sources: normalizeSources(response.sources, fallbackSources),
    selectedChunks: fallbackSources
  };
}

module.exports = {
  answerQuestionFromPaper,
  selectRelevantChunks,
  splitPaperIntoChunks
};
