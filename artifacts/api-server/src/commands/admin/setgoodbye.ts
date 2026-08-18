import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "setgoodbye",
  aliases: [],
  category: "group admin",
  description: "Set the goodbye message for this group.",
  usage: ".setgoodbye <message>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const message = context.args.join(" ").trim();
    if (!message) {
      await context.sock.sendMessage(context.chatJid, {
        text: "Usage: .setgoodbye <message>\nPlaceholders: {name}, {group}",
      });
      return;
    }
    updateGroupSettings(context.database, context.chatJid, {
      goodbyeMessage: message,
    });
    await context.sock.sendMessage(context.chatJid, {
        text: "✅ Goodbye message updated.",
    });
  },
};

export default command;