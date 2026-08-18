import type {
  DatabaseRepository,
  WarningRecord,
} from "./database";

export function addWarning(
  database: DatabaseRepository,
  groupJid: string,
  userJid: string,
): WarningRecord {
  return database.incrementWarning(groupJid, userJid);
}

export function getWarnings(
  database: DatabaseRepository,
  groupJid: string,
  userJid: string,
): WarningRecord {
  return database.getWarnings(groupJid, userJid);
}

export function resetWarnings(
  database: DatabaseRepository,
  groupJid: string,
  userJid: string,
): void {
  database.resetWarnings(groupJid, userJid);
}