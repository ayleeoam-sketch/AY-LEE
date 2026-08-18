import type { Command } from "../../types/command";
import { requireBotAdmin, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "grouplink",
  aliases: ["invite"],
  category: "group admin",
  description: "Retrieve the group's invite link.",
  usage: ".grouplink",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    if (!(await requireBotAdmin(context))) return;
    try {
      const code = await context.sock.groupInviteCode(context.chatJid);
      await context.sock.sendMessage(context.chatJid, {
        text: `🔗 https://chat.whatsapp.com/${code}`,
      });
    } catch {
      await context.sock.sendMessage(context.chatJid, {
        text: "❌ I could not retrieve the group invite link.",
      });
    }
  },
};

export default command;