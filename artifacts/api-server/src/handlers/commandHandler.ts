import fs from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

import type { WASocket } from "../types/baileys-types";

import type {
  Command,
  CommandContext,
  MessageContext,
  Permission,
} from "../types/command";

import {
  isGroupAdmin,
  isOwner,
} from "../utils/permissions";

import { logger } from "../lib/logger";


/* =========================================================
   COMMAND REGISTRY
========================================================= */

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly aliases = new Map<string, Command>();

  register(command: Command): void {
    const name = command.name.trim().toLowerCase();

    this.commands.set(name, command);

    for (const alias of command.aliases ?? []) {
      this.aliases.set(
        alias.trim().toLowerCase(),
        command,
      );
    }
  }

  find(name: string): Command | undefined {
    const normalized = name.trim().toLowerCase();

    return (
      this.commands.get(normalized) ??
      this.aliases.get(normalized)
    );
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  count(): number {
    return this.commands.size;
  }
}


/* =========================================================
   FIND COMMAND FILES
========================================================= */

async function walk(
  directory: string,
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(
      directory,
      {
        withFileTypes: true,
      },
    );

    for (const entry of entries) {
      const entryPath = path.join(
        directory,
        entry.name,
      );

      if (entry.isDirectory()) {
        files.push(
          ...(await walk(entryPath)),
        );
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".mjs")
      ) {
        files.push(entryPath);
      }
    }
  } catch (error) {
    logger.error(
      {
        directory,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      "Failed to scan command directory",
    );
  }

  return files;
}


/* =========================================================
   READ COMMAND MODULE
========================================================= */

function readCommand(
  module: Record<string, unknown>,
): Command | undefined {
  const candidate =
    module.default ??
    Object.values(module).find(
      (value) =>
        value &&
        typeof value === "object",
    );

  if (
    !candidate ||
    typeof candidate !== "object"
  ) {
    return undefined;
  }

  const command =
    candidate as Partial<Command>;

  if (
    typeof command.name !== "string" ||
    !Array.isArray(command.aliases) ||
    typeof command.execute !== "function"
  ) {
    return undefined;
  }

  return command as Command;
}


/* =========================================================
   LOAD COMMANDS
========================================================= */

