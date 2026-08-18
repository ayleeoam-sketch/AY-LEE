import type { Command } from "../../types/command";
import { displayTarget, getTarget, requireBotAdmin, requireGroup, requireGroupAdmin, updateParticipant } from "./helpers";

const command: Command = {
  name: "kick",
  aliases: ["remove"],
  category: "group admin",
  description: "Remove a member from the group.",
  usage: ".kick @user (or reply to their message)",
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
    const botJid = context.sock.user?.id?.split(":")[0];
    if (botJid && target.startsWith(botJid)) {
      await context.sock.sendMessage(context.chatJid, {
        text: "❌ I cannot remove myself from the group.",
      });
      return;
    }
    if (!(await requireBotAdmin(context))) return;
    if (await updateParticipant(context, target, "remove")) {
      await context.sock.sendMessage(context.chatJid, {
        text: `✅ Removed ${displayTarget(target)} from the group.`,
        mentions: [target],
      });
    }
  },
};

export default command;