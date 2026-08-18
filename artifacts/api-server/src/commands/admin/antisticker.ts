import type { Command } from "../../types/command";
import { updateGroupSettings } from "../../database/groupSettings";
import { parseOnOff, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "antisticker",
  aliases: [],
  category: "group admin",
  description: "Remove stickers sent by regular members.",
  usage: ".antisticker <on|off>",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const enabled = parseOnOff(context, ".antisticker on|off");
    if (enabled === undefined) return;
    updateGroupSettings(context.database, context.chatJid, {
      antistickerEnabled: enabled,
    });
    await context.sock.sendMessage(context.chatJid, {
      text: `✅ Antisticker ${enabled ? "enabled" : "disabled"}.`,
    });
  },
};

export default command;