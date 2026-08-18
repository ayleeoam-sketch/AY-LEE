import type { CommandContext } from "../../types/command";
import type { MessageKey } from "../../types/baileys-types";
import { isBotAdmin, isGroup, isGroupAdmin } from "../../utils/permissions";

export async function requireGroup(context: CommandContext): Promise<boolean> {
  if (isGroup(context)) return true;
  await context.sock.sendMessage(context.chatJid, {
    text: "❌ This command can only be used in a group.",
  });
  return false;
}

export async function requireGroupAdmin(
  context: CommandContext,
): Promise<boolean> {
  if (await isGroupAdmin(context)) return true;
  await context.sock.sendMessage(context.chatJid, {
    text: "❌ Only group admins can use this command.",
  });
  return false;
}

export async function requireBotAdmin(
  context: CommandContext,
): Promise<boolean> {
  if (await isBotAdmin(context)) return true;
  await context.sock.sendMessage(context.chatJid, {
    text: "⚠️ I need to be a group admin to perform this action.",
  });
  return false;
}

export function parseOnOff(
  context: CommandContext,
  usage: string,
): boolean | undefined {
  const value = context.args[0]?.toLowerCase();
  if (value === "on") return true;
  if (value === "off") return false;
  void context.sock.sendMessage(context.chatJid, {
    text: `Usage: ${usage}`,
  });
  return undefined;
}

export function getTarget(context: CommandContext): string | undefined {
  const mentioned = context.mentionedJids[0];
  if (mentioned) return mentioned;
  if (context.quotedParticipant) return context.quotedParticipant;

  const argument = context.args[0]?.replace(/^@/, "");
  if (argument && /^\d{5,}$/.test(argument)) {
    return `${argument}@s.whatsapp.net`;
  }
  return undefined;
}

export function displayTarget(jid: string): string {
  return `@${jid.split("@")[0]?.split(":")[0] ?? jid}`;
}

export async function sendMention(
  context: CommandContext,
  text: string,
  jid: string,
): Promise<void> {
  await context.sock.sendMessage(context.chatJid, {
    text,
    mentions: [jid],
  });
}

export async function deleteMessage(
  context: CommandContext,
  key?: MessageKey,
): Promise<boolean> {
  if (!key?.id) return false;
  await context.sock.sendMessage(context.chatJid, {
    delete: {
      remoteJid: key.remoteJid ?? context.chatJid,
      id: key.id,
      participant: key.participant ?? context.senderJid,
    },
  });
  return true;
}

export async function updateParticipant(
  context: CommandContext,
  target: string,
  action: "remove" | "promote" | "demote",
): Promise<boolean> {
  try {
    await context.sock.groupParticipantsUpdate(
      context.chatJid,
      [target],
      action,
    );
    return true;
  } catch {
    await context.sock.sendMessage(context.chatJid, {
      text: "I could not complete that group action. Please try again.",
    });
    return false;
  }
}