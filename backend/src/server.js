const app = require("./app");
const env = require("./config/env");
const {
  connectDatabase,
  registerDatabaseShutdown
} = require("./config/database");

async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(env.port, () => {
      console.log(`Server running on port ${env.port} (${env.nodeEnv})`);
    });

    registerDatabaseShutdown(server);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
