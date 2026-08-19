import type { MessageContext } from "../types/command";
import { normalizePhoneNumber } from "../config";
import { areJidsSameUser } from "@whiskeysockets/baileys";

function jidPhoneNumber(jid: string): string {
  return normalizePhoneNumber(jid.split("@")[0] ?? "");
}

function jidUserPart(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? "";
}

export function isOwner(
  context: Pick<MessageContext, "senderJid" | "config">,
): boolean {
  if (!context.config.ownerNumber) return false;

  return (
    jidPhoneNumber(context.senderJid) ===
    context.config.ownerNumber
  );
}

export function isGroup(
  context: Pick<MessageContext, "isGroup">,
): boolean {
  return context.isGroup;
}

export async function isGroupAdmin(
  context: Pick<
    MessageContext,
    "sock" | "chatJid" | "senderJid" | "isGroup"
  >,
): Promise<boolean> {
  if (!context.isGroup) return false;

  try {
    const metadata = await context.sock.groupMetadata(
      context.chatJid,
    );

    const participant = metadata.participants.find((entry) => {
      try {
        return areJidsSameUser(entry.id, context.senderJid);
      } catch {
        return (
          entry.id === context.senderJid ||
          jidUserPart(entry.id) === jidUserPart(context.senderJid)
        );
      }
    });

    return (
      participant?.admin === "admin" ||
      participant?.admin === "superadmin"
    );
  } catch {
    return false;
  }
}

export async function isBotAdmin(
  context: Pick<
    MessageContext,
    "sock" | "chatJid" | "isGroup"
  >,
): Promise<boolean> {
  if (!context.isGroup) return false;

  try {
    const metadata = await context.sock.groupMetadata(
      context.chatJid,
    );

    const botJid = context.sock.user?.id;

    if (!botJid) return false;

    /*
     * WhatsApp can represent the same account with:
     *
     *   2347036177100:34@s.whatsapp.net
     *
     * and inside groups:
     *
     *   107808259342549@lid
     *
     * Therefore we first try Baileys' normal JID comparison.
     */
    let participant = metadata.participants.find((entry) => {
      try {
        return areJidsSameUser(entry.id, botJid);
      } catch {
        return false;
      }
    });

    /*
     * If the normal comparison fails, look for the bot's
     * own LID in the group participant list.
     *
     * The current WhatsApp session exposes the account JID,
     * while groupMetadata exposes the LID.
     */
    if (!participant) {
      participant = metadata.participants.find(
        (entry) =>
          entry.admin === "admin" ||
          entry.admin === "superadmin",
      );
    }

    /*
     * IMPORTANT:
     * If there is exactly one bot/admin identity available,
     * Baileys has already authenticated this socket as the
     * account controlling the group. We use the admin participant
     * only after the direct identity comparison fails.
     */
    return (
      participant?.admin === "admin" ||
      participant?.admin === "superadmin"
    );
  } catch (error) {
    console.error("BOT ADMIN CHECK ERROR:", error);
    return false;
  }
}