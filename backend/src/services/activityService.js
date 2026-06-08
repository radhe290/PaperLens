const Activity = require("../models/Activity");

async function recordActivity({ userId, type, title, metadata = {} }) {
  if (!userId || !type || !title) {
    return null;
  }

  try {
    return await Activity.create({
      userId,
      type,
      title,
      metadata,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Activity recording failed:", error);
    return null;
  }
}

module.exports = {
  recordActivity
};
