import type { Command } from "../../types/command";
import { displayTarget, getTarget, requireBotAdmin, requireGroup, requireGroupAdmin, updateParticipant } from "./helpers";

const command: Command = {
  name: "promote",
  aliases: [],
  category: "group admin",
  description: "Make a member a group administrator.",
  usage: ".promote @user (or reply to their message)",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    const target = getTarget(context);
    if (!target) {
      await context.sock.sendMessage(context.chatJid, {
        text: "❌ Mention a user or reply to their message.",
      });
      return;
    }
    if (!(await requireBotAdmin(context))) return;
    if (await updateParticipant(context, target, "promote")) {
      await context.sock.sendMessage(context.chatJid, {
        text: `✅ Promoted ${displayTarget(target)} to group admin.`,
        mentions: [target],
      });
    }
  },
};

export default command;