import type { Command } from "../../types/command";
import { deleteMessage, requireBotAdmin, requireGroup, requireGroupAdmin } from "./helpers";

const command: Command = {
  name: "delete",
  aliases: ["del"],
  category: "group admin",
  description: "Delete a quoted message.",
  usage: ".delete (reply to a message)",
  permissions: ["group"],
  async execute(context) {
    if (!(await requireGroup(context)) || !(await requireGroupAdmin(context))) return;
    if (!context.quotedMessageKey) {
      await context.sock.sendMessage(context.chatJid, {
        text: "❌ Reply to a message with .delete",
      });
      return;
    }
    if (!(await requireBotAdmin(context))) return;
    if (!(await deleteMessage(context, context.quotedMessageKey))) {
      await context.sock.sendMessage(context.chatJid, {
        text: "❌ I could not identify the quoted message.",
      });
    }
  },
};

export default command;