import type { Command } from "../../types/command";
import { displayTarget, getTarget, requireBotAdmin, requireGroup, requireGroupAdmin, updateParticipant } from "./helpers";

const command: Command = {
  name: "demote",
  aliases: [],
  category: "group admin",
  description: "Remove administrator status from a member.",
  usage: ".demote @user (or reply to their message)",
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
    if (await updateParticipant(context, target, "demote")) {
      await context.sock.sendMessage(context.chatJid, {
        text: `✅ Demoted ${displayTarget(target)}.`,
        mentions: [target],
      });
    }
  },
};

export default command;