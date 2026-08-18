import type { Command } from "../../types/command";
import { getGroupSettings, updateGroupSettings } from "../../database/groupSettings";
import { parseOnOff, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "welcome",
  aliases: [],
  category: "group admin",
  description: "Enable or disable welcome messages.",
  usage: ".welcome <on|off>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const enabled = parseOnOff(context, ".welcome on|off");
    if (enabled === undefined) return;
    updateGroupSettings(context.database, context.chatJid, {
      welcomeEnabled: enabled,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: `✅ Welcome messages ${enabled ? "enabled" : "disabled"}.`,
    });
  },
};

export default command;