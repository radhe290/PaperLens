/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchActivities } from "../services/activityApi";
import { fetchAnalytics } from "../services/analyticsApi";
import { deletePaperById, exportPaper, fetchPapers } from "../services/paperApi";
import { friendlyError } from "../services/errorUtil";

const PAGE_LIMIT = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title-asc", label: "A-Z" },
  { value: "title-desc", label: "Z-A" }
];

const EMPTY_ANALYTICS = {
  totalPapers: 0,
  totalSummaries: 0,
  totalAnalyses: 0,
  uploadsThisWeek: 0,
  uploadsThisMonth: 0,
  averagePaperLength: 0,
  averageUploadsPerWeek: 0,
  mostRecentUpload: null,
  oldestUpload: null,
  recentUploads: [],
  uploadTrends: {
    daily: [],
    weekly: []
  }
};

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

function formatRelativeTime(value) {
  if (!value) {
    return "Just now";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["min", 60]
  ];

  for (const [unit, unitSeconds] of units) {
    const count = Math.floor(seconds / unitSeconds);

    if (count >= 1) {
      return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
    }
  }

  return "Just now";
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "Not available";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getDownloadUrl(fileUrl) {
  if (!fileUrl) {
    return "";
  }

  if (fileUrl.includes("/upload/") && fileUrl.includes("cloudinary.com")) {
    return fileUrl.replace("/upload/", "/upload/fl_attachment/");
  }

  return fileUrl;
}

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function previewText(value) {
  if (!value) {
    return "No summary generated yet.";
  }

  return value.length > 150 ? `${value.slice(0, 150)}...` : value;
}

function hasSummary(paper) {
  return Boolean(
    paper.summary?.shortSummary || paper.summary?.keyContributions?.length
  );
}

function hasAnalysis(paper) {
  return Boolean(paper.analysis?.domain || paper.analysis?.difficulty);
}

function getAnalysisStatus(paper) {
  if (hasAnalysis(paper)) {
    return "completed";
  }

  if (paper.summary?.shortSummary) {
    return "processing";
  }

  return "queued";
}

function StatusBadge({ status }) {
  const styles = {
    queued: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    processing: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300"
  };

  return (
    <span className={`premium-status ${styles[status] || styles.queued}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "processing" ? "animate-pulse bg-current" : "bg-current"
        }`}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Spinner({ label = "Loading", size = "md" }) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${sizeClass} animate-spin rounded-full border-2 border-current border-t-transparent`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border bg-white p-4 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-red-200 text-red-800"
              : "border-emerald-200 text-emerald-800"
          }`}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-md px-1 text-lg leading-none text-slate-400 transition hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertCard({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function ActivityIcon({ type }) {
  const styles = {
    pdf_uploaded: "bg-sky-50 text-sky-700",
    paper_summarized: "bg-emerald-50 text-emerald-700",
    paper_analyzed: "bg-indigo-50 text-indigo-700",
    paper_deleted: "bg-red-50 text-red-700",
    login: "bg-slate-100 text-slate-700",
    registration: "bg-violet-50 text-violet-700"
  };

  const paths = {
    pdf_uploaded: "M7 3.75h6.75L18 8v12.25H7z M13.75 3.75V8H18 M9.75 13h4.5 M9.75 16h4.5",
    paper_summarized: "M5 5.75h14 M5 10h14 M5 14.25h8 M5 18.5h5",
    paper_analyzed: "M4.5 18.5l4.5-5 3 3 7.5-9 M4.5 20.25h15",
    paper_deleted: "M6.75 7.5h10.5 M9.25 7.5V5.75h5.5V7.5 M8 7.5l.5 11h7l.5-11",
    login: "M9 6.75V5.5A2.5 2.5 0 0 1 11.5 3h5A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-5A2.5 2.5 0 0 1 9 18.5v-1.25 M4 12h10 M10.5 8.5 14 12l-3.5 3.5",
    registration: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.75 20.25a7.25 7.25 0 0 1 14.5 0"
  };

  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
        styles[type] || "bg-slate-100 text-slate-700"
      }`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={paths[type] || paths.login}
        />
      </svg>
    </span>
  );
}

function describeActivity(activity) {
  const title = activity.title || "PaperLens";

  const descriptions = {
    pdf_uploaded: `Uploaded ${title}`,
    paper_summarized: `Generated summary for ${title}`,
    paper_analyzed: `Analyzed ${title}`,
    paper_deleted: `Deleted ${title}`,
    login: "Logged in",
    registration: "Created account"
  };

  return descriptions[activity.type] || title;
}

function ActivitySkeleton() {
  return (
    <section className="premium-panel p-5">
      <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex gap-3 rounded-md border border-slate-100 p-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="flex-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ activities, isLoading, error, onRetry }) {
  if (isLoading) {
    return <ActivitySkeleton />;
  }

  return (
    <section className="dashboard-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="premium-eyebrow">Timeline</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Recent activity</h2>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="premium-secondary-button w-fit px-4 py-2 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && <div className="mt-5"><AlertCard message={error} onRetry={onRetry} /></div>}

      {!error && activities.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          Your activity timeline will appear after uploads, summaries, analyses,
          account access, or paper changes.
        </div>
      )}

      {!error && activities.length > 0 && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {activities.slice(0, 8).map((activity) => (
            <article
              key={activity._id}
              className="flex gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5"
            >
              <ActivityIcon type={activity.type} />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                  {describeActivity(activity)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ onUploadPaper }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 3.75h6.75L18 8v12.25H7z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.75 3.75V8H18M9.75 12h4.5M9.75 15.5h4.5"
          />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-950">No Papers Yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Upload your first research paper to start generating summaries and
        insights.
      </p>
      {onUploadPaper && (
        <button
          type="button"
          onClick={onUploadPaper}
          className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Upload Paper
        </button>
      )}
    </div>
  );
}

function NoResultsState() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <svg
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
          />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-950">
        No Matching Papers
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Try a different search term or sort option to find papers in your
        library.
      </p>
    </div>
  );
}

function ConfirmDialog({ paper, isDeleting, onCancel, onConfirm }) {
  if (!paper) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-paper-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="delete-paper-title" className="text-xl font-bold text-slate-950">
          Delete paper
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Are you sure you want to delete this paper? This action cannot be
          undone.
        </p>
        <p className="mt-3 break-words text-sm font-semibold text-slate-900">
          {paper.title}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Spinner label="Deleting..." size="sm" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceStats({ analytics, activities }) {
  const totalExports = activities.filter(
    (activity) => activity.type === "export_generated"
  ).length;
  const cards = [
    {
      label: "Total Papers",
      value: formatNumber(analytics.totalPapers),
      trend: `${formatNumber(analytics.uploadsThisWeek)} this week`
    },
    {
      label: "Total Chats",
      value: formatNumber(analytics.totalChats),
      trend: `${formatNumber(analytics.totalQuestionsAsked)} questions`
    },
    {
      label: "Total Analyses",
      value: formatNumber(analytics.totalAnalyses),
      trend: `${formatNumber(analytics.totalSummaries)} summaries`
    },
    {
      label: "Total Exports",
      value: formatNumber(totalExports),
      trend: "Workspace outputs"
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <article
          key={card.label}
          className="dashboard-stat-card relative overflow-hidden rounded-[1.75rem] p-5"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br from-sky-400/15 to-indigo-500/10 blur-2xl" />
          <div className="relative z-10">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {card.value}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              {card.trend}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ActivityInsights({ analytics }) {
  const cards = [
    {
      label: "Papers this week",
      value: formatNumber(analytics.uploadsThisWeek)
    },
    {
      label: "Monthly uploads",
      value: formatNumber(analytics.uploadsThisMonth)
    },
    {
      label: "Weekly average",
      value: analytics.averageUploadsPerWeek || 0
    }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="dashboard-card px-4 py-4"
        >
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            {card.label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}

function QuickActionsPanel({ onUploadPaper, onOpenActivity, onRefresh, isBusy }) {
  return (
    <section className="dashboard-card p-5">
      <div className="dashboard-section-title">
        <div>
          <p className="premium-eyebrow">Quick actions</p>
          <h2 className="text-lg font-semibold text-slate-100">Move through your workflow</h2>
        </div>
      </div>

      <div className="dashboard-action-buttons mt-5">
        <button
          type="button"
          onClick={onUploadPaper}
          className="premium-primary-button w-full px-4 py-3 text-sm"
        >
          Upload paper
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="premium-secondary-button w-full px-4 py-3 text-sm"
        >
          {isBusy ? "Refreshing…" : "Refresh workspace"}
        </button>
        <button
          type="button"
          onClick={onOpenActivity}
          className="premium-secondary-button w-full px-4 py-3 text-sm"
        >
          View activity timeline
        </button>
      </div>
    </section>
  );
}

function RecentAnalyses({ papers, onViewPaper }) {
  const recentAnalyses = papers
    .filter((paper) => hasAnalysis(paper) || hasSummary(paper))
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, 4);

  if (recentAnalyses.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-card p-5">
      <div className="dashboard-section-title">
        <div>
          <p className="premium-eyebrow">Insights</p>
          <h2 className="text-lg font-semibold text-slate-100">Recent analyses</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {recentAnalyses.map((paper) => (
          <article
            key={paper._id}
            className="rounded-3xl border border-white/10 bg-slate-900/80 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {paper.title}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {paper.analysis?.difficulty || paper.summary?.shortSummary?.slice(0, 70) || "AI insights ready"}
                </p>
              </div>
              <span className={`dashboard-stage-badge ${
                getAnalysisStatus(paper) === "completed"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : getAnalysisStatus(paper) === "processing"
                  ? "bg-sky-500/10 text-sky-300"
                  : "bg-amber-500/10 text-amber-300"
              }`}>
                {getAnalysisStatus(paper)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onViewPaper(paper._id)}
                className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500"
              >
                View paper
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="premium-panel p-5">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 h-64 animate-pulse rounded-md bg-slate-100" />
    </div>
  );
}

function UploadTrendChart({ data }) {
  return (
    <section className="premium-panel p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="premium-eyebrow">
            Upload Trends
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
            Papers uploaded over time
          </h2>
        </div>
        <p className="text-sm text-slate-500">Daily trend</p>
      </div>

      <div className="mt-5 h-72 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
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
                type="monotone"
                dataKey="uploads"
                stroke="#4f46e5"
                fill="#c7d2fe"
                strokeWidth={2}
              />
            </AreaChart>
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

function PaperStats({ paper }) {
  const stats = [
    ["Original filename", paper.originalFilename || "Not available"],
    ["Upload date", formatDate(paper.uploadDate)],
    ["PDF size", formatFileSize(paper.fileSize)],
    ["Number of pages", formatNumber(paper.pageCount)],
    ["Word count", formatNumber(paper.wordCount)],
    ["Summary generated", hasSummary(paper) ? "Yes" : "No"],
    ["Analysis generated", hasAnalysis(paper) ? "Yes" : "No"]
  ];

  return (
    <dl className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
      {stats.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="font-semibold text-slate-700">{label}</dt>
          <dd className="break-words text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Dashboard({
  activityRefreshKey = 0,
  onActivityChange,
  onChatPaper,
  onOpenActivity,
  onViewPaper,
  onUploadPaper,
  user
}) {
  const [papers, setPapers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [activities, setActivities] = useState([]);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [paperToDelete, setPaperToDelete] = useState(null);
  const [deletingPaperId, setDeletingPaperId] = useState("");
  const [exportingPaper, setExportingPaper] = useState({ paperId: "", format: "" });
  const [toasts, setToasts] = useState([]);
  const analyticsAbortRef = useRef(null);
  const activitiesAbortRef = useRef(null);
  const papersAbortRef = useRef(null);
  const deleteAbortRef = useRef(null);

  const dismissToast = useCallback((toastId) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId)
    );
  }, []);

  const addToast = useCallback(
    (message, type = "success") => {
      const id = window.crypto?.randomUUID?.() || `${Date.now()}-${message}`;
      setToasts((currentToasts) => [...currentToasts, { id, message, type }]);
      window.setTimeout(() => dismissToast(id), 3500);
    },
    [dismissToast]
  );

  const loadAnalytics = useCallback(async () => {
    analyticsAbortRef.current?.abort();
    const controller = new AbortController();
    analyticsAbortRef.current = controller;

    try {
      setIsAnalyticsLoading(true);
      setAnalyticsError("");
      const result = await fetchAnalytics({ signal: controller.signal });
      setAnalytics({ ...EMPTY_ANALYTICS, ...result });
      return true;
    } catch (apiError) {
      if (isCanceledRequest(apiError)) {
        return false;
      }

      setAnalyticsError("Unable to load analytics. Please try again.");
      addToast("Unable to load analytics. Please try again.", "error");
      return false;
    } finally {
      if (analyticsAbortRef.current === controller) {
        setIsAnalyticsLoading(false);
        analyticsAbortRef.current = null;
      }
    }
  }, [addToast]);

  const loadPapers = useCallback(
    async ({ page = 1, append = false, successMessage = "" } = {}) => {
      papersAbortRef.current?.abort();
      const controller = new AbortController();
      papersAbortRef.current = controller;

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
          limit: PAGE_LIMIT,
          signal: controller.signal
        });

        setPapers((currentPapers) =>
          append ? [...currentPapers, ...result.papers] : result.papers
        );
        setPagination(result.pagination);

        if (successMessage) {
          addToast(successMessage);
        }
        return true;
      } catch (apiError) {
        if (isCanceledRequest(apiError)) {
          return false;
        }

        setError("Unable to load papers. Please try again.");
        addToast("Unable to load papers. Please try again.", "error");
        return false;
      } finally {
        if (papersAbortRef.current === controller) {
          setIsLoading(false);
          setIsLoadingMore(false);
          papersAbortRef.current = null;
        }
      }
    },
    [addToast, search, sort]
  );

  const loadActivities = useCallback(async () => {
    activitiesAbortRef.current?.abort();
    const controller = new AbortController();
    activitiesAbortRef.current = controller;

    try {
      setIsActivitiesLoading(true);
      setActivitiesError("");
      const nextActivities = await fetchActivities({
        limit: 50,
        signal: controller.signal
      });
      setActivities(nextActivities);
      return true;
    } catch (apiError) {
      if (isCanceledRequest(apiError)) {
        return false;
      }

      setActivitiesError("Unable to load recent activity. Please try again.");
      return false;
    } finally {
      if (activitiesAbortRef.current === controller) {
        setIsActivitiesLoading(false);
        activitiesAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      analyticsAbortRef.current?.abort();
      activitiesAbortRef.current?.abort();
      papersAbortRef.current?.abort();
      deleteAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadActivities();
  }, [activityRefreshKey, loadActivities]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPapers({ page: 1 });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      papersAbortRef.current?.abort();
    };
  }, [loadPapers]);

  const handleRefresh = async () => {
    if (isLoading || isLoadingMore || isAnalyticsLoading) {
      return;
    }

    const [papersLoaded, analyticsLoaded, activitiesLoaded] = await Promise.all([
      loadPapers({ page: 1 }),
      loadAnalytics(),
      loadActivities()
    ]);

    if (papersLoaded && analyticsLoaded && activitiesLoaded) {
      addToast("Dashboard refreshed.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!paperToDelete) {
      return;
    }

    if (deletingPaperId) {
      return;
    }

    const controller = new AbortController();
    deleteAbortRef.current = controller;

    try {
      setDeletingPaperId(paperToDelete._id);
      await deletePaperById(paperToDelete._id, { signal: controller.signal });
      setPaperToDelete(null);
      addToast("Paper deleted successfully.");
      await Promise.all([loadPapers({ page: 1 }), loadAnalytics(), loadActivities()]);
      onActivityChange?.();
    } catch (apiError) {
      if (isCanceledRequest(apiError)) {
        return;
      }

      addToast("Unable to delete paper. Please try again.", "error");
    } finally {
      if (deleteAbortRef.current === controller) {
        setDeletingPaperId("");
        deleteAbortRef.current = null;
      }
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPaper = async (paper, format) => {
    setExportingPaper({ paperId: paper._id, format });

    try {
      const response = await exportPaper(paper._id, format);
      const filename = response.headers["content-disposition"]
        ?.match(/filename="?([^";]+)"?/)?.[1] ||
        `${paper.title || "paperlens-export"}.${format}`;
      downloadBlob(response.data, filename);
      addToast(`Exporting ${format.toUpperCase()} file...`);
      await loadActivities();
      onActivityChange?.();
    } catch (apiError) {
        addToast(
          friendlyError(apiError, "Export failed."),
          "error"
        );
    } finally {
      setExportingPaper({ paperId: "", format: "" });
    }
  };

  const hasPapers = papers.length > 0;
  const libraryIsEmpty = !hasPapers && analytics.totalPapers === 0;

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        paper={paperToDelete}
        isDeleting={Boolean(deletingPaperId)}
        onCancel={() => setPaperToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <div className="dashboard-topbar grid gap-4 rounded-[2rem] border border-white/10 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/20 sm:grid-cols-[1.7fr_0.95fr] sm:items-center sm:p-6">
        <div className="space-y-3">
          <p className="premium-eyebrow">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Research workspace built for focus.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            See papers, AI output, and recent activity together in a clean, compact research hub.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="dashboard-pill">Library: {formatNumber(analytics.totalPapers)}</span>
            <span className="dashboard-pill">AI outputs: {formatNumber(analytics.totalSummaries + analytics.totalAnalyses)}</span>
            <span className="dashboard-pill">This week: {formatNumber(analytics.uploadsThisWeek)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onUploadPaper}
            className="premium-primary-button px-4 py-2 text-sm"
          >
            Upload paper
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isLoadingMore || isAnalyticsLoading}
            className="premium-secondary-button px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <WorkspaceStats analytics={analytics} activities={activities} />

      <div className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-5">
          <section className="dashboard-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="premium-eyebrow">Library</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-100">
                  Saved papers
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="premium-secondary-button px-4 py-2 text-sm"
                disabled={isLoading || isLoadingMore || isAnalyticsLoading}
              >
                {isLoading || isAnalyticsLoading ? (
                  <Spinner label="Refreshing..." size="sm" />
                ) : (
                  "Refresh"
                )}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="grid gap-2 text-sm font-medium text-slate-300">
                Search papers
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or file name"
                  className="dashboard-compact-input border border-white/10 bg-slate-950/80 text-slate-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-300">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="dashboard-compact-input border border-white/10 bg-slate-950/80 text-slate-100"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {analyticsError && (
            <AlertCard message={analyticsError} onRetry={loadAnalytics} />
          )}

          {isLoading && (
            <div className="dashboard-card grid min-h-72 place-items-center p-8 text-center">
              <div className="grid justify-items-center gap-3">
                <Spinner label="Loading saved papers..." />
                <p className="text-sm text-slate-400">
                  Fetching your research library.
                </p>
              </div>
            </div>
          )}

          {!isLoading && error && (
            <AlertCard message={error} onRetry={() => loadPapers({ page: 1 })} />
          )}

          {!isLoading && !error && libraryIsEmpty && (
            <EmptyState onUploadPaper={onUploadPaper} />
          )}

          {!isLoading && !error && !libraryIsEmpty && !hasPapers && (
            <NoResultsState />
          )}

          {!isLoading && !error && hasPapers && (
            <>
              <div className="flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {papers.length} of {analytics.totalPapers} papers
                </p>
                <p>
                  Search results: {pagination.total} of {analytics.totalPapers}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {papers.map((paper) => (
                  <article
                    key={paper._id}
                    className="dashboard-paper-card relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/90 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(15,23,42,0.22)]"
                  >
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[2rem] bg-gradient-to-br from-sky-400/10 to-indigo-500/10" />
                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-slate-100">
                            {paper.title}
                          </h2>
                          <p className="mt-1 text-sm text-slate-400">
                            Uploaded {formatDate(paper.uploadDate)}
                          </p>
                        </div>
                        <StatusBadge status={getAnalysisStatus(paper)} />
                      </div>

                      <p className="text-sm leading-6 text-slate-400">
                        {previewText(paper.summary?.shortSummary)}
                      </p>

                      <div className="grid gap-2 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-3 text-sm text-slate-400">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-200">Pages</span>
                          <span>{formatNumber(paper.pageCount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-200">Size</span>
                          <span>{formatFileSize(paper.fileSize)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-200">AI status</span>
                          <span>{getAnalysisStatus(paper)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => onViewPaper(paper._id)}
                        disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                        className="premium-primary-button text-sm"
                      >
                        View
                      </button>
                      {onChatPaper && (
                        <button
                          type="button"
                          onClick={() => onChatPaper(paper._id)}
                          disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                          className="premium-secondary-button text-sm"
                        >
                          Chat
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExportPaper(paper, "pdf")}
                        disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                        className="premium-secondary-button text-sm"
                      >
                        {exportingPaper.paperId === paper._id && exportingPaper.format === "pdf" ? (
                          <Spinner label="PDF..." size="sm" />
                        ) : (
                          "Export PDF"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportPaper(paper, "markdown")}
                        disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                        className="premium-secondary-button text-sm"
                      >
                        {exportingPaper.paperId === paper._id && exportingPaper.format === "markdown" ? (
                          <Spinner label="Markdown..." size="sm" />
                        ) : (
                          "Export MD"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportPaper(paper, "text")}
                        disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                        className="premium-secondary-button text-sm"
                      >
                        {exportingPaper.paperId === paper._id && exportingPaper.format === "text" ? (
                          <Spinner label="Text..." size="sm" />
                        ) : (
                          "Export TXT"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaperToDelete(paper)}
                        disabled={Boolean(deletingPaperId) || exportingPaper.paperId === paper._id}
                        className="premium-danger-button text-sm"
                      >
                        {deletingPaperId === paper._id ? (
                          <Spinner label="Deleting..." size="sm" />
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </div>

                    {paper.fileUrl && (
                      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-400">
                        <a
                          href={paper.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="transition hover:text-sky-300"
                        >
                          View PDF
                        </a>
                        <a
                          href={getDownloadUrl(paper.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          download={paper.originalFilename}
                          className="transition hover:text-sky-300"
                        >
                          Download PDF
                        </a>
                      </div>
                    )}
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
                    className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? <Spinner label="Loading..." size="sm" /> : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}

          <RecentAnalyses papers={papers} onViewPaper={onViewPaper} />
        </div>

        <aside className="space-y-5">
          <QuickActionsPanel
            onUploadPaper={onUploadPaper}
            onOpenActivity={onOpenActivity}
            onRefresh={handleRefresh}
            isBusy={isLoading || isLoadingMore || isAnalyticsLoading}
          />

          <section className="dashboard-card p-5">
            <div className="dashboard-section-title">
              <div>
                <p className="premium-eyebrow">Productivity</p>
                <h2 className="text-lg font-semibold text-slate-100">Workspace insights</h2>
              </div>
            </div>
            <div className="mt-5">
              <ActivityInsights analytics={analytics} />
            </div>
          </section>

          <RecentActivity
            activities={activities}
            error={activitiesError}
            isLoading={isActivitiesLoading}
            onRetry={loadActivities}
          />
        </aside>
      </div>

      {isAnalyticsLoading ? (
        <ChartSkeleton />
      ) : (
        <UploadTrendChart data={analytics.uploadTrends?.daily || []} />
      )}
        </section>
  );
}

export default Dashboard;