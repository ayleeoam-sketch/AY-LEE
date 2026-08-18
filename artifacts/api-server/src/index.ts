import "dotenv/config";

import app from "./app";
import { WhatsAppConnection } from "./connection/whatsapp";
import { loadConfig } from "./config";
import { DatabaseRepository } from "./database/database";
import { loadCommands } from "./handlers/commandHandler";
import { logger } from "./lib/logger";

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

const config = loadConfig();
const database = new DatabaseRepository(config.databasePath);
const registry = await loadCommands();
const startedAt = Date.now();
const whatsapp = new WhatsAppConnection(config, database, registry, startedAt);
const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

logger.info(
  { botName: config.botName, prefix: config.prefix, version: config.version },
  "Starting AY-LEE BOT",
);

if (!config.ownerNumber) {
  logger.warn(
    "OWNER_NUMBER is not configured; owner-only checks will remain disabled until it is set",
  );
}

void whatsapp.start().catch((error: unknown) => {
  logger.error({ err: error }, "WhatsApp startup failed");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown requested");
  await whatsapp.stop();
  database.close();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
