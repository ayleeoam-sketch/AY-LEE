import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { parseOnOff, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "antigroupmention",
  aliases: [],
  category: "group admin",
  description: "Remove group-wide mentions when supported by the message metadata.",
  usage: ".antigroupmention <on|off>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const enabled = parseOnOff(context, ".antigroupmention on|off");
    if (enabled === undefined) return;
    updateGroupSettings(context.database, context.chatJid, {
      antigroupmentionEnabled: enabled,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: `✅ Antigroupmention ${enabled ? "enabled" : "disabled"}.`,
    });
  },
};

export default command;