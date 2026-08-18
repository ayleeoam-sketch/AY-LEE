import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { logger } from "../lib/logger";

export type UserRecord = {
  jid: string;
  name?: string;
  isGroup?: boolean;
};

export type GroupRecord = {
  jid: string;
  name?: string;
};

export type GroupSettings = {
  groupJid: string;
  antilinkEnabled: boolean;
  antilinkMode: "delete" | "warn" | "kick";
  antitagEnabled: boolean;
  antistickerEnabled: boolean;
  antigroupmentionEnabled: boolean;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  goodbyeEnabled: boolean;
  goodbyeMessage: string;
  warningThreshold: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupSettingsPatch = Partial<
  Omit<GroupSettings, "groupJid" | "createdAt" | "updatedAt">
>;

export type WarningRecord = {
  groupJid: string;
  userJid: string;
  warningCount: number;
  updatedAt: string;
};

export class DatabaseRepository {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
    logger.info("SQLite database ready");
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        jid TEXT PRIMARY KEY,
        name TEXT,
        is_group INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS groups (
        jid TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bot_settings (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS group_settings (
        group_jid TEXT PRIMARY KEY,
        antilink_enabled INTEGER NOT NULL DEFAULT 0,
        antilink_mode TEXT NOT NULL DEFAULT 'delete',
        antitag_enabled INTEGER NOT NULL DEFAULT 0,
        antisticker_enabled INTEGER NOT NULL DEFAULT 0,
        antigroupmention_enabled INTEGER NOT NULL DEFAULT 0,
        welcome_enabled INTEGER NOT NULL DEFAULT 0,
        welcome_message TEXT NOT NULL DEFAULT '👋 Welcome {name}!\n\nWelcome to {group} 🎉\n\nYou are member #{members}.',
        goodbye_enabled INTEGER NOT NULL DEFAULT 0,
        goodbye_message TEXT NOT NULL DEFAULT '👋 Goodbye {name}!\n\nWe wish you all the best.',
        warning_threshold INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS warnings (
        group_jid TEXT NOT NULL,
        user_jid TEXT NOT NULL,
        warning_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_jid, user_jid)
      );
    `);
  }

  upsertUser(user: UserRecord): void {
    this.db
      .prepare(`
        INSERT INTO users (jid, name, is_group)
        VALUES (@jid, @name, @isGroup)
        ON CONFLICT(jid) DO UPDATE SET
          name = COALESCE(excluded.name, users.name),
          is_group = excluded.is_group,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run({
        jid: user.jid,
        name: user.name ?? null,
        isGroup: user.isGroup ? 1 : 0,
      });
  }

  upsertGroup(group: GroupRecord): void {
    this.db
      .prepare(`
        INSERT INTO groups (jid, name)
        VALUES (@jid, @name)
        ON CONFLICT(jid) DO UPDATE SET
          name = COALESCE(excluded.name, groups.name),
          updated_at = CURRENT_TIMESTAMP
      `)
      .run({ jid: group.jid, name: group.name ?? null });
  }

  getSetting(name: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM bot_settings WHERE name = ?")
      .get(name) as { value?: string } | undefined;
    return row?.value;
  }

  setSetting(name: string, value: string): void {
    this.db
      .prepare(`
        INSERT INTO bot_settings (name, value)
        VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(name, value);
  }

  getGroupSettings(groupJid: string): GroupSettings {
    this.db
      .prepare("INSERT OR IGNORE INTO group_settings (group_jid) VALUES (?)")
      .run(groupJid);
    const row = this.db
      .prepare("SELECT * FROM group_settings WHERE group_jid = ?")
      .get(groupJid) as Record<string, unknown>;
    return this.mapGroupSettings(row);
  }

  updateGroupSettings(
    groupJid: string,
    patch: GroupSettingsPatch,
  ): GroupSettings {
    this.getGroupSettings(groupJid);
    const columns: Record<string, string> = {
      antilinkEnabled: "antilink_enabled",
      antilinkMode: "antilink_mode",
      antitagEnabled: "antitag_enabled",
      antistickerEnabled: "antisticker_enabled",
      antigroupmentionEnabled: "antigroupmention_enabled",
      welcomeEnabled: "welcome_enabled",
      welcomeMessage: "welcome_message",
      goodbyeEnabled: "goodbye_enabled",
      goodbyeMessage: "goodbye_message",
      warningThreshold: "warning_threshold",
    };
    const entries = Object.entries(patch).filter(([key]) => columns[key]);
    if (entries.length === 0) return this.getGroupSettings(groupJid);

    const assignments = entries
      .map(([key]) => `${columns[key]} = @${key}`)
      .concat("updated_at = CURRENT_TIMESTAMP")
      .join(", ");
    const values: Record<string, unknown> = { groupJid };
    for (const [key, value] of entries) {
      values[key] =
        typeof value === "boolean" ? (value ? 1 : 0) : value;
    }
    this.db
      .prepare(
        `UPDATE group_settings SET ${assignments} WHERE group_jid = @groupJid`,
      )
      .run(values);
    return this.getGroupSettings(groupJid);
  }

  incrementWarning(groupJid: string, userJid: string): WarningRecord {
    this.db
      .prepare(`
        INSERT INTO warnings (group_jid, user_jid, warning_count)
        VALUES (?, ?, 1)
        ON CONFLICT(group_jid, user_jid) DO UPDATE SET
          warning_count = warning_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(groupJid, userJid);
    return this.getWarnings(groupJid, userJid);
  }

  getWarnings(groupJid: string, userJid: string): WarningRecord {
    const row = this.db
      .prepare(
        "SELECT group_jid, user_jid, warning_count, updated_at FROM warnings WHERE group_jid = ? AND user_jid = ?",
      )
      .get(groupJid, userJid) as
      | {
          group_jid: string;
          user_jid: string;
          warning_count: number;
          updated_at: string;
        }
      | undefined;
    return {
      groupJid,
      userJid,
      warningCount: row?.warning_count ?? 0,
      updatedAt: row?.updated_at ?? new Date().toISOString(),
    };
  }

  resetWarnings(groupJid: string, userJid: string): void {
    this.db
      .prepare(
        "DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?",
      )
      .run(groupJid, userJid);
  }

  private mapGroupSettings(row: Record<string, unknown>): GroupSettings {
    const mode =
      row.antilink_mode === "warn" || row.antilink_mode === "kick"
        ? row.antilink_mode
        : "delete";
    return {
      groupJid: String(row.group_jid),
      antilinkEnabled: Boolean(row.antilink_enabled),
      antilinkMode: mode,
      antitagEnabled: Boolean(row.antitag_enabled),
      antistickerEnabled: Boolean(row.antisticker_enabled),
      antigroupmentionEnabled: Boolean(row.antigroupmention_enabled),
      welcomeEnabled: Boolean(row.welcome_enabled),
      welcomeMessage: String(row.welcome_message),
      goodbyeEnabled: Boolean(row.goodbye_enabled),
      goodbyeMessage: String(row.goodbye_message),
      warningThreshold: Math.max(1, Number(row.warning_threshold) || 3),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
      logger.info("SQLite database closed");
    }
  }
}