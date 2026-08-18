import type { Command } from "../../types/command";
import { formatHelp } from "../../utils/formatters";

const command: Command = {
  name: "help",
  aliases: ["h"],
  category: "general",
  description: "Show help for a command.",
  usage: ".help <command>",
  permissions: ["public"],
  async execute(context) {
    const requested = context.args[0];
    if (!requested) {
      await context.sock.sendMessage(context.chatJid, {
        text: `Use ${context.config.prefix}menu to see all available commands.`,
      });
      return;
    }

    const target = context.registry.find(requested);
    if (!target) {
      await context.sock.sendMessage(context.chatJid, {
        text: `I could not find that command. Try ${context.config.prefix}menu.`,
      });
      return;
    }

    await context.sock.sendMessage(context.chatJid, {
      text: formatHelp(target, context.config.prefix, context.config.botName),
    });
  },
};

export default command;