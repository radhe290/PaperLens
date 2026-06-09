import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchPapers({
  search = "",
  sort = "newest",
  page = 1,
  limit = 12,
  signal
} = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/papers`, {
    signal,
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
    },
    stats: response.data.stats || {
      totalPapers: 0,
      totalSummariesGenerated: 0,
      totalAnalysesGenerated: 0,
      mostRecentUploadDate: null
    }
  };
}

export async function fetchPaperById(paperId, { signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/papers/${paperId}`, {
    signal
  });
  return response.data.paper;
}

export async function deletePaperById(paperId, { signal } = {}) {
  const response = await axios.delete(`${API_BASE_URL}/api/papers/${paperId}`, {
    signal
  });
  return response.data;
}

export async function exportPaper(paperId, format, { signal } = {}) {
  const response = await axios.get(`${API_BASE_URL}/api/papers/${paperId}/export`, {
    signal,
    params: {
      format
    },
    responseType: "blob"
  });
  return response;
}

export async function generateSummary(paperId, { signal } = {}) {
  const response = await axios.post(`${API_BASE_URL}/api/papers/${paperId}/generate-summary`, null, {
    signal
  });
  return response.data;
}

export async function generateAnalysis(paperId, { signal } = {}) {
  const response = await axios.post(`${API_BASE_URL}/api/papers/${paperId}/generate-analysis`, null, {
    signal
  });
  return response.data;
}
