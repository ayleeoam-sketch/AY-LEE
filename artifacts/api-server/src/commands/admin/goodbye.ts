import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { parseOnOff, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "goodbye",
  aliases: [],
  category: "group admin",
  description: "Enable or disable goodbye messages.",
  usage: ".goodbye <on|off>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const enabled = parseOnOff(context, ".goodbye on|off");
    if (enabled === undefined) return;
    updateGroupSettings(context.database, context.chatJid, {
      goodbyeEnabled: enabled,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: `✅ Goodbye messages ${enabled ? "enabled" : "disabled"}.`,
    });
  },
};

export default command;