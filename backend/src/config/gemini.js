const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("./env");

let geminiClient;

function getGeminiClient() {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }

  return geminiClient;
}

function getGeminiModel(modelName = null) {
  const model = modelName || env.geminiModel || "gemini-1.5-flash";
  return getGeminiClient().getGenerativeModel({
    model
  });
}

module.exports = {
  getGeminiModel
};