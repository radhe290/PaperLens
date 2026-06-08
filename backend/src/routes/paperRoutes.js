const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const {
  savePaper,
  getAllPapers,
  getPaperById,
  deletePaper,
  exportPaper,
  updatePaperAnalysis
} = require("../controllers/paperController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", asyncHandler(savePaper));
router.get("/", asyncHandler(getAllPapers));
router.get("/:id", asyncHandler(getPaperById));
router.get("/:id/export", asyncHandler(exportPaper));
router.delete("/:id", asyncHandler(deletePaper));
router.put("/:id", asyncHandler(updatePaperAnalysis));

module.exports = router;
