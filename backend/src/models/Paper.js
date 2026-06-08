const mongoose = require("mongoose");

const paperSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true
    },
    storedFilename: {
      type: String,
      trim: true,
      default: ""
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: ""
    },
    fileUrl: {
      type: String,
      trim: true,
      default: ""
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0
    },
    extractedText: {
      type: String,
      required: true
    },
    pageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0
    },
    summary: {
      shortSummary: {
        type: String,
        default: ""
      },
      keyContributions: {
        type: [String],
        default: []
      },
      beginnerFriendlyExplanation: {
        type: String,
        default: ""
      }
    },
    analysis: {
      concepts: {
        type: [String],
        default: []
      },
      prerequisites: {
        type: [String],
        default: []
      },
      domain: {
        type: String,
        default: ""
      },
      subdomain: {
        type: String,
        default: ""
      },
      difficulty: {
        type: String,
        default: ""
      },
      estimatedReadingTime: {
        type: String,
        default: ""
      },
      learningPath: {
        type: [String],
        default: []
      }
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

paperSchema.pre("save", function () {
  this.lastUpdated = new Date();
});

paperSchema.pre("findOneAndUpdate", function () {
  this.set({ lastUpdated: new Date() });
});

paperSchema.index({ uploadDate: -1 });
paperSchema.index({ userId: 1, uploadDate: -1 });
paperSchema.index({ title: 1 });
paperSchema.index({ originalFilename: 1 });
paperSchema.index({ cloudinaryPublicId: 1 });

module.exports = mongoose.model("Paper", paperSchema);
