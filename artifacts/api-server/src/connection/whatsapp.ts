import type { WASocket } from "../types/baileys-types";
import pino from "pino";

import type { BotConfig } from "../config";
import { logger } from "../lib/logger";
import type { DatabaseRepository } from "../database/database";
import { registerMessageHandler } from "../handlers/messageHandler";
import type { CommandRegistry } from "../handlers/commandHandler";

export type ConnectionStatus =
  | "starting"
  | "waiting_for_auth"
  | "online"
  | "logged_out"
  | "stopped";

export class WhatsAppConnection {
  private socket: WASocket | undefined;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopping = false;
  private status: ConnectionStatus = "stopped";

  constructor(
    private readonly config: BotConfig,
    private readonly database: DatabaseRepository,
    private readonly registry: CommandRegistry,
    private readonly startedAt: number,
  ) {}

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async start(): Promise<void> {
    this.stopping = false;
    this.status = "starting";
    await this.connect();
  }

  private async connect(): Promise<void> {
    let baileys: typeof import("@whiskeysockets/baileys");

    try {
      baileys = await import("@whiskeysockets/baileys");
    } catch (error) {
      this.status = "stopped";
      logger.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "WhatsApp connectivity is unavailable because the Baileys package could not be installed",
      );
      return;
    }

    const { state, saveCreds } = await baileys.useMultiFileAuthState(
      this.config.authDir,
    );

    const baileysLogger = pino({ level: "silent" });

    const socket = baileys.makeWASocket({
      auth: state,
      browser: baileys.Browsers.ubuntu("AY-LEE BOT"),
      logger: baileysLogger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    }) as WASocket;

    this.socket = socket;

    registerMessageHandler(
      socket,
      this.config,
      this.database,
      this.registry,
      this.startedAt,
    );

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          this.status = "waiting_for_auth";

          logger.info(
            "WhatsApp authentication required; QR credentials are intentionally not written to logs",
          );
        }

        if (connection === "open") {
          this.reconnectAttempts = 0;
          this.status = "online";
          logger.info("WhatsApp connected");
        }

        if (connection !== "close" || this.stopping) return;

        const statusCode = (
          lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;

        if (statusCode === baileys.DisconnectReason.loggedOut) {
          this.status = "logged_out";

          logger.error(
            "WhatsApp session logged out. Remove the auth directory and restart to authenticate again.",
          );

          return;
        }

        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
          this.status = "stopped";

          logger.error(
            { attempts: this.reconnectAttempts },
            "WhatsApp reconnect limit reached; restart the bot to try again",
          );

          return;
        }

        this.reconnectAttempts += 1;

        const delay = Math.min(
          30_000,
          1_000 * 2 ** (this.reconnectAttempts - 1),
        );

        logger.warn(
          { attempt: this.reconnectAttempts, delay },
          "WhatsApp connection closed; reconnecting",
        );

        this.reconnectTimer = setTimeout(() => {
          void this.connect().catch((error: unknown) => {
            logger.error(
              {
                errorType: error instanceof Error ? error.name : typeof error,
              },
              "WhatsApp reconnect failed",
            );
          });
        }, delay);
      },
    );
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.status = "stopped";

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = undefined;

    this.socket?.end(undefined);
    this.socket = undefined;

    logger.info("WhatsApp connection stopped");
  }
}