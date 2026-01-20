import { createApp } from "./app.js";
import { env } from "./configs/env.js";
import { logger } from "./configs/logger.js";
import { connectDb } from "./configs/db.js";

async function main() {
  await connectDb();
  const app = createApp();

  app.listen(env.port, () => {
    logger.info(`Backend listening on http://localhost:${env.port}`);
  });
}

main().catch((e) => {
  logger.error({ e }, "Failed to start server");
  process.exit(1);
});
