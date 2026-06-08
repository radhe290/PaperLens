const { generatePaperSummary } = require("../services/geminiService");
const { recordActivity } = require("../services/activityService");

async function generateSummary(req, res) {
  const { text } = req.body;
  const title =
    typeof req.body.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : "Paper summary";
  try {
    const summary = await generatePaperSummary(text);
    await recordActivity({
      userId: req.userId,
      type: "paper_summarized",
      title,
      metadata: {
        keyContributionCount: summary.keyContributions?.length || 0
      }
    });

    return res.status(200).json({
      message: "Summary generated successfully",
      summary
    });
  } catch (error) {
    console.error("generateSummary error:", error);

    const message =
      error?.message === "AI service is currently busy. Please try again in a few seconds." ||
      error?.statusCode === 503
        ? "AI service is currently busy. Please try again in a few seconds."
        : "Failed to generate summary. Please try again.";

    return res.status(error?.statusCode || 502).json({ error: message });
  }
}

module.exports = {
  generateSummary
};
