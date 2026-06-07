const fs = require("fs");
const pdfParse = require("pdf-parse");
const express = require("express");
const upload = require("../config/multer");

const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const parsed = await pdfParse(dataBuffer);

    return res.json({
      message: "Upload successful",
      filename: req.file.filename,
      text: parsed.text
    });
  } catch (error) {
    console.error("PDF parse error:", error);
    return res.status(500).json({ error: "Failed to extract PDF text." });
  }
});

module.exports = router;
