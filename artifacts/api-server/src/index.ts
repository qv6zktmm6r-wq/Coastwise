import app from "./app";
import { logger } from "./lib/logger";
import { purgeUnsafeFamilySyncDocuments } from "./routes/family";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  const sanitizedDocuments = await purgeUnsafeFamilySyncDocuments();
  if (sanitizedDocuments > 0) {
    logger.info({ sanitizedDocuments }, "Removed device-local fields from family sync documents");
  }
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "API startup failed");
  process.exit(1);
});
