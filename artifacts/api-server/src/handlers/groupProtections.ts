import type { MessageContext } from "../types/command";
import { logger } from "../lib/logger";
import { getGroupSettings } from "../database/groupSettings";
import { addWarning } from "../database/warnings";
import { isBotAdmin, isGroupAdmin } from "../utils/permissions";
import { detectLinks } from "../utils/linkDetection";

async function deleteIncomingMessage(
  context: MessageContext,
): Promise<boolean> {
  if (!context.messageId) {
    logger.warn("AntiLink: message has no messageId");
    return false;
  }

  const botIsAdmin = await isBotAdmin(context);

  logger.info(
    {
      chat: context.chatJid,
      messageId: context.messageId,
      sender: context.senderJid,
      botIsAdmin,
    },
    "AntiLink: checking bot admin status",
  );

  if (!botIsAdmin) {
    logger.warn("AntiLink: bot is not detected as group admin");
    return false;
  }

  try {
    await context.sock.sendMessage(context.chatJid, {
      delete: {
        remoteJid: context.chatJid,
        id: context.messageId,
        participant: context.senderJid,
      },
    });

    logger.info(
      {
        chat: context.chatJid,
        messageId: context.messageId,
      },
      "AntiLink: message deleted",
    );

    return true;
  } catch (error) {
    logger.error(
      {
        err: error,
        chat: context.chatJid,
        messageId: context.messageId,
      },
      "AntiLink: failed to delete message",
    );

    return false;
  }
}

async function kickSender(context: MessageContext): Promise<boolean> {
  if (!(await isBotAdmin(context))) return false;

  try {
    await context.sock.groupParticipantsUpdate(
      context.chatJid,
      [context.senderJid],
      "remove",
    );

    return true;
  } catch (error) {
    logger.error(
      { err: error, chat: context.chatJid },
      "Failed to remove group member",
    );

    return false;
  }
}

async function warnSender(
  context: MessageContext,
  reason: string,
  threshold: number,
): Promise<void> {
  const warning = addWarning(
    context.database,
    context.chatJid,
    context.senderJid,
  );

  await context.sock.sendMessage(context.chatJid, {
    text: `⚠️ @${context.senderJid.split("@")[0]} has been warned.\n\nReason: ${reason}\nWarnings: ${warning.warningCount}/${threshold}`,
    mentions: [context.senderJid],
  });

  if (warning.warningCount >= threshold && !(await kickSender(context))) {
    await context.sock.sendMessage(context.chatJid, {
      text: "⚠️ The warning threshold was reached, but I need group admin privileges to kick this member.",
    });
  }
}

async function takeAction(
  context: MessageContext,
  mode: "delete" | "warn" | "kick",
  reason: string,
  threshold: number,
): Promise<void> {
  if (mode === "delete") {
    const deleted = await deleteIncomingMessage(context);

    if (!deleted) {
      await context.sock.sendMessage(context.chatJid, {
        text: "⚠️ I need to be a group admin to remove that message.",
      });
    }

    return;
  }

  if (mode === "warn") {
    await warnSender(context, reason, threshold);
    return;
  }

  if (!(await kickSender(context))) {
    await context.sock.sendMessage(context.chatJid, {
      text: "⚠️ I need to be a group admin to remove that member.",
    });
  }
}

export async function handleGroupProtections(
  context: MessageContext,
): Promise<void> {
  if (!context.isGroup) return;

  const senderIsAdmin = await isGroupAdmin(context);

  logger.info(
    {
      chat: context.chatJid,
      sender: context.senderJid,
      text: context.text,
      senderIsAdmin,
    },
    "Group protection check",
  );

  // Do not moderate group admins.
  if (senderIsAdmin) return;

  const settings = getGroupSettings(context.database, context.chatJid);

  const hasLink = Boolean(
    context.text && detectLinks(context.text),
  );

  logger.info(
    {
      chat: context.chatJid,
      antilinkEnabled: settings.antilinkEnabled,
      antilinkMode: settings.antilinkMode,
      hasLink,
      botIsAdmin: await isBotAdmin(context),
    },
    "AntiLink debug",
  );

  if (settings.antilinkEnabled && hasLink) {
    await takeAction(
      context,
      settings.antilinkMode,
      "links are not allowed",
      settings.warningThreshold,
    );

    return;
  }

  if (
    settings.antitagEnabled &&
    (context.mentionedJids.length >= 3 || context.hasGroupMention)
  ) {
    await takeAction(
      context,
      "delete",
      "excessive mentions are not allowed",
      settings.warningThreshold,
    );

    return;
  }

  if (settings.antistickerEnabled && context.isSticker) {
    await takeAction(
      context,
      "delete",
      "stickers are not allowed",
      settings.warningThreshold,
    );

    return;
  }

  if (settings.antigroupmentionEnabled && context.hasGroupMention) {
    await takeAction(
      context,
      "delete",
      "group-wide mentions are not allowed",
      settings.warningThreshold,
    );
  }
}