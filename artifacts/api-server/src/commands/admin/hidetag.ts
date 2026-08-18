import type { Command } from "../../types/command";
import { requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "hidetag",
  aliases: ["silenttag"],
  category: "group admin",
  description: "Mention all members while keeping the visible message concise.",
  usage: ".hidetag <message>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const text = context.args.join(" ").trim();
    if (!text) {
      await context.sock.sendMessage(context.chatJid, {
        text: "Usage: .hidetag <message>",
      });
      return;
    }
    const metadata = await context.sock.groupMetadata(context.chatJid);
    await context.sock.sendMessage(context.chatJid, {
      text,
      mentions: metadata.participants.map((participant) => participant.id),
    });
  },
};

export default command;