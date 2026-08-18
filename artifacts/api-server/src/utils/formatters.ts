import type { Command, CommandRegistryLike } from "../types/command";

export function formatUptime(milliseconds: number): string {
  let seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  seconds %= 86_400;
  const hours = Math.floor(seconds / 3_600);
  seconds %= 3_600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function formatCommandMenu(
  registry: CommandRegistryLike,
  prefix: string,
  botName: string,
  ownerName: string,
  version: string,
  greeting: string,
): string {
  const grouped = new Map<string, Command[]>();
  for (const command of registry.all()) {
    const commands = grouped.get(command.category) ?? [];
    commands.push(command);
    grouped.set(command.category, commands);
  }

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, commands]) => {
      const lines = commands
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((command) => `│ ➜ ${prefix}${command.name}`)
        .join("\n");
      const icon = category.toLowerCase() === "group admin" ? "🛡️" : "🧭";
      return `┏━━━━━━━━━━━━━━━━━\n┃ ${icon} ${category.toUpperCase()}\n┗━━━━━━━━━━━━━━━━━\n${lines}`;
    })
    .join("\n\n");

  return [
    `╭━━『 *${botName}* 』━━╮`,
    `👋 Hello ${greeting}!`,
    `⚡ Prefix: ${prefix}`,
    `📦 Total Commands: ${registry.count()}`,
    `👑 Owner: ${ownerName}`,
    `🤖 Version: ${version}`,
    "",
    sections,
    "",
    "╰━━━━━━━━━━━━━━━━━╯",
    "",
    `💡 Type ${prefix}help <command> for more info.`,
  ].join("\n");
}

export function formatHelp(
  command: Command,
  prefix: string,
  botName: string,
): string {
  return [
    `╭━━『 COMMAND HELP 』━━╮`,
    `📌 Command: ${prefix}${command.name}`,
    "",
    `📝 Description:`,
    command.description,
    "",
    `📖 Usage:`,
    command.usage.replace(/^\./, prefix),
    "",
    `📂 Category:`,
    command.category,
    "",
    `🤖 ${botName}`,
    "╰━━━━━━━━━━━━━━━━━╯",
  ].join("\n");
}