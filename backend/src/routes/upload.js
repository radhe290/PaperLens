const pdfParse = require("pdf-parse");
const express = require("express");
const upload = require("../config/multer");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");
const { recordActivity } = require("../services/activityService");
const { uploadPdf } = require("../services/cloudinaryUploadService");

const router = express.Router();

router.post("/upload", authMiddleware, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const dataBuffer = req.file.buffer;
    const parsed = await pdfParse(dataBuffer);
    const cloudFile = await uploadPdf(req.file);
    await recordActivity({
      userId: req.userId,
      type: "pdf_uploaded",
      title: req.file.originalname,
      metadata: {
        cloudinaryPublicId: cloudFile.cloudinaryPublicId,
        fileSize: cloudFile.fileSize,
        pageCount: parsed.numpages || 0,
        wordCount: (parsed.text || "").trim().split(/\s+/).filter(Boolean).length
      }
    });

    return res.json({
      message: "Upload successful",
      originalFilename: req.file.originalname,
      filename: cloudFile.cloudinaryPublicId,
      storedFilename: cloudFile.cloudinaryPublicId,
      cloudinaryPublicId: cloudFile.cloudinaryPublicId,
      secureUrl: cloudFile.secureUrl,
      fileUrl: cloudFile.fileUrl,
      fileSize: cloudFile.fileSize,
      uploadDate: cloudFile.uploadDate,
      text: parsed.text,
      pageCount: parsed.numpages || 0,
      wordCount: (parsed.text || "").trim().split(/\s+/).filter(Boolean).length
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    console.error("PDF upload/parse error:", error);
    const parseError = new Error("Failed to extract PDF text from this file.");
    parseError.statusCode = 500;
    throw parseError;
  }
}));

module.exports = router;
