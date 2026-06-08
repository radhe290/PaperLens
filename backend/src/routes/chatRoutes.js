const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const {
  askPaperQuestion,
  getChatHistory
} = require("../controllers/chatController");

const router = express.Router();

router.use(authMiddleware);

router.get("/:paperId", asyncHandler(getChatHistory));
router.post("/:paperId", asyncHandler(askPaperQuestion));

module.exports = router;
