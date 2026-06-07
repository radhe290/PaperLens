const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const {
  savePaper,
  getAllPapers,
  getPaperById,
  deletePaper,
  updatePaperAnalysis
} = require("../controllers/paperController");

const router = express.Router();

router.post("/", asyncHandler(savePaper));
router.get("/", asyncHandler(getAllPapers));
router.get("/:id", asyncHandler(getPaperById));
router.delete("/:id", asyncHandler(deletePaper));
router.put("/:id", asyncHandler(updatePaperAnalysis));

module.exports = router;
