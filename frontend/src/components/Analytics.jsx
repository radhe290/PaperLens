/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchAnalytics } from "../services/analyticsApi";
import { fetchPapers } from "../services/paperApi";

const EMPTY_ANALYTICS = {
  totalPapers: 0,
  totalSummaries: 0,
  totalAnalyses: 0,
  totalChats: 0,
  totalQuestionsAsked: 0,
  mostActivePapers: [],
  uploadsThisWeek: 0,
  uploadsThisMonth: 0,
  latestUpload: null,
  summaryAnalysisMetrics: {
    papersWithSummaries: 0,
    papersWithAnalyses: 0,
    papersPendingAnalysis: 0,
    summaryPercentage: 0,
    analysisPercentage: 0,
    pendingAnalysisPercentage: 0
  },
  recentUploads: [],
  uploadTrends: {
    last7Days: [],
    last30Days: []
  }
};

function formatDate(value) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function getPercentage(value, total) {
  if (!total) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-6" aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={index}
          >
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-4 h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="mt-5 h-72 w-full" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="mt-5 h-72 w-full" />
        </div>
      </div>
    </div>
  );
}

function AlertCard({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="w-fit rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function OverviewCards({ analytics }) {
  const cards = [
    ["Total Papers Uploaded", formatNumber(analytics.totalPapers)],
    ["Total Summaries Generated", formatNumber(analytics.totalSummaries)],
    ["Total Analyses Generated", formatNumber(analytics.totalAnalyses)],
    ["Total Chats", formatNumber(analytics.totalChats)],
    ["Total Questions Asked", formatNumber(analytics.totalQuestionsAsked)],
    ["Papers Uploaded This Week", formatNumber(analytics.uploadsThisWeek)],
    ["Papers Uploaded This Month", formatNumber(analytics.uploadsThisMonth)],
    ["Most Recent Upload Date", formatDate(analytics.latestUpload)]
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value]) => (
        <article
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          key={label}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-3 break-words text-2xl font-bold text-slate-950">
            {value}
          </p>
        </article>
      ))}
    </div>
  );
}

