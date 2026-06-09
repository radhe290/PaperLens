const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const {
  savePaper,
  getAllPapers,
  getPaperById,
  deletePaper,
  exportPaper,
  updatePaperAnalysis,
  generateSummary,
  generateAnalysis
} = require("../controllers/paperController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", asyncHandler(savePaper));
router.get("/", asyncHandler(getAllPapers));
router.get("/:id", asyncHandler(getPaperById));
router.get("/:id/export", asyncHandler(exportPaper));
router.post("/:id/generate-summary", asyncHandler(generateSummary));
router.post("/:id/generate-analysis", asyncHandler(generateAnalysis));
// Alternate paths accepted by some clients: /api/papers/summary/:id and /api/papers/analyze/:id
router.post("/summary/:id", asyncHandler(generateSummary));
router.post("/analyze/:id", asyncHandler(generateAnalysis));
router.delete("/:id", asyncHandler(deletePaper));
router.put("/:id", asyncHandler(updatePaperAnalysis));

module.exports = router;
