import type { Command } from "../../types/command";

const command: Command = {
  name: "ping",
  aliases: ["p"],
  category: "general",
  description: "Check whether the bot is online.",
  usage: ".ping",
  permissions: ["public"],
  async execute(context) {
    const started = Date.now();
    await context.sock.sendMessage(context.chatJid, {
      text: `🏓 Pong!\n\nBot: ${context.config.botName}\nStatus: Online\nResponse: ${Date.now() - started} ms`,
    });
  },
};

export default command;