function UploadTrendChart({ title, data, type = "area" }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <div className="mt-5 h-72 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {type === "bar" ? (
              <BarChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) => formatDate(label)}
                  formatter={(value) => [value, "Uploads"]}
                />
                <Bar dataKey="uploads" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) => formatDate(label)}
                  formatter={(value) => [value, "Uploads"]}
                />
                <Area
                  dataKey="uploads"
                  fill="#bfdbfe"
                  stroke="#2563eb"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
            Upload trends will appear after papers are saved.
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryAnalysisMetrics({ analytics }) {
  const metrics = analytics.summaryAnalysisMetrics || EMPTY_ANALYTICS.summaryAnalysisMetrics;
  const total = analytics.totalPapers;
  const chartData = [
    {
      name: "Summaries",
      value: metrics.papersWithSummaries,
      color: "#2563eb"
    },
    {
      name: "Analyses",
      value: metrics.papersWithAnalyses,
      color: "#0f766e"
    },
    {
      name: "Pending Analysis",
      value: metrics.papersPendingAnalysis,
      color: "#f59e0b"
    }
  ];
  const cards = [
    [
      "Papers with summaries",
      metrics.papersWithSummaries,
      metrics.summaryPercentage ?? getPercentage(metrics.papersWithSummaries, total)
    ],
    [
      "Papers with analyses",
      metrics.papersWithAnalyses,
      metrics.analysisPercentage ?? getPercentage(metrics.papersWithAnalyses, total)
    ],
    [
      "Papers pending analysis",
      metrics.papersPendingAnalysis,
      metrics.pendingAnalysisPercentage ??
        getPercentage(metrics.papersPendingAnalysis, total)
    ]
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.6fr)]">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {cards.map(([label, count, percentage]) => (
          <article
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {label}
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950">
              {formatNumber(count)}
            </p>
            <p className="mt-1 text-sm text-slate-600">{percentage}% of library</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">
          Summary vs Analysis
        </h2>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
              >
                {chartData.map((item) => (
                  <Cell fill={item.color} key={item.name} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2 text-sm text-slate-600">
          {chartData.map((item) => (
            <div className="flex items-center justify-between gap-3" key={item.name}>
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="font-semibold text-slate-900">
                {formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentActivity({ uploads }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Recent Activity</h2>
      {uploads.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {uploads.map((paper) => (
            <article
              className="grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={paper._id}
            >
              <div>
                <h3 className="break-words text-sm font-bold text-slate-950">
                  {paper.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Uploaded {formatDate(paper.uploadDate)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {paper.status?.summaryGenerated
                    ? "Summary Generated"
                    : "Summary Pending"}
                </span>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  {paper.status?.analysisGenerated
                    ? "Analysis Generated"
                    : "Analysis Pending"}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Recent uploads will appear after papers are saved.
        </div>
      )}
    </section>
  );
}

function MostActivePapers({ papers }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Most Active Papers</h2>
      {papers.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {papers.map((paper) => (
            <article
              className="grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={paper.paperId}
            >
              <div>
                <h3 className="break-words text-sm font-bold text-slate-950">
                  {paper.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Last chat activity {formatDate(paper.updatedAt)}
                </p>
              </div>
              <span className="h-fit rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {formatNumber(paper.questionCount)} questions
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Chat activity will appear after questions are asked.
        </div>
      )}
    </section>
  );
}

function SearchInsights({
  analytics,
  isLoading,
  onSearchChange,
  search,
  searchResultCount
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
      <label className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm">
        Search insights
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by title or file name"
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </label>
      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Current Search Result Count
        </p>
        <p className="mt-3 text-2xl font-bold text-slate-950">
          {isLoading ? "..." : formatNumber(searchResultCount)}
        </p>
      </article>
      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Total Paper Count
        </p>
        <p className="mt-3 text-2xl font-bold text-slate-950">
          Showing {isLoading ? "..." : formatNumber(searchResultCount)} of{" "}
          {formatNumber(analytics.totalPapers)} papers
        </p>
      </article>
    </section>
  );
}

function Analytics() {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const searchAbortRef = useRef(null);

  const loadAnalytics = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError("");
      const result = await fetchAnalytics({ signal: controller.signal });
      setAnalytics({ ...EMPTY_ANALYTICS, ...result });
    } catch (apiError) {
      if (!isCanceledRequest(apiError)) {
        setError("Unable to load analytics. Please try again.");
      }
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    loadAnalytics();

    return () => {
      abortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, [loadAnalytics]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        setIsSearchLoading(true);
        const result = await fetchPapers({
          search,
          page: 1,
          limit: 1,
          signal: controller.signal
        });
        setSearchResultCount(result.pagination.total);
      } catch (apiError) {
        if (!isCanceledRequest(apiError)) {
          setSearchResultCount(0);
        }
      } finally {
        if (searchAbortRef.current === controller) {
          setIsSearchLoading(false);
          searchAbortRef.current = null;
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      searchAbortRef.current?.abort();
    };
  }, [search]);

  const last7Days = useMemo(
    () => analytics.uploadTrends?.last7Days || [],
    [analytics.uploadTrends?.last7Days]
  );
  const last30Days = useMemo(
    () => analytics.uploadTrends?.last30Days || [],
    [analytics.uploadTrends?.last30Days]
  );

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Analytics
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Analytics & Insights
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Track upload activity, summary coverage, analysis completion, and the
          latest research-paper activity across PaperLens.
        </p>
      </header>

      {isLoading && <AnalyticsSkeleton />}

      {!isLoading && error && (
        <AlertCard message={error} onRetry={loadAnalytics} />
      )}

      {!isLoading && !error && (
        <>
          <OverviewCards analytics={analytics} />

          <div className="grid gap-4 xl:grid-cols-2">
            <UploadTrendChart title="Last 7 Days Upload Trend" data={last7Days} />
            <UploadTrendChart
              title="Last 30 Days Upload Trend"
              data={last30Days}
              type="bar"
            />
          </div>

          <SummaryAnalysisMetrics analytics={analytics} />
          <MostActivePapers papers={analytics.mostActivePapers || []} />
          <RecentActivity uploads={analytics.recentUploads || []} />
          <SearchInsights
            analytics={analytics}
            isLoading={isSearchLoading}
            onSearchChange={setSearch}
            search={search}
            searchResultCount={searchResultCount}
          />
        </>
      )}
    </section>
  );
}

export default Analytics;
