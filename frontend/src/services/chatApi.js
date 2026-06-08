import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchChatHistory(paperId, { signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/chat/${paperId}`, {
    signal
  });
  return response.data;
}

export async function askPaperQuestion(paperId, question, { signal } = {}) {
  const response = await axios.post(
    `${API_BASE_URL}/api/chat/${paperId}`,
    { question },
    { signal }
  );
  return response.data;
}
