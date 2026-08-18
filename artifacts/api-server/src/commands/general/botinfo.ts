import type { Command } from "../../types/command";
import { formatUptime } from "../../utils/formatters";

const command: Command = {
  name: "botinfo",
  aliases: ["info"],
  category: "general",
  description: "Display AY-LEE BOT runtime and configuration information.",
  usage: ".botinfo",
  permissions: ["public"],
  async execute(context) {
    await context.sock.sendMessage(context.chatJid, {
      text: [
        `╭━━『 ${context.config.botName} 』━━╮`,
        `🤖 Name: ${context.config.botName}`,
        `⚡ Prefix: ${context.config.prefix}`,
        `📦 Commands: ${context.registry.count()}`,
        `🌟 Version: ${context.config.version}`,
        `⏱️ Uptime: ${formatUptime(Date.now() - context.startedAt)}`,
        "🟢 Status: Online",
        "",
        "╰━━━━━━━━━━━━━━━━━╯",
      ].join("\n"),
    });
  },
};

export default command;