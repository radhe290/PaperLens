const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const { getAnalytics } = require("../controllers/analyticsController");

const router = express.Router();

router.get("/", authMiddleware, asyncHandler(getAnalytics));

module.exports = router;
