function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.message === "Only PDF files are allowed.") {
    return res.status(400).json({ error: err.message });
  }

  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "PDF files must be 20MB or smaller."
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
