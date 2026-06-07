const mongoose = require("mongoose");
const Paper = require("../models/Paper");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePaperId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, "Invalid paper id.");
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInteger(value, fallback, maxValue) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maxValue);
}

function getPaperSort(sort) {
  const sortOptions = {
    newest: { uploadDate: -1, _id: -1 },
    oldest: { uploadDate: 1, _id: 1 },
    "title-asc": { title: 1, originalFilename: 1, _id: 1 },
    "title-desc": { title: -1, originalFilename: -1, _id: -1 }
  };

  return sortOptions[sort] || sortOptions.newest;
}

function getPaperSortValue(sort) {
  const validSorts = ["newest", "oldest", "title-asc", "title-desc"];
  return validSorts.includes(sort) ? sort : "newest";
}

function buildPaperPayload(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const originalFilename =
    typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
  const storedFilename =
    typeof body.storedFilename === "string" ? body.storedFilename.trim() : "";
  const extractedText =
    typeof body.extractedText === "string" ? body.extractedText.trim() : "";

  if (!title) {
    throw createHttpError(400, "Title is required.");
  }

  if (!originalFilename) {
    throw createHttpError(400, "Original filename is required.");
  }

  if (!storedFilename) {
    throw createHttpError(400, "Stored filename is required.");
  }

  if (!extractedText) {
    throw createHttpError(400, "Extracted text is required.");
  }

  return {
    title,
    originalFilename,
    storedFilename,
    extractedText,
    summary: {
      shortSummary: body.summary?.shortSummary || "",
      keyContributions: normalizeStringArray(body.summary?.keyContributions),
      beginnerFriendlyExplanation: body.summary?.beginnerFriendlyExplanation || ""
    },
    analysis: {
      concepts: normalizeStringArray(body.analysis?.concepts),
      prerequisites: normalizeStringArray(body.analysis?.prerequisites),
      domain: body.analysis?.domain || "",
      subdomain: body.analysis?.subdomain || "",
      difficulty: body.analysis?.difficulty || "",
      estimatedReadingTime: body.analysis?.estimatedReadingTime || "",
      learningPath: normalizeStringArray(body.analysis?.learningPath)
    }
  };
}

async function savePaper(req, res) {
  const paper = await Paper.create(buildPaperPayload(req.body));

  return res.status(201).json({
    message: "Paper saved successfully",
    paper
  });
}

async function getAllPapers(req, res) {
  const page = parsePositiveInteger(req.query.page, 1, 100000);
  const limit = parsePositiveInteger(req.query.limit, 12, 50);
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sort = getPaperSortValue(req.query.sort);
  const query = {};

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    query.$or = [{ title: searchRegex }, { originalFilename: searchRegex }];
  }

  const skip = (page - 1) * limit;

  const [papers, total] = await Promise.all([
    Paper.find(query)
      .select(
        "title originalFilename uploadDate lastUpdated summary.shortSummary summary.keyContributions analysis.domain analysis.difficulty"
      )
      .sort(getPaperSort(sort))
      .collation({ locale: "en", strength: 2 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Paper.countDocuments(query)
  ]);

  return res.status(200).json({
    papers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + papers.length < total,
      hasPreviousPage: page > 1
    },
    filters: {
      search,
      sort
    }
  });
}

async function getPaperById(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findById(req.params.id);

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  return res.status(200).json({ paper });
}

async function deletePaper(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findByIdAndDelete(req.params.id);

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  return res.status(200).json({
    message: "Paper deleted successfully",
    paperId: req.params.id
  });
}

async function updatePaperAnalysis(req, res) {
  validatePaperId(req.params.id);

  const update = {};

  if (req.body.summary) {
    update.summary = {
      shortSummary: req.body.summary.shortSummary || "",
      keyContributions: normalizeStringArray(req.body.summary.keyContributions),
      beginnerFriendlyExplanation:
        req.body.summary.beginnerFriendlyExplanation || ""
    };
  }

  if (req.body.analysis) {
    update.analysis = {
      concepts: normalizeStringArray(req.body.analysis.concepts),
      prerequisites: normalizeStringArray(req.body.analysis.prerequisites),
      domain: req.body.analysis.domain || "",
      subdomain: req.body.analysis.subdomain || "",
      difficulty: req.body.analysis.difficulty || "",
      estimatedReadingTime: req.body.analysis.estimatedReadingTime || "",
      learningPath: normalizeStringArray(req.body.analysis.learningPath)
    };
  }

  if (Object.keys(update).length === 0) {
    throw createHttpError(400, "Summary or analysis payload is required.");
  }

  const paper = await Paper.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true
  });

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  return res.status(200).json({
    message: "Paper analysis updated successfully",
    paper
  });
}

module.exports = {
  savePaper,
  getAllPapers,
  getPaperById,
  deletePaper,
  updatePaperAnalysis
};
