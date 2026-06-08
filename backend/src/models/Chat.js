const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant"]
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    sources: {
      type: [
        {
          chunkId: Number,
          page: Number,
          snippet: String
        }
      ],
      default: []
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
      index: true
    },
    messages: {
      type: [chatMessageSchema],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

chatSchema.pre("save", function () {
  this.updatedAt = new Date();
});

chatSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() });
});

chatSchema.index({ userId: 1, paperId: 1 }, { unique: true });
chatSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
