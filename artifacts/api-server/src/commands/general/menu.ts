import type { Command } from "../../types/command";
import { formatCommandMenu } from "../../utils/formatters";

const command: Command = {
  name: "menu",
  aliases: ["commands"],
  category: "general",
  description: "Show all available AY-LEE BOT commands.",
  usage: ".menu",
  permissions: ["public"],
  async execute(context) {
    await context.sock.sendMessage(context.chatJid, {
      text: formatCommandMenu(
        context.registry,
        context.config.prefix,
        context.config.botName,
        context.config.ownerName,
        context.config.version,
        context.pushName ? `@${context.pushName}` : "there",
      ),
    });
  },
};

export default command;