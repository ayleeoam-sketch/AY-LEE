import type { Command } from "../../types/command";
import { requireGroup, requireGroupAdmin } from "./helpers";

const MAX_MESSAGE_LENGTH = 3_500;

const command: Command = {
  name: "tagall",
  aliases: ["everyone"],
  category: "group admin",
  description: "Mention the group members in one message.",
  usage: ".tagall",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const metadata = await context.sock.groupMetadata(context.chatJid);
    const members = metadata.participants.map((participant) => participant.id);
    const visible = [
      "╭━━『 TAG ALL 』━━╮",
      "📢 Attention everyone!",
      "",
    ];
    const included: string[] = [];
    for (const member of members) {
      const line = `@${member.split("@")[0]}`;
      if ([...visible, ...included.map((jid) => `@${jid.split("@")[0]}`), line, "╰━━━━━━━━━━━━━━╯"].join("\n").length > MAX_MESSAGE_LENGTH) break;
      included.push(member);
    }
    visible.push(...included.map((jid) => `@${jid.split("@")[0]}`));
    visible.push("", "╰━━━━━━━━━━━━━━╯");
    await context.sock.sendMessage(context.chatJid, {
      text: visible.join("\n"),
      mentions: included,
    });
  },
};

export default command;