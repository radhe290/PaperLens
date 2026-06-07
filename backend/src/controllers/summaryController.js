const { generatePaperSummary } = require("../services/geminiService");

async function generateSummary(req, res) {
  const { text } = req.body;
  const summary = await generatePaperSummary(text);

  return res.status(200).json({
    message: "Summary generated successfully",
    summary
  });
}

module.exports = {
  generateSummary
};