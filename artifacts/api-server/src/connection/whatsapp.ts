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
  private connecting = false;

  private status: ConnectionStatus = "stopped";
  private qrCodeDataUrl: string | undefined;

  private authUploadRunning = false;
  private authUploadQueued = false;

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
    this.reconnectAttempts = 0;

    this.status = "starting";

    logger.info("Starting AY-LEE BOT WhatsApp connection...");

    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopping) {
      return;
    }

    /*
     * Prevent multiple connection attempts
     * from creating multiple sockets.
     */
    if (this.connecting) {
      logger.warn(
        "WhatsApp connection attempt already running.",
      );

      return;
    }

    this.connecting = true;

    try {
      await this.createConnection();
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "WhatsApp connection creation failed",
      );

      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private async createConnection(): Promise<void> {
    if (this.stopping) {
      return;
    }

    let baileys: typeof import("@whiskeysockets/baileys");

    /*
     * Load Baileys.
     */
    try {
      baileys = await import(
        "@whiskeysockets/baileys"
      );
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

    /*
     * Clear any previous QR.
     */
    this.qrCodeDataUrl = undefined;

    /*
     * Restore session from Supabase.
     */
    try {
      await downloadAuthState(
        this.config.authDir,
      );

      logger.info(
        "WhatsApp auth state restored from Supabase",
      );
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Failed to restore WhatsApp auth state",
      );
    }

    /*
     * Create Baileys auth state.
     */
    const {
      state,
      saveCreds,
    } = await baileys.useMultiFileAuthState(
      this.config.authDir,
    );

    /*
     * Quiet Baileys logger.
     */
    const baileysLogger = pino({
      level: "silent",
    });

    /*
     * Create WhatsApp socket.
     */
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
     * Register bot message handler.
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
     * Save credentials.
     *
     * We queue uploads so multiple
     * creds.update events don't create
     * hundreds of simultaneous uploads.
     */
    socket.ev.on(
      "creds.update",
      async () => {
        await this.queueAuthUpload(
          saveCreds,
        );
      },
    );

    /*
     * WhatsApp connection events.
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
         * -----------------------------------------
         * NEW QR
         * -----------------------------------------
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
         * -----------------------------------------
         * CONNECTED
         * -----------------------------------------
         */
        if (connection === "open") {
          this.status = "online";

          this.reconnectAttempts = 0;

          this.qrCodeDataUrl = undefined;

          logger.info(
            "AY-LEE BOT is now ONLINE on WhatsApp",
          );

          /*
           * Save current session immediately.
           */
          await this.queueAuthUpload(
            saveCreds,
          );

          return;
        }

        /*
         * -----------------------------------------
         * NOT CLOSED
         * -----------------------------------------
         */
        if (
          connection !== "close" ||
          this.stopping
        ) {
          return;
        }

        /*
         * -----------------------------------------
         * CONNECTION CLOSED
         * -----------------------------------------
         */
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
         * Socket is dead.
         */
        if (this.socket === socket) {
          this.socket = undefined;
        }

        /*
         * -----------------------------------------
         * LOGGED OUT
         * -----------------------------------------
         */
        if (
          statusCode ===
          baileys.DisconnectReason.loggedOut
        ) {
          this.status = "logged_out";

          this.qrCodeDataUrl = undefined;

          logger.warn(
            "WhatsApp was logged out. Clearing old session.",
          );

          try {
            await clearAuthState(
              this.config.authDir,
            );

            this.reconnectAttempts = 0;

            this.status = "starting";

            logger.info(
              "Old WhatsApp session cleared. Generating new QR...",
            );

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
              "Failed to reset WhatsApp session",
            );
          }

          return;
        }

        /*
         * -----------------------------------------
         * NORMAL RECONNECT
         * -----------------------------------------
         */
        this.scheduleReconnect();
      },
    );
  }

  /*
   * Queue auth uploads.
   *
   * This prevents Baileys from causing
   * many simultaneous Supabase uploads.
   */
  private async queueAuthUpload(
    saveCreds: () => Promise<void>,
  ): Promise<void> {
    this.authUploadQueued = true;

    if (this.authUploadRunning) {
      return;
    }

    this.authUploadRunning = true;

    try {
      while (this.authUploadQueued) {
        this.authUploadQueued = false;

        try {
          await saveCreds();

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
            "Failed to save WhatsApp auth state",
          );
        }
      }
    } finally {
      this.authUploadRunning = false;
    }
  }

  /*
   * Schedule reconnect.
   */
  private scheduleReconnect(): void {
    if (this.stopping) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    /*
     * We don't want the bot to permanently stop
     * just because Render temporarily woke/restarted
     * or WhatsApp disconnected.
     *
     * Therefore use a long retry cycle.
     */
    this.reconnectAttempts += 1;

    /*
     * Maximum 30 seconds between attempts.
     */
    const delay = Math.min(
      30_000,
      2_000 *
        2 **
          Math.min(
            this.reconnectAttempts - 1,
            4,
          ),
    );

    this.status = "starting";

    logger.warn(
      {
        attempt: this.reconnectAttempts,
        delay,
      },
      "Scheduling WhatsApp reconnect",
    );

    this.reconnectTimer =
      setTimeout(() => {
        this.reconnectTimer =
          undefined;

        if (this.stopping) {
          return;
        }

        void this.connect();
      }, delay);
  }

  async stop(): Promise<void> {
    this.stopping = true;

    this.status = "stopped";

    this.qrCodeDataUrl = undefined;

    if (this.reconnectTimer) {
      clearTimeout(
        this.reconnectTimer,
      );

      this.reconnectTimer =
        undefined;
    }

    try {
      this.socket?.end(undefined);
    } catch (error) {
      logger.warn(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Error while closing WhatsApp socket",
      );
    }

    this.socket = undefined;

    logger.info(
      "WhatsApp connection stopped",
    );
  }
}
