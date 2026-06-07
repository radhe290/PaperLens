const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const healthRouter = require("./routes/health");
const uploadRouter = require("./routes/upload");
const summaryRouter = require("./routes/summary");
const analysisRouter = require("./routes/analysisRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/health", healthRouter);
app.use("/api/papers", uploadRouter);
app.use("/api/papers/summary", summaryRouter);
app.use("/api/papers/analyze", analysisRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
