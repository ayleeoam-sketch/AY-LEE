import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { parseOnOff, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "antitag",
  aliases: [],
  category: "group admin",
  description: "Remove excessive member mentions.",
  usage: ".antitag <on|off>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const enabled = parseOnOff(context, ".antitag on|off");
    if (enabled === undefined) return;
    updateGroupSettings(context.database, context.chatJid, {
      antitagEnabled: enabled,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: `✅ Antitag ${enabled ? "enabled" : "disabled"}.`,
    });
  },
};

export default command;