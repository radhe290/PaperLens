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

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", uploadRouter);
app.use("/api/summarize", summaryRouter);
app.use("/api/analyze", analysisRouter);
app.use("/api/papers", uploadRouter);
app.use("/api/papers", paperRouter);
app.use("/api/papers/summary", summaryRouter);
app.use("/api/papers/analyze", analysisRouter);
app.use("/api/activities", activityRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/chat", chatRouter);

app.get("/test-auth", (req, res) => {
  res.json({ success: true });
});
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
