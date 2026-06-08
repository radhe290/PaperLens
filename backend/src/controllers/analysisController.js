const { analyzePaper } = require("../services/analysisService");
const { recordActivity } = require("../services/activityService");

async function analyzePaperController(req, res) {
  const { paperText } = req.body;
  const title =
    typeof req.body.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : "Paper analysis";
  try {
    const analysis = await analyzePaper(paperText);
    await recordActivity({
      userId: req.userId,
      type: "paper_analyzed",
      title,
      metadata: {
        domain: analysis.domain || "",
        difficulty: analysis.difficulty || "",
        conceptCount: analysis.concepts?.length || 0
      }
    });

    return res.status(200).json({
      message: "Paper analysis generated successfully",
      ...analysis
    });
  } catch (error) {
    console.error("analyzePaperController error:", error);
    const message = error?.statusCode === 503 ? "AI service is currently busy. Please try again in a few seconds." : "Failed to generate analysis. Please try again.";
    return res.status(error?.statusCode || 502).json({ error: message });
  }
}

module.exports = {
  analyzePaperController
};
