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

    logger.info("Starting WhatsApp connection...");

    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopping) {
      return;
    }

    let baileys: typeof import("@whiskeysockets/baileys");

    try {
      baileys = await import("@whiskeysockets/baileys");
    } catch (error) {
      this.status = "stopped";

      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Failed to load Baileys",
      );

      return;
    }

    try {
      await downloadAuthState(this.config.authDir);

      logger.info(
        "WhatsApp auth state loaded from Supabase",
      );
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
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

    logger.info(
      "WhatsApp socket created",
    );

    /*
     * IMPORTANT:
     * Register the message handler immediately after
     * creating the socket.
     */
    try {
      registerMessageHandler(
        socket,
        this.config,
        this.database,
        this.registry,
        this.startedAt,
      );

      logger.info(
        "WhatsApp message handler registered",
      );
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Failed to register WhatsApp message handler",
      );
    }

    /*
     * Save authentication credentials whenever
     * Baileys updates them.
     */
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
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
            "Failed to save WhatsApp auth state",
          );
        }
      },
    );

    /*
     * TEMPORARY DEBUG LISTENER
     *
     * This lets us confirm that WhatsApp messages
     * are actually reaching the server.
     */
    socket.ev.on(
      "messages.upsert",
      (event) => {
        try {
          logger.info(
            {
              type: event.type,
              messageCount: event.messages?.length ?? 0,
            },
            "WhatsApp message event received",
          );

          for (const message of event.messages ?? []) {
            const remoteJid =
              message.key.remoteJid;

            const fromMe =
              message.key.fromMe;

            const messageText =
              message.message?.conversation ??
              message.message?.extendedTextMessage?.text ??
              message.message?.imageMessage?.caption ??
              message.message?.videoMessage?.caption ??
              "";

            logger.info(
              {
                remoteJid,
                fromMe,
                text: messageText,
              },
              "Incoming WhatsApp message",
            );
          }
        } catch (error) {
          logger.error(
            {
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
            "Error processing WhatsApp debug message event",
          );
        }
      },
    );

    /*
     * Connection state
     */
    socket.ev.on(
      "connection.update",
      async ({
        connection,
        lastDisconnect,
        qr,
      }) => {
        logger.info(
          {
            connection,
            hasQr: Boolean(qr),
          },
          "WhatsApp connection update",
        );

        /*
         * NEW QR CODE
         */
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
                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              },
              "Failed to generate WhatsApp QR code",
            );
          }
        }

        /*
         * WHATSAPP CONNECTED
         */
        if (connection === "open") {
          this.reconnectAttempts = 0;
          this.status = "online";
          this.qrCodeDataUrl = undefined;

          logger.info(
            "WhatsApp connected successfully",
          );

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
                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              },
              "Failed to save WhatsApp auth state to Supabase",
            );
          }
        }

        /*
         * CONNECTION CLOSED
         */
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

        logger.warn(
          {
            statusCode,
          },
          "WhatsApp connection closed",
        );

        /*
         * LOGGED OUT
         */
        if (
          statusCode ===
          baileys.DisconnectReason.loggedOut
        ) {
          this.status = "logged_out";
          this.qrCodeDataUrl = undefined;

          logger.error(
            "WhatsApp session logged out. Clearing auth state.",
          );

          try {
            await clearAuthState(
              this.config.authDir,
            );

            this.reconnectAttempts = 0;
            this.status = "starting";

            await this.connect();
          } catch (error) {
            this.status = "stopped";

            logger.error(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              },
              "Failed to reset WhatsApp auth state",
            );
          }

          return;
        }

        /*
         * NORMAL RECONNECT
         */
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
            "WhatsApp reconnect limit reached",
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
                    error:
                      error instanceof Error
                        ? error.message
                        : String(error),
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
    this.qrCodeDataUrl = undefined;

    if (this.reconnectTimer) {
      clearTimeout(
        this.reconnectTimer,
      );
    }

    this.reconnectTimer = undefined;

    this.socket?.end(undefined);
    this.socket = undefined;

    logger.info(
      "WhatsApp connection stopped",
    );
  }
}
