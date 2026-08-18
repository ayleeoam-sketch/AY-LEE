import type { Command } from "../../types/command";
import { formatUptime } from "../../utils/formatters";

const command: Command = {
  name: "uptime",
  aliases: ["up"],
  category: "general",
  description: "Display how long the current bot process has been running.",
  usage: ".uptime",
  permissions: ["public"],
  async execute(context) {
    await context.sock.sendMessage(context.chatJid, {
      text: `⏱️ ${context.config.botName} Uptime\n\n${formatUptime(Date.now() - context.startedAt)}`,
    });
  },
};

export default command;