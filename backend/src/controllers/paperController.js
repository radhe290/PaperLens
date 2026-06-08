const mongoose = require("mongoose");
const Paper = require("../models/Paper");
const { deletePdf } = require("../services/cloudinaryUploadService");
const { recordActivity } = require("../services/activityService");

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

function escapePdfString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\x00-\x1f\x7f-\uffff]/g, "?");
}

function buildExportFilename(paper, format) {
  const safeTitle = String(paper.title || "paperlens-export")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeTitle || "paperlens-export"}.${format}`;
}

function buildExportHeader(paper) {
  const uploadDate = paper.uploadDate
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(paper.uploadDate))
    : "Not available";

  return {
    title: paper.title || "Untitled Paper",
    originalFilename: paper.originalFilename || "Unknown file",
    uploadDate
  };
}

function generateMarkdownExport(paper) {
  const header = buildExportHeader(paper);
  const lines = [
    `# ${header.title}`,
    "",
    `- Original file: ${header.originalFilename}`,
    `- Uploaded: ${header.uploadDate}`,
    "",
    "## Summary",
    "",
    paper.summary?.shortSummary || "No summary available.",
    "",
    "### Key Contributions",
    "",
    ...(paper.summary?.keyContributions?.length
      ? paper.summary.keyContributions.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "### Beginner-Friendly Explanation",
    "",
    paper.summary?.beginnerFriendlyExplanation || "No explanation available.",
    "",
    "## Analysis",
    "",
    `- Domain: ${paper.analysis?.domain || "Not available"}`,
    `- Subdomain: ${paper.analysis?.subdomain || "Not available"}`,
    `- Difficulty: ${paper.analysis?.difficulty || "Not available"}`,
    `- Estimated reading time: ${paper.analysis?.estimatedReadingTime || "Not available"}`,
    "",
    "### Concepts",
    "",
    ...(paper.analysis?.concepts?.length
      ? paper.analysis.concepts.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "### Prerequisites",
    "",
    ...(paper.analysis?.prerequisites?.length
      ? paper.analysis.prerequisites.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "### Learning Path",
    "",
    ...(paper.analysis?.learningPath?.length
      ? paper.analysis.learningPath.map((item, index) => `${index + 1}. ${item}`)
      : ["- None"]),
    ""
  ];

  return lines.join("\n");
}

function generateTextExport(paper) {
  const header = buildExportHeader(paper);
  const lines = [
    `Title: ${header.title}`,
    `Original file: ${header.originalFilename}`,
    `Uploaded: ${header.uploadDate}`,
    "",
    "SUMMARY",
    "----------",
    paper.summary?.shortSummary || "No summary available.",
    "",
    "Key Contributions:",
    ...(paper.summary?.keyContributions?.length
      ? paper.summary.keyContributions.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "Beginner-Friendly Explanation:",
    paper.summary?.beginnerFriendlyExplanation || "No explanation available.",
    "",
    "ANALYSIS",
    "--------",
    `Domain: ${paper.analysis?.domain || "Not available"}`,
    `Subdomain: ${paper.analysis?.subdomain || "Not available"}`,
    `Difficulty: ${paper.analysis?.difficulty || "Not available"}`,
    `Estimated reading time: ${paper.analysis?.estimatedReadingTime || "Not available"}`,
    "",
    "Concepts:",
    ...(paper.analysis?.concepts?.length
      ? paper.analysis.concepts.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "Prerequisites:",
    ...(paper.analysis?.prerequisites?.length
      ? paper.analysis.prerequisites.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "Learning Path:",
    ...(paper.analysis?.learningPath?.length
      ? paper.analysis.learningPath.map((item, index) => `${index + 1}. ${item}`)
      : ["- None"]),
    ""
  ];

  return lines.join("\n");
}

function createPdfBuffer(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => escapePdfString(line));

  const contentLines = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    "14 TL",
    ...lines.reduce((result, line, index) => {
      result.push(`(${line}) Tj`);
      if (index < lines.length - 1) {
        result.push("T*");
      }
      return result;
    }, []),
    "ET"
  ].join("\n");

  const contentStream = `<< /Length ${Buffer.byteLength(contentLines, "utf8")} >>\nstream\n${contentLines}\nendstream`;

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n${contentStream}\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  ];

  let offset = 0;
  const offsets = objects.map((obj) => {
    const current = offset;
    offset += Buffer.byteLength(obj, "utf8");
    return current;
  });

  const xrefHeader = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((value) => String(value).padStart(10, "0") + " 00000 n \n")
    .join("")}`;

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  const pdfContent = objects.join("") + xrefHeader + trailer;
  return Buffer.from(pdfContent, "utf8");
}

async function exportPaper(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findOne({ _id: req.params.id, userId: req.userId }).lean();

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  const format = String(req.query.format || "markdown").toLowerCase();
  const supportedFormats = new Set(["pdf", "markdown", "text"]);

  if (!supportedFormats.has(format)) {
    throw createHttpError(400, "Unsupported export format.");
  }

  await recordActivity({
    userId: req.userId,
    type: "export_generated",
    title: paper.title,
    metadata: {
      paperId: paper._id,
      format
    }
  });

  const filename = buildExportFilename(paper, format);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  if (format === "pdf") {
    const content = createPdfBuffer(generateMarkdownExport(paper));
    res.type("application/pdf").send(content);
    return;
  }

  const body = format === "text" ? generateTextExport(paper) : generateMarkdownExport(paper);
  const mimeType = format === "text" ? "text/plain" : "text/markdown";

  res.type(mimeType).send(body);
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

function countWords(text) {
  if (typeof text !== "string") {
    return 0;
  }

  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function buildPaperPayload(body, userId) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const originalFilename =
    typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
  const storedFilename =
    typeof body.storedFilename === "string" ? body.storedFilename.trim() : "";
  const cloudinaryPublicId =
    typeof body.cloudinaryPublicId === "string"
      ? body.cloudinaryPublicId.trim()
      : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  const extractedText =
    typeof body.extractedText === "string" ? body.extractedText.trim() : "";

  if (!title) {
    throw createHttpError(400, "Title is required.");
  }

  if (!originalFilename) {
    throw createHttpError(400, "Original filename is required.");
  }

  if (!extractedText) {
    throw createHttpError(400, "Extracted text is required.");
  }

  const wordCount = normalizeNonNegativeNumber(
    body.wordCount,
    countWords(extractedText)
  );

  return {
    userId,
    title,
    originalFilename,
    storedFilename,
    cloudinaryPublicId,
    fileUrl,
    fileSize: normalizeNonNegativeNumber(body.fileSize),
    extractedText,
    pageCount: normalizeNonNegativeNumber(body.pageCount),
    wordCount,
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
  const paper = await Paper.create(buildPaperPayload(req.body, req.userId));

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
  const query = { userId: req.userId };

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    query.$or = [{ title: searchRegex }, { originalFilename: searchRegex }];
  }

  const skip = (page - 1) * limit;

  const analysisGeneratedQuery = {
    $or: [
      { "analysis.domain": { $exists: true, $ne: "" } },
      { "analysis.subdomain": { $exists: true, $ne: "" } },
      { "analysis.difficulty": { $exists: true, $ne: "" } },
      { "analysis.concepts.0": { $exists: true } },
      { "analysis.prerequisites.0": { $exists: true } },
      { "analysis.learningPath.0": { $exists: true } }
    ]
  };

  const [papers, total, totalPapers, totalSummariesGenerated, totalAnalysesGenerated, mostRecentPaper] = await Promise.all([
    Paper.find(query)
      .select(
        "title originalFilename cloudinaryPublicId fileUrl fileSize uploadDate lastUpdated pageCount wordCount summary.shortSummary summary.keyContributions analysis.domain analysis.difficulty"
      )
      .sort(getPaperSort(sort))
      .collation({ locale: "en", strength: 2 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Paper.countDocuments(query),
    Paper.countDocuments({ userId: req.userId }),
    Paper.countDocuments({
      userId: req.userId,
      "summary.shortSummary": { $exists: true, $ne: "" }
    }),
    Paper.countDocuments({ userId: req.userId, ...analysisGeneratedQuery }),
    Paper.findOne({ userId: req.userId })
      .select("uploadDate")
      .sort({ uploadDate: -1, _id: -1 })
      .lean()
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
    },
    stats: {
      totalPapers,
      totalSummariesGenerated,
      totalAnalysesGenerated,
      mostRecentUploadDate: mostRecentPaper?.uploadDate || null
    }
  });
}

async function getPaperById(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findOne({ _id: req.params.id, userId: req.userId });

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  return res.status(200).json({ paper });
}

async function deletePaper(req, res) {
  validatePaperId(req.params.id);

  const paper = await Paper.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  if (paper.cloudinaryPublicId) {
    await deletePdf(paper.cloudinaryPublicId);
  }

  await Paper.deleteOne({ _id: paper._id, userId: req.userId });
  await recordActivity({
    userId: req.userId,
    type: "paper_deleted",
    title: paper.title,
    metadata: {
      paperId: paper._id,
      originalFilename: paper.originalFilename,
      cloudinaryPublicId: paper.cloudinaryPublicId || ""
    }
  });

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

  const paper = await Paper.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    update,
    {
      new: true,
      runValidators: true
    }
  );

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
  exportPaper,
  updatePaperAnalysis
};
