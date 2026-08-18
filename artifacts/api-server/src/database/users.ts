import type { DatabaseRepository, UserRecord } from "./database";

export function saveUser(
  database: DatabaseRepository,
  user: UserRecord,
): void {
  database.upsertUser(user);
}