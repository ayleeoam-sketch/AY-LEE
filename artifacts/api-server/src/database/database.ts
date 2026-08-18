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

export class DatabaseRepository {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
    logger.info({ databasePath }, "SQLite database ready");
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

  close(): void {
    if (this.db.open) {
      this.db.close();
      logger.info("SQLite database closed");
    }
  }
}