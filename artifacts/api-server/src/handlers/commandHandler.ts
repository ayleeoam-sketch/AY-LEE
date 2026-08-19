import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { WASocket } from "../types/baileys-types";
import { logger } from "../lib/logger";
import type {
  Command,
  CommandContext,
  MessageContext,
  Permission,
} from "../types/command";
import { isGroupAdmin, isOwner } from "../utils/permissions";

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly aliases = new Map<string, Command>();

  register(command: Command): void {
    const name = command.name.toLowerCase();
    this.commands.set(name, command);
    for (const alias of command.aliases) {
      this.aliases.set(alias.toLowerCase(), command);
    }
  }

  find(name: string): Command | undefined {
    return this.commands.get(name.toLowerCase()) ?? this.aliases.get(name.toLowerCase());
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  count(): number {
    return this.commands.size;
  }
}

async function walk(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(entryPath);
    }
  }
  return files;
}

function readCommand(module: Record<string, unknown>): Command | undefined {
  const candidate = module.default ?? Object.values(module).find((value) => value);
  if (!candidate || typeof candidate !== "object") return undefined;
  const command = candidate as Partial<Command>;
  if (
    typeof command.name !== "string" ||
    !Array.isArray(command.aliases) ||
    typeof command.execute !== "function"
  ) {
    return undefined;
  }
  return command as Command;
}

export async function loadCommands(): Promise<CommandRegistry> {
  const registry = new CommandRegistry();
  // The production bundle runs this loader from dist/index.mjs, while
  // compiled command modules are emitted under dist/commands.
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const commandDirectory = path.join(moduleDirectory, "commands");
  const files = (await walk(commandDirectory)).sort();

  for (const file of files) {
    const command = readCommand(
      (await import(pathToFileURL(file).href)) as Record<string, unknown>,
    );
    if (!command) continue;
    registry.register(command);
  }

  logger.info({ commandCount: registry.count() }, "Loaded commands");
  return registry;
}

function hasPermission(
  permission: Permission,
  context: CommandContext,
): Promise<boolean> | boolean {
  switch (permission) {
    case "public":
      return true;
    case "owner":
      return isOwner(context);
    case "group":
      return context.isGroup;
    case "group-admin":
      return isGroupAdmin(context);
  }
}

async function canExecute(
  command: Command,
  context: CommandContext,
): Promise<boolean> {
  for (const permission of command.permissions) {
    if (await hasPermission(permission, context)) return true;
  }
  return false;
}

export async function handleCommand(
  sock: WASocket,
  message: MessageContext,
  registry: CommandRegistry,
): Promise<boolean> {
  const text = message.text.trim();
  if (!text.startsWith(message.config.prefix)) return false;
  if (!message.fromMe) return false;
  const body = text.slice(message.config.prefix.length).trim();
  if (!body) return false;

  const [rawName, ...args] = body.split(/\s+/);
  const commandName = rawName.toLowerCase();
  const command = registry.find(commandName);
  if (!command) {
    await sock.sendMessage(message.chatJid, {
      text: `Unknown command. Try ${message.config.prefix}menu to see what I can do.`,
    });
    return true;
  }

  const context: CommandContext = {
    ...message,
    sock,
    args,
    commandName,
    registry,
  };

  if (!(await canExecute(command, context))) {
    await sock.sendMessage(message.chatJid, {
      text: "You do not have permission to use that command.",
    });
    return true;
  }

  logger.info(
    { command: `${message.config.prefix}${command.name}`, chat: message.chatJid },
    "Command received",
  );

  try {
    await command.execute(context);
  } catch (error) {
    logger.error({ err: error, command: command.name }, "Command failed");
    await sock.sendMessage(message.chatJid, {
      text: "I could not complete that command right now. Please try again.",
    });
  }

  return true;
}
