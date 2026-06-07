import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchPapers({
  search = "",
  sort = "newest",
  page = 1,
  limit = 12
} = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/papers`, {
    params: {
      search: search || undefined,
      sort,
      page,
      limit
    }
  });

  return {
    papers: response.data.papers || [],
    pagination: response.data.pagination || {
      page,
      limit,
      total: response.data.papers?.length || 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: page > 1
    }
  };
}

export async function fetchPaperById(paperId) {
  const response = await axios.get(`${API_BASE_URL}/api/papers/${paperId}`);
  return response.data.paper;
}

export async function deletePaperById(paperId) {
  const response = await axios.delete(`${API_BASE_URL}/api/papers/${paperId}`);
  return response.data;
}
