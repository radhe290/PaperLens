const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/authRoutes");
const uploadRouter = require("./routes/upload");
const summaryRouter = require("./routes/summary");
const analysisRouter = require("./routes/analysisRoutes");
const activityRouter = require("./routes/activityRoutes");
const analyticsRouter = require("./routes/analyticsRoutes");
const chatRouter = require("./routes/chatRoutes");
const paperRouter = require("./routes/paperRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Simple request logger for debugging route issues
app.use((req, res, next) => {
  console.info(`[req] ${req.method} ${req.originalUrl}`);
  next();
});

const allowedOrigins = [
  "http://localhost:5173",
  "https://paper-lens-virid.vercel.app",
  "https://paper-lens-git-main-radhika-dwivedis-projects-ffb2469c.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===== ROUTE REGISTRATION (CRITICAL: Order matters, no duplicates) =====
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/papers", paperRouter);  // SINGLE place for /api/papers/* routes
app.use("/api/activities", activityRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/chat", chatRouter);

// Legacy routes for backward compatibility (deprecated)
// app.use("/api/summarize", summaryRouter);      // Use POST /api/papers/:id/generate-summary instead
// app.use("/api/analyze", analysisRouter);       // Use POST /api/papers/:id/generate-analysis instead

app.get("/test-auth", (req, res) => {
  res.json({ success: true });
});
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
