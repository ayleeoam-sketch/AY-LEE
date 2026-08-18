import type { MessageKey, WASocket } from "./baileys-types";
import type { BotConfig } from "../config";
import type { DatabaseRepository } from "../database/database";

export type Permission = "public" | "owner" | "group" | "group-admin";

export type MessageContext = {
  sock: WASocket;
  chatJid: string;
  senderJid: string;
  isGroup: boolean;
  messageId?: string;
  pushName?: string;
  text: string;
  quotedParticipant?: string;
  quotedMessageKey?: MessageKey;
  mentionedJids: string[];
  isSticker: boolean;
  hasGroupMention: boolean;
  config: BotConfig;
  database: DatabaseRepository;
  startedAt: number;
};

export type CommandContext = MessageContext & {
  args: string[];
  commandName: string;
  registry: CommandRegistryLike;
};

export type Command = {
  name: string;
  aliases: string[];
  category: string;
  description: string;
  usage: string;
  permissions: Permission[];
  execute: (context: CommandContext) => Promise<void>;
};

export type CommandRegistryLike = {
  count(): number;
  all(): Command[];
  find(name: string): Command | undefined;
};