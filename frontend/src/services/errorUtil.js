export function friendlyError(error, fallback = "An error occurred. Please try again.") {
  const serverMessage = error?.response?.data?.error;
  const rawMessage = error?.message;

  if (serverMessage && typeof serverMessage === "string") {
    // Known friendly messages from backend
    if (serverMessage.includes("AI service is currently busy") || serverMessage.includes("Failed to generate")) {
      return serverMessage;
    }

    // Otherwise, avoid exposing raw server errors that may contain stack traces/URLs
    return serverMessage;
  }

  if (rawMessage && typeof rawMessage === "string") {
    // Map common transient network errors
    if (rawMessage.includes("Network Error") || rawMessage.includes("timeout")) {
      return "Network error. Please check your connection and try again.";
    }

    // Avoid exposing vendor errors like GoogleGenerativeAI
    if (rawMessage.toLowerCase().includes("googlegenerativeai") || rawMessage.toLowerCase().includes("generativelanguage")) {
      return "AI service is currently busy. Please try again in a few seconds.";
    }

    return rawMessage;
  }

  return fallback;
}
