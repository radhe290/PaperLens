const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        "pdf_uploaded",
        "paper_summarized",
        "paper_analyzed",
        "paper_deleted",
        "chat_completed",
        "export_generated",
        "login",
        "registration"
      ],
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    versionKey: false
  }
);

activitySchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model("Activity", activitySchema);
