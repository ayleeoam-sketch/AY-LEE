import type {
  DatabaseRepository,
  GroupSettings,
  GroupSettingsPatch,
} from "./database";

export function getGroupSettings(
  database: DatabaseRepository,
  groupJid: string,
): GroupSettings {
  return database.getGroupSettings(groupJid);
}

export function updateGroupSettings(
  database: DatabaseRepository,
  groupJid: string,
  patch: GroupSettingsPatch,
): GroupSettings {
  return database.updateGroupSettings(groupJid, patch);
}