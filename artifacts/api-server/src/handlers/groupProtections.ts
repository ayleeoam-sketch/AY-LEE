import type { MessageContext } from "../types/command";
import { getGroupSettings } from "../database/groupSettings";
import { addWarning } from "../database/warnings";
import { isBotAdmin, isGroupAdmin } from "../utils/permissions";
import { detectLinks } from "../utils/linkDetection";

async function deleteIncomingMessage(context: MessageContext): Promise<boolean> {
  if (!context.messageId || !(await isBotAdmin(context))) return false;
  try {
    await context.sock.sendMessage(context.chatJid, {
      delete: {
        remoteJid: context.chatJid,
        id: context.messageId,
        participant: context.senderJid,
      },
    });
    return true;
  } catch {
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
  } catch {
    return false;
  }
}

async function warnSender(
  context: MessageContext,
  reason: string,
  threshold: number,
): Promise<void> {
  const warning = addWarning(context.database, context.chatJid, context.senderJid);
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
    if (!(await deleteIncomingMessage(context))) {
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
  if (!context.isGroup || (await isGroupAdmin(context))) return;
  const settings = getGroupSettings(context.database, context.chatJid);

  if (settings.antilinkEnabled && context.text && detectLinks(context.text)) {
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