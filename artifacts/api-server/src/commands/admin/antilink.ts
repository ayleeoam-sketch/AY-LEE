import type { Command } from "../../types/command";
import { getGroupSettings, updateGroupSettings } from "../../database/groupSettings";
import { requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "antilink",
  aliases: [],
  category: "group admin",
  description: "Block links in this group.",
  usage: ".antilink <on|off|delete|warn|kick>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const value = context.args[0]?.toLowerCase();
    if (!value) {
      const settings = getGroupSettings(context.database, context.chatJid);
      await context.sock.sendMessage(context.chatJid, {
        text: `Antilink is ${settings.antilinkEnabled ? "on" : "off"} (${settings.antilinkMode} mode).`,
      });
      return;
    }
    if (value === "on" || value === "off") {
      const settings = updateGroupSettings(context.database, context.chatJid, {
        antilinkEnabled: value === "on",
      });
      await context.sock.sendMessage(context.chatJid, {
        text: `✅ Antilink ${settings.antilinkEnabled ? "enabled" : "disabled"}.`,
      });
      return;
    }
    if (value === "delete" || value === "warn" || value === "kick") {
      updateGroupSettings(context.database, context.chatJid, {
        antilinkMode: value,
        antilinkEnabled: true,
      });
      await context.sock.sendMessage(context.chatJid, {
        text: `✅ Antilink enabled in ${value} mode.`,
      });
      return;
    }
    await context.sock.sendMessage(context.chatJid, {
      text: "Usage: .antilink on|off|delete|warn|kick",
    });
  },
};

export default command;