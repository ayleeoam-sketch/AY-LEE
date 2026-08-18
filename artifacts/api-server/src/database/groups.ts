import type { DatabaseRepository, GroupRecord } from "./database";

export function saveGroup(
  database: DatabaseRepository,
  group: GroupRecord,
): void {
  database.upsertGroup(group);
}