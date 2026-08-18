import type { Command } from "../../types/command";

const command: Command = {
  name: "owner",
  aliases: ["creator"],
  category: "general",
  description: "Display the configured bot owner.",
  usage: ".owner",
  permissions: ["public"],
  async execute(context) {
    await context.sock.sendMessage(context.chatJid, {
      text: [
        "╭━━『 BOT OWNER 』━━╮",
        `👑 Owner: ${context.config.ownerName}`,
        `🤖 Bot: ${context.config.botName}`,
        "",
        "╰━━━━━━━━━━━━━━━━━╯",
      ].join("\n"),
    });
  },
};

export default command;