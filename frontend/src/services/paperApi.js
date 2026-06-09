import axios from "axios";

// If VITE_API_BASE_URL is not set (e.g. local dev), default to backend on localhost:4000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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
  const url = `${API_BASE_URL}/api/papers/${paperId}/export`;
  console.info(`[api] GET ${url}`);
  const response = await axios.get(url, {
    signal,
    params: {
      format
    },
    responseType: "blob"
  });
  return response;
}

export async function generateSummary(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-summary`;
  console.info(`[api] POST ${url}`);
  const response = await axios.post(url, null, {
    signal
  });
  return response.data;
}

export async function generateAnalysis(paperId, { signal } = {}) {
  const url = `${API_BASE_URL}/api/papers/${paperId}/generate-analysis`;
  console.info(`[api] POST ${url}`);
  const response = await axios.post(url, null, {
    signal
  });
  return response.data;
}
