/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { fetchActivities } from "../services/activityApi";

const ACTIVITY_COPY = {
  pdf_uploaded: ["PDF uploaded", "bg-sky-500/10 text-sky-600 dark:text-sky-300"],
  paper_summarized: ["Summary generated", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"],
  paper_analyzed: ["Analysis completed", "bg-violet-500/10 text-violet-600 dark:text-violet-300"],
  paper_deleted: ["Paper deleted", "bg-rose-500/10 text-rose-600 dark:text-rose-300"],
  chat_completed: ["Chat completed", "bg-blue-500/10 text-blue-600 dark:text-blue-300"],
  export_generated: ["Export generated", "bg-amber-500/10 text-amber-600 dark:text-amber-300"],
  login: ["Login", "bg-slate-500/10 text-slate-600 dark:text-slate-300"],
  registration: ["Registration", "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300"]
};

function formatRelativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["min", 60]
  ];

  for (const [unit, size] of units) {
    const count = Math.floor(seconds / size);

    if (count > 0) {
      return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
    }
  }

  return "Just now";
}

function activityDescription(activity) {
  const label = ACTIVITY_COPY[activity.type]?.[0] || "Activity";
  return `${label}${activity.title ? `: ${activity.title}` : ""}`;
}

function ActivityGlyph({ type }) {
  const className = ACTIVITY_COPY[type]?.[1] || ACTIVITY_COPY.login[1];

  return (
    <span className={`grid h-11 w-11 place-items-center rounded-2xl ${className}`}>
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5 9 16l10-10M4.75 19.25h14.5" />
      </svg>
    </span>
  );
}

function Activity({ refreshKey = 0 }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(async ({ signal } = {}) => {
    try {
      setIsLoading(true);
      setError("");
      setActivities(await fetchActivities({ limit: 30, signal }));
    } catch (apiError) {
      if (apiError?.code !== "ERR_CANCELED") {
        setError("Unable to load activity history.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadActivities({ signal: controller.signal });
    return () => controller.abort();
  }, [loadActivities, refreshKey]);

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="premium-panel p-6">
        <p className="premium-eyebrow">Workspace history</p>
        <h1 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
          Activity Timeline
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          A live audit trail for uploads, AI analysis, chats, exports, and account access.
        </p>
      </div>

      {isLoading && (
        <div className="premium-panel grid gap-3 p-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex gap-4 rounded-2xl border border-white/60 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="premium-panel p-5 text-sm font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {!isLoading && !error && activities.length === 0 && (
        <div className="premium-panel p-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Your timeline will fill in as you work with papers.
        </div>
      )}

      {!isLoading && !error && activities.length > 0 && (
        <div className="premium-panel overflow-hidden p-2">
          {activities.map((activity) => (
            <article
              key={activity._id}
              className="flex gap-4 rounded-2xl p-4 transition hover:bg-white/70 dark:hover:bg-white/5"
            >
              <ActivityGlyph type={activity.type} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-950 dark:text-white">
                  {activityDescription(activity)}
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

export default Activity;
