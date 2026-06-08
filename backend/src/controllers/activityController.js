const Activity = require("../models/Activity");
const { recordActivity } = require("../services/activityService");

const CLIENT_ACTIVITY_TYPES = new Set(["export_generated"]);

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 12;
  }

  return Math.min(parsed, 50);
}

async function getActivities(req, res) {
  const limit = parseLimit(req.query.limit);

  const activities = await Activity.find({ userId: req.userId })
    .select("type title timestamp metadata")
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .lean();

  return res.status(200).json({ activities });
}

async function createActivity(req, res) {
  const type = typeof req.body.type === "string" ? req.body.type.trim() : "";
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const metadata =
    req.body.metadata && typeof req.body.metadata === "object"
      ? req.body.metadata
      : {};

  if (!CLIENT_ACTIVITY_TYPES.has(type)) {
    return res.status(400).json({ error: "Unsupported activity type." });
  }

  if (!title) {
    return res.status(400).json({ error: "Activity title is required." });
  }

  const activity = await recordActivity({
    userId: req.userId,
    type,
    title,
    metadata
  });

  return res.status(201).json({ activity });
}

module.exports = {
  createActivity,
  getActivities
};
