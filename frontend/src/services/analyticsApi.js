import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchAnalytics({ signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/analytics`, {
    signal
  });
  return response.data;
}
