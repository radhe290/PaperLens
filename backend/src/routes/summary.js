const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { generateSummary } = require("../controllers/summaryController");

const router = express.Router();

router.post("/", asyncHandler(generateSummary));

module.exports = router;