const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { analyzePaperController } = require("../controllers/analysisController");

const router = express.Router();

router.post("/", asyncHandler(analyzePaperController));

module.exports = router;