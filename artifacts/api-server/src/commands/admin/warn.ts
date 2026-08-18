import type { Command } from "../../types/command";
import { addWarning } from "../../database/warnings";
import { getGroupSettings } from "../../database/groupSettings";
import { displayTarget, getTarget, requireBotAdmin, requireGroup, requireGroupAdmin, sendMention, updateParticipant } from "./helpers";

const command: Command = {
  name: "warn",
  aliases: [],
  category: "group admin",
  description: "Add a warning to a group member.",
  usage: ".warn @user (or reply to their message)",
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
    const settings = getGroupSettings(context.database, context.chatJid);
    const warning = addWarning(context.database, context.chatJid, target);
    await sendMention(
      context,
      `⚠️ ${displayTarget(target)} has been warned.\n\nWarnings: ${warning.warningCount}/${settings.warningThreshold}`,
      target,
    );
    if (warning.warningCount >= settings.warningThreshold) {
      if (await requireBotAdmin(context)) {
        if (await updateParticipant(context, target, "remove")) {
          await context.sock.sendMessage(context.chatJid, {
            text: `🚪 ${displayTarget(target)} reached the warning threshold and was removed.`,
            mentions: [target],
          });
        }
      }
    }
  },
};

export default command;