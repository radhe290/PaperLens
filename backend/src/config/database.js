const mongoose = require("mongoose");
const env = require("./env");

let isShuttingDown = false;

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });

  mongoose.connection.on("disconnected", () => {
    if (!isShuttingDown) {
      console.warn("MongoDB disconnected");
    }
  });

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000
  });

  return mongoose.connection;
}

async function closeDatabase() {
  isShuttingDown = true;
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}

function registerDatabaseShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      try {
        await closeDatabase();
        process.exit(0);
      } catch (error) {
        console.error("Error during MongoDB shutdown:", error);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = {
  connectDatabase,
  closeDatabase,
  registerDatabaseShutdown
};
