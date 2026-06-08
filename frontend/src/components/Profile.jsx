/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchCurrentUser } from "../services/authApi";
import { fetchPapers } from "../services/paperApi";
import { fetchAnalytics } from "../services/analyticsApi";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "long"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "PL";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function Spinner({ label = "Loading" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
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
          Try again
        </button>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="mx-auto mt-5 h-5 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mx-auto mt-3 h-4 w-48 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-md bg-slate-100" />
          <div className="h-24 animate-pulse rounded-md bg-slate-100" />
          <div className="h-24 animate-pulse rounded-md bg-slate-100" />
          <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function Profile({ onLogout }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user);
  const [paperCount, setPaperCount] = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async ({ signal } = {}) => {
    try {
      setIsLoading(true);
      setError("");

      const [currentUser, paperResult, analyticsResult] = await Promise.all([
        fetchCurrentUser({ signal }),
        fetchPapers({ page: 1, limit: 1, signal }),
        fetchAnalytics({ signal })
      ]);

      setProfile(currentUser);
      setPaperCount(paperResult.stats?.totalPapers || 0);
      setAnalytics(analyticsResult || null);
    } catch (apiError) {
      if (isCanceledRequest(apiError)) {
        return;
      }

      setError("Unable to load your profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProfile({ signal: controller.signal });

    return () => controller.abort();
  }, [loadProfile]);

  const displayProfile = profile || user;
  const stats = [
    ["Name", displayProfile?.name || "Not available"],
    ["Email", displayProfile?.email || "Not available"],
    ["Account created", formatDate(displayProfile?.createdAt)],
    ["Uploaded papers", formatNumber(paperCount)]
  ];

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review your PaperLens account details and research library activity.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      {isLoading && <ProfileSkeleton />}

      {!isLoading && error && (
        <AlertCard message={error} onRetry={() => loadProfile()} />
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-indigo-600 text-3xl font-bold text-white">
              {getInitials(displayProfile?.name)}
            </div>
            <h2 className="mt-5 break-words text-xl font-bold text-slate-950">
              {displayProfile?.name || "PaperLens User"}
            </h2>
            <p className="mt-2 break-words text-sm text-slate-600">
              {displayProfile?.email || "Email unavailable"}
            </p>
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-indigo-600">
                  Details
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">
                  Account information
                </h2>
              </div>
              <div className="text-sm text-slate-600">
                {!isLoading && analytics ? (
                  <div className="space-y-1 text-right">
                    <div>Total analyses: {formatNumber(analytics.totalAnalyses || analytics.totalSummaries || 0)}</div>
                    <div>Total chats: {formatNumber(analytics.totalChats || analytics.totalQuestionsAsked || 0)}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-base font-semibold text-slate-950">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}

export default Profile;
