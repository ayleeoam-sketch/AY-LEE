import type { proto, WASocket } from "../types/baileys-types";
import { logger } from "../lib/logger";
import { saveGroup } from "../database/groups";
import { saveUser } from "../database/users";
import type { DatabaseRepository } from "../database/database";
import { handleCommand, type CommandRegistry } from "./commandHandler";
import { handleGroupProtections } from "./groupProtections";
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

function contextInfo(
  message: proto.IWebMessageInfo["message"],
): proto.MessageContextInfo | undefined {
  return (
    message?.extendedTextMessage?.contextInfo ??
    message?.imageMessage?.contextInfo ??
    message?.videoMessage?.contextInfo ??
    message?.documentMessage?.contextInfo ??
    message?.stickerMessage?.contextInfo
  );
}

export function registerMessageHandler(
  sock: WASocket,
  config: BotConfig,
  database: DatabaseRepository,
  registry: CommandRegistry,
  startedAt: number,
): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {    console.log(
      "DEBUG messages.upsert:",
      type,
      messages.map((m) => ({
        fromMe: m.key.fromMe,
        remoteJid: m.key.remoteJid,
        participant: m.key.participant,
	text: extractText(m.message),
      })),
    );
    if (type !== "notify") return;

    for (const message of messages) {
      if (message.key.remoteJid === "status@broadcast") {
        continue;
      }

      const chatJid = message.key.remoteJid;
      if (!chatJid) continue;

      const text = extractText(message.message) ?? "";
      const info = contextInfo(message.message);
      const isSticker = Boolean(message.message?.stickerMessage);
      if (!text && !isSticker) continue;

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

      const messageContext = {
        sock,
        chatJid,
        senderJid,
	fromMe: Boolean(message.key.fromMe),
        isGroup,
        messageId: message.key.id ?? undefined,
        pushName: message.pushName ?? undefined,
        text,
        quotedParticipant: info?.participant,
        quotedMessageKey: info?.stanzaId
          ? {
              remoteJid: info.remoteJid ?? chatJid,
              id: info.stanzaId,
              participant: info.participant,
              fromMe: info.fromMe,
            }
          : undefined,
        mentionedJids: info?.mentionedJid ?? [],
        isSticker,
        hasGroupMention: Boolean(info?.groupMentions?.length),
        config,
        database,
        startedAt,
      };

      try {
        await handleGroupProtections(messageContext);
        if (text) await handleCommand(sock, messageContext, registry);
      } catch (error) {
        logger.error({ err: error, chat: chatJid }, "Message handling failed");
      }
    }
  });
}
