import type { Command } from "../../types/command";
import { getWarnings } from "../../database/warnings";
import { getGroupSettings } from "../../database/groupSettings";
import { displayTarget, getTarget, requireGroup, requireGroupAdmin, sendMention } from "./helpers";

const command: Command = {
  name: "warnings",
  aliases: ["warns"],
  category: "group admin",
  description: "Show a member's warnings in this group.",
  usage: ".warnings @user (or reply to their message)",
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
    const warning = getWarnings(context.database, context.chatJid, target);
    const threshold = getGroupSettings(
      context.database,
      context.chatJid,
    ).warningThreshold;
    await sendMention(
      context,
      `⚠️ ${displayTarget(target)} has ${warning.warningCount}/${threshold} warnings.`,
      target,
    );
  },
};

export default command;