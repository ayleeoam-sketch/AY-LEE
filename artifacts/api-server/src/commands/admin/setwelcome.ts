import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "setwelcome",
  aliases: [],
  category: "group admin",
  description: "Set the welcome message for this group.",
  usage: ".setwelcome <message>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const message = context.args.join(" ").trim();
    if (!message) {
      await context.sock.sendMessage(context.chatJid, {
        text: "Usage: .setwelcome <message>\nPlaceholders: {name}, {group}, {members}",
      });
      return;
    }
    updateGroupSettings(context.database, context.chatJid, {
      welcomeMessage: message,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: "✅ Welcome message updated.",
    });
  },
};

export default command;