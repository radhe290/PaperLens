const { analyzePaper } = require("../services/analysisService");

async function analyzePaperController(req, res) {
  const { paperText } = req.body;
  const analysis = await analyzePaper(paperText);

  return res.status(200).json({
    message: "Paper analysis generated successfully",
    ...analysis
  });
}

module.exports = {
  analyzePaperController
};