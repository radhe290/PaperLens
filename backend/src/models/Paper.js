const mongoose = require("mongoose");

const paperSchema = new mongoose.Schema(
  {
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
      required: true,
      trim: true
    },
    extractedText: {
      type: String,
      required: true
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
paperSchema.index({ title: 1 });
paperSchema.index({ originalFilename: 1 });

module.exports = mongoose.model("Paper", paperSchema);
