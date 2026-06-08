import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchActivities({ limit = 8, signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/activities`, {
    signal,
    params: { limit }
  });

  return response.data.activities || [];
}

export async function recordActivity(payload, { signal } = {}) {
  const response = await axios.post(`${API_BASE_URL}/api/activities`, payload, {
    signal
  });

  return response.data.activity;
}
