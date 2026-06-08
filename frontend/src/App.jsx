/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Activity from "./components/Activity";
import Analytics from "./components/Analytics";
import Chat from "./components/Chat";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import PaperDetail from "./components/PaperDetail";
import PDFUpload from "./components/PDFUpload";
import Profile from "./components/Profile";
import Signup from "./components/Signup";
import { useAuth } from "./context/AuthContext";
import { fetchActivities } from "./services/activityApi";

const PATH_TO_VIEW = {
  "/": "landing",
  "/dashboard": "dashboard",
  "/upload": "upload",
  "/analytics": "analytics",
  "/activity": "activity",
  "/profile": "profile",
  "/login": "login",
  "/signup": "signup"
};

const VIEW_TO_PATH = {
  landing: "/",
  dashboard: "/dashboard",
  upload: "/upload",
  analytics: "/analytics",
  activity: "/activity",
  profile: "/profile",
  login: "/login",
  signup: "/signup"
};

function getInitialView() {
  if (window.location.pathname === "/chat") {
    return "chat";
  }

  if (window.location.pathname.startsWith("/chat/")) {
    return "chat";
  }

  return PATH_TO_VIEW[window.location.pathname] || "landing";
}

function getPaperIdFromPath() {
  const match = window.location.pathname.match(/^\/chat\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
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

const THEME_STORAGE_KEY = "paperlens.theme";
const READ_NOTIFICATIONS_KEY = "paperlens.readNotifications";

const NAV_ITEMS = [
  { view: "dashboard", label: "Dashboard", icon: "M4 13h7V4H4z M13 20h7V4h-7z M4 20h7v-5H4z" },
  { view: "upload", label: "Upload", icon: "M12 16V4 M7.5 8.5 12 4l4.5 4.5 M5 20h14" },
  { view: "analytics", label: "Analytics", icon: "M5 19V9 M12 19V5 M19 19v-7" },
  { view: "chat", label: "Chat", icon: "M5 6.5h14v9H8.5L5 19z" },
  { view: "activity", label: "Activity", icon: "M4.5 12h4l2-6 3 12 2-6h4" },
  { view: "profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.75 20.25a7.25 7.25 0 0 1 14.5 0" }
];

const LANDING_FEATURES = [
  {
    title: "AI-powered paper intelligence",
    description: "Extract summaries, insights, and citations from research PDFs in seconds.",
    icon: "🧠"
  },
  {
    title: "Conversation-first analysis",
    description: "Ask follow-up questions, compare ideas, and explore papers with natural language chat.",
    icon: "💬"
  },
  {
    title: "Workspace built for researchers",
    description: "Organize papers, annotations, and analytics in one polished AI-enabled dashboard.",
    icon: "📚"
  }
];

const HOW_IT_WORKS = [
  {
    step: "Upload your paper",
    description: "Drag and drop PDFs or import documents to start analysis without manual setup."
  },
  {
    step: "Review AI summaries",
    description: "Get concise summaries, key insights, and recommended follow-up questions instantly."
  },
  {
    step: "Ask smarter questions",
    description: "Interact with your research using chat, compare results, and generate actionable findings."
  }
];

function LandingPage({ onLogin, onSignup }) {
  return (
    <div className="landing-shell">
      <section className="landing-hero">
        <div className="landing-hero__glow landing-glow landing-glow--left"></div>
        <div className="landing-hero__glow landing-glow landing-glow--right"></div>
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-24 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 backdrop-blur-xl">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                AI Research assistant for modern teams
              </span>
              <div className="space-y-6">
                <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Discover research faster with a smarter AI workspace.
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-100 sm:text-lg">
                  PaperLens brings AI summaries, chat-driven analysis, and secure paper organization together in one elegant research experience.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <button type="button" onClick={onSignup} className="premium-primary-button text-sm px-6 py-3 shadow-xl shadow-indigo-500/20">
                  Start free trial
                </button>
                <button type="button" onClick={onLogin} className="premium-secondary-button text-sm px-6 py-3">
                  Login
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-center text-sm text-slate-100 backdrop-blur-xl">
                  <span className="block text-2xl font-black">49%</span>
                  faster paper review
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-center text-sm text-slate-100 backdrop-blur-xl">
                  <span className="block text-2xl font-black">24/7</span>
                  instant research answers
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-center text-sm text-slate-100 backdrop-blur-xl">
                  <span className="block text-2xl font-black">One hub</span>
                  for papers, chat and analytics
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="landing-card overflow-hidden border border-white/15 bg-white/10 shadow-2xl shadow-slate-950/10 backdrop-blur-3xl">
                <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400" />
                <div className="relative p-8 sm:p-10">
                  <div className="mb-8 flex items-center justify-between rounded-3xl border border-white/15 bg-slate-950/90 p-4 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live summary</p>
                      <p className="text-sm font-semibold">Understanding complex research faster</p>
                    </div>
                    <span className="rounded-2xl bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                      98% accurate
                    </span>
                  </div>
                  <div className="space-y-5">
                    <div className="rounded-3xl bg-slate-950/90 p-5 text-slate-100 shadow-xl shadow-slate-950/10">
                      <p className="text-sm font-semibold text-slate-300">Key insight</p>
                      <p className="mt-3 text-base leading-7 text-white">PaperLens extracts the most important concepts, citations, and research findings with a single click.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl bg-slate-950/90 p-4 text-slate-100">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Extract</p>
                        <p className="mt-3 text-sm font-semibold">Summary cards</p>
                      </div>
                      <div className="rounded-3xl bg-slate-950/90 p-4 text-slate-100">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Chat</p>
                        <p className="mt-3 text-sm font-semibold">Ask questions</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="landing-hero-glow-spot" />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="mb-10 max-w-2xl">
            <p className="premium-eyebrow">Features</p>
            <h2 className="mt-4 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
              Everything you need to make research feel effortless.
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {LANDING_FEATURES.map((feature) => (
              <article key={feature.title} className="landing-card group">
                <div className="landing-card-icon">{feature.icon}</div>
                <h3 className="mt-6 text-xl font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section bg-slate-950/95 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
          <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="max-w-xl">
              <p className="premium-eyebrow text-indigo-300">How it works</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                From upload to insight in three easy steps.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
                PaperLens transforms research workflows by combining clean organization, AI summaries, and conversational analysis into a single experience.
              </p>
            </div>
            <div className="grid gap-4">
              {HOW_IT_WORKS.map((step, index) => (
                <div key={step.step} className="landing-step">
                  <div className="landing-step-number">{index + 1}</div>
                  <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{step.step}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-10">
          <div className="landing-cta-panel flex flex-col gap-8 rounded-[2rem] border border-white/15 bg-gradient-to-r from-indigo-900/95 via-slate-950/95 to-slate-900/95 p-10 text-white shadow-2xl shadow-slate-950/20">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-300/80">Ready to move faster?</p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                Start turning research into decisions with AI.
              </h2>
              <p className="max-w-2xl text-base leading-8 text-slate-300">
                Join teams who use PaperLens to streamline paper analysis, collaborate on insights, and keep research flowing.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button type="button" onClick={onSignup} className="premium-primary-button w-full sm:w-auto px-7 py-3 text-sm">
                Start free trial
              </button>
              <button type="button" onClick={onLogin} className="premium-secondary-button w-full sm:w-auto px-7 py-3 text-sm text-white border-white/20 bg-white/10 hover:bg-white/20">
                Login to your workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer-section">
        <div className="mx-auto flex flex-col gap-8 px-6 py-12 sm:px-8 lg:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xl font-black text-slate-950 dark:text-white">PaperLens</p>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
              AI-first research workspace for papers, summaries, and collaborative discovery.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
            <a href="#" className="transition hover:text-slate-900 dark:hover:text-white">Product</a>
            <a href="#" className="transition hover:text-slate-900 dark:hover:text-white">Integrations</a>
            <a href="#" className="transition hover:text-slate-900 dark:hover:text-white">Privacy</a>
            <a href="#" className="transition hover:text-slate-900 dark:hover:text-white">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}



const NOTIFICATION_LABELS = {
  pdf_uploaded: "PDF uploaded",
  paper_summarized: "Summary generated",
  paper_analyzed: "Analysis completed",
  chat_completed: "Chat completed",
  export_generated: "Export generated",
  paper_deleted: "Paper deleted"
};

function Icon({ path, className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function formatRelativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units = [
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

function readStoredNotificationIds() {
  try {
    return JSON.parse(window.localStorage.getItem(READ_NOTIFICATIONS_KEY)) || [];
  } catch {
    return [];
  }
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

function NotificationCenter({
  activities,
  isOpen,
  onClearAll,
  onMarkAllRead,
  onMarkRead,
  onToggle,
  readIds
}) {
  const notifications = activities.filter((activity) => NOTIFICATION_LABELS[activity.type]);
  const unreadCount = notifications.filter(
    (notification) => !readIds.includes(notification._id)
  ).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="premium-icon-button relative"
        aria-label="Open notifications"
      >
        <Icon path="M15.5 17h-7m9-1.5V11a5.5 5.5 0 0 0-11 0v4.5L5 17h14z M10 20h4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95">
          <div className="flex items-center justify-between border-b border-slate-200/70 p-4 dark:border-white/10">
            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                Notifications
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onMarkAllRead} className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                Mark read
              </button>
              <button type="button" onClick={onClearAll} className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto p-2">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => {
                const isUnread = !readIds.includes(notification._id);

                return (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => onMarkRead(notification._id)}
                    className={`grid w-full gap-1 rounded-2xl p-3 text-left transition hover:bg-slate-100 dark:hover:bg-white/5 ${
                      isUnread ? "bg-indigo-50/80 dark:bg-indigo-500/10" : ""
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-950 dark:text-white">
                      {NOTIFICATION_LABELS[notification.type]}
                    </span>
                    <span className="break-words text-xs text-slate-600 dark:text-slate-300">
                      {notification.title}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatRelativeTime(notification.timestamp)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const {
    authMessage,
    consumeAuthMessage,
    isAuthenticated,
    isAuthLoading,
    logout,
    user
  } = useAuth();
  const [view, setView] = useState(getInitialView);
  const [selectedPaperId, setSelectedPaperId] = useState(getPaperIdFromPath);
  const [toasts, setToasts] = useState([]);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem(THEME_STORAGE_KEY) || "light"
  );
  const [notificationActivities, setNotificationActivities] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(
    readStoredNotificationIds
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const navigate = useCallback((nextView, { replace = false } = {}) => {
    setSelectedPaperId("");
    setView(nextView);
    const path = VIEW_TO_PATH[nextView] || "/dashboard";

    if (window.location.pathname !== path) {
      const method = replace ? "replaceState" : "pushState";
      window.history[method]({}, "", path);
    }
  }, []);

  const openDashboard = () => {
    navigate("dashboard");
  };

  const openUpload = () => {
    navigate("upload");
  };

  const openActivity = () => {
    navigate("activity");
  };

  const openProfile = () => {
    navigate("profile");
  };

  const openPaperDetail = (paperId) => {
    setSelectedPaperId(paperId);
    setView("detail");
  };

  const openChat = (paperId = "") => {
    setSelectedPaperId(paperId);
    setView("chat");
    const path = paperId ? `/chat/${encodeURIComponent(paperId)}` : "/chat";

    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  };

  const openLogin = () => navigate("login");
  const openSignup = () => navigate("signup");

  const handleLogout = () => {
    logout();
    navigate("login");
  };

  const markActivityChanged = useCallback(() => {
    setActivityRefreshKey((currentKey) => currentKey + 1);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  const markNotificationRead = useCallback((notificationId) => {
    setReadNotificationIds((currentIds) => {
      const nextIds = currentIds.includes(notificationId)
        ? currentIds
        : [...currentIds, notificationId];
      window.localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds));
      return nextIds;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const nextIds = notificationActivities.map((activity) => activity._id);
    setReadNotificationIds(nextIds);
    window.localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds));
  }, [notificationActivities]);

  const clearNotifications = useCallback(() => {
    const nextIds = notificationActivities.map((activity) => activity._id);
    setReadNotificationIds(nextIds);
    setNotificationActivities([]);
    window.localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds));
  }, [notificationActivities]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationActivities([]);
      return undefined;
    }

    const controller = new AbortController();

    async function loadNotificationActivities() {
      try {
        const activities = await fetchActivities({
          limit: 20,
          signal: controller.signal
        });
        setNotificationActivities(activities);
      } catch {
        setNotificationActivities([]);
      }
    }

    loadNotificationActivities();
    return () => controller.abort();
  }, [activityRefreshKey, isAuthenticated]);

  useEffect(() => {
    const onPopState = () => {
      setSelectedPaperId(getPaperIdFromPath());
      setView(getInitialView());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (authMessage) {
      const isError = authMessage.message.toLowerCase().includes("expired");
      addToast(authMessage.message, isError ? "error" : "success");
      consumeAuthMessage();
    }
  }, [addToast, authMessage, consumeAuthMessage]);

  useEffect(() => {
    const isPublicView = view === "login" || view === "signup";
    const isPublicOrLanding = isPublicView || view === "landing";

    if (!isAuthLoading && !isAuthenticated && !isPublicOrLanding) {
      addToast("Please log in to continue.", "error");
      navigate("login", { replace: true });
    }
  }, [addToast, isAuthenticated, isAuthLoading, navigate, view]);

  useEffect(() => {
    const isPublicView = view === "login" || view === "signup";
    const isPublicOrLanding = isPublicView || view === "landing";

    if (!isAuthLoading && isAuthenticated && isPublicOrLanding) {
      navigate("dashboard", { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate, view]);

  return (
    <main className="min-h-screen bg-[var(--pl-bg)] text-[var(--pl-text)] transition-colors duration-300">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="flex min-h-screen">
        {isAuthenticated && (
          <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/70 bg-white/70 p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70 lg:block">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-3xl px-2 py-3 text-left"
              onClick={openDashboard}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/20 dark:bg-white dark:text-slate-950">
                PL
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight text-slate-950 dark:text-white">
                  PaperLens
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  AI Research Workspace
                </span>
              </span>
            </button>

            <div className="mt-6 grid gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => {
                    if (item.view === "chat") {
                      openChat();
                    } else {
                      navigate(item.view);
                    }
                  }}
                  className={`premium-nav-item ${
                    view === item.view || (item.view === "dashboard" && view === "detail")
                      ? "premium-nav-item-active"
                      : ""
                  }`}
                >
                  <Icon path={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <button
                type="button"
                className="flex items-center gap-2 text-left lg:hidden"
                onClick={openDashboard}
              >
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                  PL
                </span>
                <span className="text-base font-black text-slate-950 dark:text-white">
                  PaperLens
                </span>
              </button>

              {isAuthenticated && (
                <div className="hidden min-w-0 lg:block">
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    Welcome back, {user?.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your papers, chats, and analysis are synced.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="premium-icon-button"
                  aria-label="Toggle theme"
                >
                  <Icon path={theme === "dark" ? "M12 3v2.5 M12 18.5V21 M4.5 4.5l1.75 1.75 M17.75 17.75l1.75 1.75 M3 12h2.5 M18.5 12H21 M4.5 19.5l1.75-1.75 M17.75 6.25l1.75-1.75 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" : "M20 14.5A7.5 7.5 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"} />
                </button>

                {isAuthenticated && (
                  <NotificationCenter
                    activities={notificationActivities}
                    isOpen={notificationsOpen}
                    onClearAll={clearNotifications}
                    onMarkAllRead={markAllNotificationsRead}
                    onMarkRead={markNotificationRead}
                    onToggle={() => setNotificationsOpen((isOpen) => !isOpen)}
                    readIds={readNotificationIds}
                  />
                )}

                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={openProfile}
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-xs font-black text-white shadow-lg shadow-slate-950/15 transition hover:scale-105 dark:bg-white dark:text-slate-950"
                    aria-label="Open profile"
                  >
                    {getInitials(user?.name)}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={openLogin} className="premium-secondary-button">
                      Login
                    </button>
                    <button type="button" onClick={openSignup} className="premium-primary-button">
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isAuthenticated && (
              <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:hidden">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => (item.view === "chat" ? openChat() : navigate(item.view))}
                    className={`premium-mobile-nav ${
                      view === item.view || (item.view === "dashboard" && view === "detail")
                        ? "premium-mobile-nav-active"
                        : ""
                    }`}
                  >
                    <Icon path={item.icon} className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </header>

          <div className="page-fade">
            {!isAuthenticated && !isAuthLoading && (view === "login" || view === "signup") && null}
            {isAuthenticated && view === "activity" && (
              <Activity refreshKey={activityRefreshKey} />
            )}
          </div>

      {isAuthLoading && (
        <section className="grid min-h-[calc(100vh-73px)] place-items-center px-4 py-8 text-sm font-semibold text-slate-600">
          Restoring your session...
        </section>
      )}

      {!isAuthLoading && view === "login" && (
        <Login
          onAuthenticated={() => navigate("dashboard", { replace: true })}
          onShowSignup={openSignup}
          onToast={addToast}
        />
      )}
      {!isAuthLoading && view === "signup" && (
        <Signup
          onAuthenticated={() => navigate("dashboard", { replace: true })}
          onShowLogin={openLogin}
          onToast={addToast}
        />
      )}
      {!isAuthLoading && !isAuthenticated && view === "landing" && (
        <LandingPage onLogin={openLogin} onSignup={openSignup} />
      )}
      {!isAuthLoading && isAuthenticated && view === "dashboard" && (
        <Dashboard
          activityRefreshKey={activityRefreshKey}
          onActivityChange={markActivityChanged}
          onChatPaper={openChat}
          onOpenActivity={openActivity}
          onViewPaper={openPaperDetail}
          onUploadPaper={openUpload}
          user={user}
        />
      )}
      {!isAuthLoading && isAuthenticated && view === "detail" && (
        <PaperDetail paperId={selectedPaperId} onBack={openDashboard} />
      )}
      {!isAuthLoading && isAuthenticated && view === "chat" && (
        <Chat
          onActivityChange={markActivityChanged}
          paperId={selectedPaperId}
          onBack={openDashboard}
          onOpenChat={openChat}
        />
      )}
      {!isAuthLoading && isAuthenticated && view === "upload" && (
        <div className="app-shell">
          <PDFUpload onActivityChange={markActivityChanged} />
        </div>
      )}
      {!isAuthLoading && isAuthenticated && view === "analytics" && <Analytics />}
      {!isAuthLoading && isAuthenticated && view === "profile" && (
        <Profile onLogout={handleLogout} />
      )}
        </div>
      </div>
    </main>
  );
}

export default App;
