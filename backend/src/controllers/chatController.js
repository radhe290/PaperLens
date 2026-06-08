const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const Paper = require("../models/Paper");
const { answerQuestionFromPaper } = require("../services/chatService");
const { recordActivity } = require("../services/activityService");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePaperId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, "Invalid paper id.");
  }
}

async function findOwnedPaper(paperId, userId) {
  validatePaperId(paperId);

  const paper = await Paper.findOne({ _id: paperId, userId }).select(
    "title extractedText pageCount"
  );

  if (!paper) {
    throw createHttpError(404, "Paper not found.");
  }

  return paper;
}

async function getChatHistory(req, res) {
  const paper = await findOwnedPaper(req.params.paperId, req.userId);
  const chat = await Chat.findOne({
    userId: req.userId,
    paperId: paper._id
  }).lean();

  return res.status(200).json({
    paper: {
      _id: paper._id,
      title: paper.title
    },
    messages: chat?.messages || []
  });
}

async function askPaperQuestion(req, res) {
  const question =
    typeof req.body.question === "string" ? req.body.question.trim() : "";

  if (!question) {
    throw createHttpError(400, "Please enter a question before sending.");
  }

  const paper = await findOwnedPaper(req.params.paperId, req.userId);

  if (!paper.extractedText || !paper.extractedText.trim()) {
    throw createHttpError(
      400,
      "This paper does not have extracted text available for chat."
    );
  }

  try {
    const result = await answerQuestionFromPaper({
      paperText: paper.extractedText,
      pageCount: paper.pageCount,
      question
    });
  const now = new Date();
  const userMessage = {
    role: "user",
    content: question,
    timestamp: now
  };
  const assistantMessage = {
    role: "assistant",
    content: result.answer,
    sources: result.sources,
    timestamp: now
  };

  await Chat.findOneAndUpdate(
    {
      userId: req.userId,
      paperId: paper._id
    },
    {
      $setOnInsert: {
        userId: req.userId,
        paperId: paper._id,
        createdAt: now
      },
      $push: {
        messages: {
          $each: [userMessage, assistantMessage]
        }
      },
      $set: {
        updatedAt: now
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );
  await recordActivity({
    userId: req.userId,
    type: "chat_completed",
    title: paper.title,
    metadata: {
      paperId: paper._id,
      question,
      sourceCount: result.sources?.length || 0
    }
  });

  return res.status(200).json({
    answer: result.answer,
    sources: result.sources,
    selectedChunks: result.selectedChunks,
    messages: [userMessage, assistantMessage]
  });
  } catch (error) {
    console.error("askPaperQuestion error:", error);
    const message = error?.statusCode === 503 ? "AI service is currently busy. Please try again in a few seconds." : (error?.message || "Failed to answer question. Please try again.");
    return res.status(error?.statusCode || 502).json({ error: message });
  }
}

module.exports = {
  askPaperQuestion,
  getChatHistory
};
