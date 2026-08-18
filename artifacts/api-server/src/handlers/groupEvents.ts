import type { DatabaseRepository } from "../database/database";
import { getGroupSettings } from "../database/groupSettings";
import type { WASocket } from "../types/baileys-types";

export type GroupParticipantEvent = {
  groupJid: string;
  groupName: string;
  action: "add" | "remove";
  participantJid: string;
  participantName?: string;
  memberCount: number;
};

export function renderGroupMessage(
  template: string,
  values: { name: string; group: string; members: number },
): string {
  return template
    .replaceAll("{name}", values.name)
    .replaceAll("{group}", values.group)
    .replaceAll("{members}", String(values.members));
}

/**
 * Kept separate from the transport so the connection adapter can wire this to
 * group-participants.update when the WhatsApp runtime is available.
 */
export async function handleGroupParticipantEvent(
  sock: WASocket,
  database: DatabaseRepository,
  event: GroupParticipantEvent,
): Promise<void> {
  const settings = getGroupSettings(database, event.groupJid);
  const enabled =
    event.action === "add" ? settings.welcomeEnabled : settings.goodbyeEnabled;
  if (!enabled) return;

  const template =
    event.action === "add" ? settings.welcomeMessage : settings.goodbyeMessage;
  await sock.sendMessage(event.groupJid, {
    text: renderGroupMessage(template, {
      name: event.participantName ?? `@${event.participantJid.split("@")[0]}`,
      group: event.groupName,
      members: event.memberCount,
    }),
    mentions: [event.participantJid],
  });
}