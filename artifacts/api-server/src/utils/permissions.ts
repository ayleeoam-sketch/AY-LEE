import type { MessageContext } from "../types/command";
import { normalizePhoneNumber } from "../config";

function jidPhoneNumber(jid: string): string {
  return normalizePhoneNumber(jid.split("@")[0] ?? "");
}

export function isOwner(context: Pick<MessageContext, "senderJid" | "config">): boolean {
  if (!context.config.ownerNumber) return false;
  return jidPhoneNumber(context.senderJid) === context.config.ownerNumber;
}

export function isGroup(context: Pick<MessageContext, "isGroup">): boolean {
  return context.isGroup;
}

export async function isGroupAdmin(
  context: Pick<MessageContext, "sock" | "chatJid" | "senderJid" | "isGroup">,
): Promise<boolean> {
  if (!context.isGroup) return false;
  try {
    const metadata = await context.sock.groupMetadata(context.chatJid);
    const participant = metadata.participants.find(
      (entry) => entry.id === context.senderJid,
    );
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    return false;
  }
}

export async function isBotAdmin(
  context: Pick<MessageContext, "sock" | "chatJid" | "isGroup">,
): Promise<boolean> {
  if (!context.isGroup) return false;
  try {
    const metadata = await context.sock.groupMetadata(context.chatJid);
    const botJid = context.sock.user?.id?.split(":")[0];
    const participant = metadata.participants.find((entry) =>
      botJid ? entry.id.startsWith(botJid) : false,
    );
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    return false;
  }
}