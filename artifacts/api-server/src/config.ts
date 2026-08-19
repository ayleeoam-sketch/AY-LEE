import path from "node:path";

export type BotConfig = {
  botName: string;
  ownerName: string;
  ownerNumber: string;
  prefix: string;
  version: string;
  sessionId: string;
  authDir: string;
  databasePath: string;
  maxReconnectAttempts: number;
};

export function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

function resolveDataPath(value: string): string {
  return path.isAbsolute(value)
    ? value
    : path.resolve(process.cwd(), value);
}

export function loadConfig(): BotConfig {
  const ownerNumber = normalizePhoneNumber(
    process.env.OWNER_NUMBER ?? "",
  );

  const maxReconnectAttempts = Number.parseInt(
    process.env.MAX_RECONNECT_ATTEMPTS ?? "8",
    10,
  );

  const dataDir =
    process.env.DATA_DIR?.trim() || "data";

  const sessionId =
    process.env.SESSION_ID?.trim() ||
    "AY-LEE-BOT-01";

  return {
    botName:
      process.env.BOT_NAME?.trim() ||
      "AY-LEE BOT",

    ownerName:
      process.env.OWNER_NAME?.trim() ||
      "AY-LEE",

    ownerNumber,

    prefix:
      process.env.PREFIX?.trim() || ".",

    version:
      process.env.BOT_VERSION?.trim() ||
      "1.0.0",

    sessionId,

    authDir: resolveDataPath(
      process.env.AUTH_DIR?.trim() ||
        path.join(dataDir, "auth"),
    ),

    databasePath: resolveDataPath(
      process.env.DATABASE_PATH?.trim() ||
        path.join(
          dataDir,
          "ay-lee-bot.sqlite",
        ),
    ),

    maxReconnectAttempts:
      Number.isFinite(maxReconnectAttempts) &&
      maxReconnectAttempts > 0
        ? maxReconnectAttempts
        : 8,
  };
}
