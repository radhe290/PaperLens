/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { deletePaperById, fetchPapers } from "../services/paperApi";

const PAGE_LIMIT = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title-asc", label: "A-Z" },
  { value: "title-desc", label: "Z-A" }
];

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function previewText(value) {
  if (!value) {
    return "No summary generated yet.";
  }

  return value.length > 150 ? `${value.slice(0, 150)}...` : value;
}

function Dashboard({ onViewPaper }) {
  const [papers, setPapers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPapers = useCallback(async ({ page = 1, append = false } = {}) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setError("");
      const result = await fetchPapers({
        search,
        sort,
        page,
        limit: PAGE_LIMIT
      });

      setPapers((currentPapers) =>
        append ? [...currentPapers, ...result.papers] : result.papers
      );
      setPagination(result.pagination);
    } catch (apiError) {
      setError(
        apiError.response?.data?.error ||
          apiError.message ||
          "Failed to load saved papers."
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [search, sort]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPapers({ page: 1 });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadPapers]);

  const handleDelete = async (paper) => {
    const confirmed = window.confirm(
      `Delete "${paper.title}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deletePaperById(paper._id);
      await loadPapers({ page: 1 });
    } catch (apiError) {
      setError(
        apiError.response?.data?.error ||
          apiError.message ||
          "Failed to delete paper."
      );
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Task 9
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Saved Papers Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Browse papers stored in MongoDB, open their saved analysis, or remove
            papers you no longer need.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadPapers({ page: 1 })}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Search papers
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or file name"
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading saved papers...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && papers.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
          {search.trim() ? "No papers found." : "No papers saved yet."}
        </div>
      )}

      {!isLoading && !error && papers.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Showing {papers.length} of {pagination.total} saved{" "}
              {pagination.total === 1 ? "paper" : "papers"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {papers.map((paper) => (
              <article
                key={paper._id}
                className="flex min-h-72 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold leading-6 text-slate-950">
                      {paper.title}
                    </h2>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {paper.summary?.keyContributions?.length || 0} contributions
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {paper.originalFilename}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatDate(paper.uploadDate)}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {previewText(paper.summary?.shortSummary)}
                  </p>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => onViewPaper(paper._id)}
                    className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    View Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(paper)}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {pagination.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() =>
                  loadPapers({ page: pagination.page + 1, append: true })
                }
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Dashboard;
