const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const { generateSummary } = require("../controllers/summaryController");

const router = express.Router();

router.post("/", authMiddleware, asyncHandler(generateSummary));

module.exports = router;
