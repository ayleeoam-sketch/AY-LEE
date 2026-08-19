import type { WASocket } from "../types/baileys-types";
import pino from "pino";
import QRCode from "qrcode";

import {
  downloadAuthState,
  uploadAuthState,
  clearAuthState,
} from "../lib/supabaseStorage";

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
  private qrCodeDataUrl: string | undefined;

  constructor(
    private readonly config: BotConfig,
    private readonly database: DatabaseRepository,
    private readonly registry: CommandRegistry,
    private readonly startedAt: number,
  ) {}

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getQrCode(): string | undefined {
    return this.qrCodeDataUrl;
  }

  async start(): Promise<void> {
    this.stopping = false;
    this.status = "starting";

    await this.connect();
  }

  private async connect(): Promise<void> {
    let baileys: typeof import("@whiskeysockets/baileys");

    try {
      baileys = await import(
        "@whiskeysockets/baileys"
      );
    } catch (error) {
      this.status = "stopped";

      logger.error(
        {
          errorType:
            error instanceof Error
              ? error.name
              : typeof error,
        },
        "WhatsApp connectivity is unavailable because the Baileys package could not be installed",
      );

      return;
    }

    try {
      await downloadAuthState(
        this.config.authDir,
      );

      logger.info(
        "WhatsApp auth state loaded from Supabase",
      );
    } catch (error) {
      logger.error(
        {
          errorType:
            error instanceof Error
              ? error.name
              : typeof error,
        },
        "Failed to load WhatsApp auth state from Supabase",
      );
    }

    const {
      state,
      saveCreds,
    } = await baileys.useMultiFileAuthState(
      this.config.authDir,
    );

    const baileysLogger = pino({
      level: "silent",
    });

    const socket = baileys.makeWASocket({
      auth: state,
      browser: baileys.Browsers.ubuntu(
        "AY-LEE BOT",
      ),
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

    socket.ev.on(
      "creds.update",
      async () => {
        try {
          await saveCreds();

          await uploadAuthState(
            this.config.authDir,
          );

          logger.info(
            "WhatsApp auth state uploaded to Supabase",
          );
        } catch (error) {
          logger.error(
            {
              errorType:
                error instanceof Error
                  ? error.name
                  : typeof error,
            },
            "Failed to save WhatsApp auth state to Supabase",
          );
        }
      },
    );

    socket.ev.on(
      "connection.update",
      async ({
        connection,
        lastDisconnect,
        qr,
      }) => {
        // -------------------------------------------------
        // NEW QR CODE
        // -------------------------------------------------

        if (qr) {
          this.status = "waiting_for_auth";

          try {
            this.qrCodeDataUrl =
              await QRCode.toDataURL(qr);

            logger.info(
              "WhatsApp QR code generated",
            );
          } catch (error) {
            logger.error(
              {
                errorType:
                  error instanceof Error
                    ? error.name
                    : typeof error,
              },
              "Failed to generate WhatsApp QR code",
            );
          }
        }

        // -------------------------------------------------
        // WHATSAPP CONNECTED
        // -------------------------------------------------

        if (connection === "open") {
          this.reconnectAttempts = 0;

          this.status = "online";

          this.qrCodeDataUrl = undefined;

          try {
            await uploadAuthState(
              this.config.authDir,
            );

            logger.info(
              "WhatsApp auth state saved to Supabase",
            );
          } catch (error) {
            logger.error(
              {
                errorType:
                  error instanceof Error
                    ? error.name
                    : typeof error,
              },
              "Failed to save WhatsApp auth state to Supabase",
            );
          }

          logger.info(
            "WhatsApp connected",
          );
        }

        // -------------------------------------------------
        // CONNECTION CLOSED
        // -------------------------------------------------

        if (
          connection !== "close" ||
          this.stopping
        ) {
          return;
        }

        const statusCode =
          (
            lastDisconnect?.error as
              | {
                  output?: {
                    statusCode?: number;
                  };
                }
              | undefined
          )?.output?.statusCode;

        // -------------------------------------------------
        // LOGGED OUT
        // -------------------------------------------------

        if (
          statusCode ===
          baileys.DisconnectReason.loggedOut
        ) {
          this.status = "logged_out";

          this.qrCodeDataUrl =
            undefined;

          logger.error(
            "WhatsApp session logged out. Clearing old auth state and preparing a fresh QR code.",
          );

          try {
            // Completely remove old session
            await clearAuthState(
              this.config.authDir,
            );

            // Reset connection state
            this.reconnectAttempts = 0;

            this.status = "starting";

            // Start a completely fresh WhatsApp session
            await this.connect();
          } catch (error) {
            this.status = "stopped";

            logger.error(
              {
                errorType:
                  error instanceof Error
                    ? error.name
                    : typeof error,
              },
              "Failed to reset WhatsApp auth state",
            );
          }

          return;
        }

        // -------------------------------------------------
        // NORMAL RECONNECT
        // -------------------------------------------------

        if (
          this.reconnectAttempts >=
          this.config.maxReconnectAttempts
        ) {
          this.status = "stopped";

          logger.error(
            {
              attempts:
                this.reconnectAttempts,
            },
            "WhatsApp reconnect limit reached; restart the bot to try again",
          );

          return;
        }

        this.reconnectAttempts += 1;

        const delay = Math.min(
          30_000,
          1_000 *
            2 **
              (this.reconnectAttempts - 1),
        );

        logger.warn(
          {
            attempt:
              this.reconnectAttempts,
            delay,
          },
          "WhatsApp connection closed; reconnecting",
        );

        this.reconnectTimer =
          setTimeout(() => {
            void this.connect().catch(
              (error: unknown) => {
                logger.error(
                  {
                    errorType:
                      error instanceof Error
                        ? error.name
                        : typeof error,
                  },
                  "WhatsApp reconnect failed",
                );
              },
            );
          }, delay);
      },
    );
  }

  async stop(): Promise<void> {
    this.stopping = true;

    this.status = "stopped";

    this.qrCodeDataUrl =
      undefined;

    if (this.reconnectTimer) {
      clearTimeout(
        this.reconnectTimer,
      );
    }

    this.reconnectTimer =
      undefined;

    this.socket?.end(
      undefined,
    );

    this.socket =
      undefined;

    logger.info(
      "WhatsApp connection stopped",
    );
  }
}
