import type { Command } from "../../types/command";
import { resetWarnings } from "../../database/warnings";
import { displayTarget, getTarget, requireGroup, requireGroupAdmin, sendMention } from "./helpers";

const command: Command = {
  name: "resetwarn",
  aliases: ["clearwarn"],
  category: "group admin",
  description: "Reset a member's warnings in this group.",
  usage: ".resetwarn @user (or reply to their message)",
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
    resetWarnings(context.database, context.chatJid, target);
    await sendMention(
      context,
      `✅ Warnings reset for ${displayTarget(target)}.`,
      target,
    );
  },
};

export default command;