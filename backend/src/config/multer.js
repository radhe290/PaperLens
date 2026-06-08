const multer = require("multer");

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

const storage = multer.memoryStorage();

const pdfOnly = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed."));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter: pdfOnly,
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES
  }
});

module.exports = upload;
