import type { proto, WASocket } from "../types/baileys-types";
import { logger } from "../lib/logger";
import { saveGroup } from "../database/groups";
import { saveUser } from "../database/users";
import type { DatabaseRepository } from "../database/database";
import { handleCommand, type CommandRegistry } from "./commandHandler";
import type { BotConfig } from "../config";

function extractText(message: proto.IWebMessageInfo["message"]): string | undefined {
  if (!message) return undefined;
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption
  );
}

export function registerMessageHandler(
  sock: WASocket,
  config: BotConfig,
  database: DatabaseRepository,
  registry: CommandRegistry,
  startedAt: number,
): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      if (message.key.fromMe || message.key.remoteJid === "status@broadcast") {
        continue;
      }

      const chatJid = message.key.remoteJid;
      if (!chatJid) continue;

      const text = extractText(message.message);
      if (!text) continue;

      const isGroup = chatJid.endsWith("@g.us");
      const senderJid = isGroup
        ? message.key.participant ?? chatJid
        : chatJid;

      saveUser(database, {
        jid: senderJid,
        name: message.pushName ?? undefined,
        isGroup: false,
      });

      if (isGroup) {
        let groupName: string | undefined;
        try {
          groupName = (await sock.groupMetadata(chatJid)).subject;
        } catch {
          logger.debug({ chat: chatJid }, "Could not load group metadata");
        }
        saveGroup(database, { jid: chatJid, name: groupName });
      }

      try {
        await handleCommand(
          sock,
          {
            sock,
            chatJid,
            senderJid,
            isGroup,
            messageId: message.key.id ?? undefined,
            pushName: message.pushName ?? undefined,
            text,
            config,
            database,
            startedAt,
          },
          registry,
        );
      } catch (error) {
        logger.error({ err: error, chat: chatJid }, "Message handling failed");
      }
    }
  });
}