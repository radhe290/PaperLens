const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createActivity,
  getActivities
} = require("../controllers/activityController");

const router = express.Router();

router.get("/", authMiddleware, asyncHandler(getActivities));
router.post("/", authMiddleware, asyncHandler(createActivity));

module.exports = router;