export async function loadCommands(): Promise<CommandRegistry> {
  const registry =
    new CommandRegistry();

  const moduleDirectory =
    path.dirname(
      fileURLToPath(import.meta.url),
    );

  const commandDirectory =
    path.join(
      moduleDirectory,
      "commands",
    );

  logger.info(
    {
      commandDirectory,
    },
    "Loading WhatsApp commands",
  );

  const files =
    (
      await walk(commandDirectory)
    ).sort();

  for (const file of files) {
    try {
      const module =
        (await import(
          pathToFileURL(file).href
        )) as Record<
          string,
          unknown
        >;

      const command =
        readCommand(module);

      if (!command) {
        logger.warn(
          { file },
          "Invalid command module skipped",
        );

        continue;
      }

      registry.register(command);

      logger.info(
        {
          command: command.name,
          file,
        },
        "Command loaded",
      );
    } catch (error) {
      logger.error(
        {
          file,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Failed to load command",
      );
    }
  }

  logger.info(
    {
      commandCount:
        registry.count(),
      commands:
        registry
          .all()
          .map(
            (command) =>
              command.name,
          ),
    },
    "Loaded commands",
  );

  return registry;
}


/* =========================================================
   PERMISSIONS
========================================================= */

function hasPermission(
  permission: Permission,
  context: CommandContext,
):
  | Promise<boolean>
  | boolean {
  switch (permission) {
    case "public":
      return true;

    case "owner":
      return isOwner(context);

    case "group":
      return context.isGroup;

    case "group-admin":
      return isGroupAdmin(context);

    default:
      return false;
  }
}


/* =========================================================
   CHECK COMMAND PERMISSION
========================================================= */

async function canExecute(
  command: Command,
  context: CommandContext,
): Promise<boolean> {
  /*
   * If a command has no permissions,
   * treat it as public.
   */
  if (
    !command.permissions ||
    command.permissions.length === 0
  ) {
    return true;
  }

  /*
   * Any matching permission is enough.
   */
  for (
    const permission of command.permissions
  ) {
    if (
      await hasPermission(
        permission,
        context,
      )
    ) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   HANDLE COMMAND
========================================================= */

export async function handleCommand(
  sock: WASocket,
  message: MessageContext,
  registry: CommandRegistry,
): Promise<boolean> {

  /*
   * Make sure there is text.
   */
  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";

  if (!text) {
    return false;
  }


  /*
   * Get prefix.
   */
  const prefix =
    message.config?.prefix || ".";


  /*
   * Ignore normal messages.
   *
   * Example:
   *
   * hello
   *
   * will be ignored.
   */
  if (!text.startsWith(prefix)) {
    return false;
  }


  /*
   * IMPORTANT:
   *
   * DO NOT use:
   *
   * if (!message.fromMe) return false;
   *
   * That was preventing messages from
   * other WhatsApp users from reaching
   * the bot.
   */


  /*
   * Remove prefix.
   *
   * .menu
   * becomes
   * menu
   */
  const body =
    text
      .slice(prefix.length)
      .trim();

  if (!body) {
    return false;
  }


  /*
   * Split command and arguments.
   *
   * .play wizkid essence
   *
   * command = play
   * args = ["wizkid", "essence"]
   */
  const parts =
    body.split(/\s+/);

  const rawName =
    parts.shift();

  if (!rawName) {
    return false;
  }

  const commandName =
    rawName.toLowerCase();

  const args = parts;


  /*
   * Find command.
   */
  const command =
    registry.find(commandName);


  /*
   * Unknown command.
   */
  if (!command) {

    logger.info(
      {
        command:
          `${prefix}${commandName}`,
        chat:
          message.chatJid,
      },
      "Unknown command received",
    );

    try {
      await sock.sendMessage(
        message.chatJid,
        {
          text:
            `❌ Unknown command.\n\n` +
            `Use ${prefix}menu to see available commands.`,
        },
      );
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Failed to send unknown command response",
      );
    }

    return true;
  }


  /*
   * Build command context.
   */
  const context: CommandContext = {
    ...message,

    sock,

    args,

    commandName,

    registry,
  };


  /*
   * Check permissions.
   */
  try {
    const allowed =
      await canExecute(
        command,
        context,
      );

    if (!allowed) {

      logger.warn(
        {
          command:
            command.name,
          chat:
            message.chatJid,
        },
        "Command permission denied",
      );

      await sock.sendMessage(
        message.chatJid,
        {
          text:
            "❌ You do not have permission to use that command.",
        },
      );

      return true;
    }
  } catch (error) {

    logger.error(
      {
        command:
          command.name,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      "Permission check failed",
    );

    await sock.sendMessage(
      message.chatJid,
      {
        text:
          "❌ I could not verify your permission right now.",
      },
    );

    return true;
  }


  /*
   * Log command.
   */
  logger.info(
    {
      command:
        `${prefix}${command.name}`,
      chat:
        message.chatJid,
      fromMe:
        message.fromMe,
      isGroup:
        message.isGroup,
      args,
    },
    "Command received",
  );


  /*
   * Execute command.
   */
  try {

    await command.execute(
      context,
    );

    logger.info(
      {
        command:
          command.name,
        chat:
          message.chatJid,
      },
      "Command completed",
    );

  } catch (error) {

    logger.error(
      {
        command:
          command.name,

        chat:
          message.chatJid,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      "Command failed",
    );

    try {
      await sock.sendMessage(
        message.chatJid,
        {
          text:
            "❌ I could not complete that command right now. Please try again.",
        },
      );
    } catch (sendError) {
      logger.error(
        {
          error:
            sendError instanceof Error
              ? sendError.message
              : String(sendError),
        },
        "Failed to send command error response",
      );
    }
  }

  return true;
}
