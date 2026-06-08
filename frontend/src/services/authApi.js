import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function registerUser(payload) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/register`, payload);
  return response.data;
}

export async function loginUser(payload) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/login`, payload);
  return response.data;
}

export async function fetchCurrentUser({ signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/auth/me`, { signal });
  return response.data.user;
}
