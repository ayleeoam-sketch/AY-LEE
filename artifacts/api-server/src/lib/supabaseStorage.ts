import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const bucket =
  process.env.SUPABASE_BUCKET?.trim() ||
  "ay-lee-auth";

const sessionId =
  process.env.SESSION_ID?.trim() ||
  "AY-LEE-BOT-01";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);

const sessionFolder = sessionId;

/*
 * Prevent multiple auth uploads from running
 * at the same time.
 */
let uploadRunning = false;
let uploadQueued = false;

/*
 * Prevent excessive uploads.
 *
 * If Baileys fires many creds.update events quickly,
 * we wait before doing another complete backup.
 */
let uploadTimer: NodeJS.Timeout | undefined;

/* =========================================================
   LOCAL FILES
   ========================================================= */

async function listLocalFiles(
  dir: string,
  base = dir,
): Promise<string[]> {
  let entries;

  try {
    entries = await fs.readdir(dir, {
      withFileTypes: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(
      dir,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await listLocalFiles(
          fullPath,
          base,
        )),
      );
    } else {
      files.push(
        path
          .relative(base, fullPath)
          .replaceAll("\\", "/"),
      );
    }
  }

  return files;
}

/* =========================================================
   SUPABASE FILE LIST
   ========================================================= */

async function listStorageFiles(
  folder: string,
): Promise<string[]> {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        offset: 0,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

  if (error) {
    throw new Error(
      `Failed to list auth files: ${error.message}`,
    );
  }

  const files: string[] = [];

  for (const item of data ?? []) {
    if (!item.name) {
      continue;
    }

    const itemPath =
      `${folder}/${item.name}`;

    if (item.id === null) {
      files.push(
        ...(await listStorageFiles(
          itemPath,
        )),
      );
    } else {
      files.push(itemPath);
    }
  }

  return files;
}

/* =========================================================
   DOWNLOAD AUTH STATE
   ========================================================= */

export async function downloadAuthState(
  authDir: string,
): Promise<void> {
  await fs.mkdir(authDir, {
    recursive: true,
  });

  let files: string[];

  try {
    files =
      await listStorageFiles(
        sessionFolder,
      );
  } catch (error) {
    console.error(
      "FAILED TO LIST SUPABASE AUTH FILES:",
      error,
    );

    return;
  }

  console.log(
    `Found ${files.length} WhatsApp auth file(s) for session ${sessionId}.`,
  );

  if (files.length === 0) {
    console.log(
      `No existing WhatsApp session found for ${sessionId}.`,
    );

    return;
  }

  let restored = 0;
  let failed = 0;

  for (const storagePath of files) {
    const prefix =
      `${sessionFolder}/`;

    const relativePath =
      storagePath.startsWith(prefix)
        ? storagePath.slice(
            prefix.length,
          )
        : storagePath;

    try {
      const { data, error } =
        await supabase.storage
          .from(bucket)
          .download(storagePath);

      if (error) {
        failed++;

        console.error(
          `SUPABASE DOWNLOAD ERROR for ${storagePath}:`,
          error.message,
        );

        continue;
      }

      const destination =
        path.join(
          authDir,
          relativePath,
        );

      await fs.mkdir(
        path.dirname(destination),
        {
          recursive: true,
        },
      );

      await fs.writeFile(
        destination,
        Buffer.from(
          await data.arrayBuffer(),
        ),
      );

      restored++;
    } catch (error) {
      failed++;

      console.error(
        `FAILED TO RESTORE ${storagePath}:`,
        error,
      );
    }
  }

  console.log(
    `WhatsApp auth restore completed for ${sessionId}. Restored: ${restored}, failed: ${failed}.`,
  );
}

/* =========================================================
   ACTUAL AUTH UPLOAD
   ========================================================= */

async function performUploadAuthState(
  authDir: string,
): Promise<void> {
  if (uploadRunning) {
    uploadQueued = true;

    console.log(
      "WhatsApp auth upload already running. Another upload has been queued.",
    );

    return;
  }

  uploadRunning = true;

  try {
    console.log(
      `Backing up WhatsApp auth state for ${sessionId}...`,
    );

    let files: string[];

    try {
      files =
        await listLocalFiles(authDir);
    } catch (error) {
      console.error(
        "FAILED TO LIST LOCAL AUTH FILES:",
        error,
      );

      return;
    }

    if (files.length === 0) {
      console.warn(
        "No local WhatsApp auth files found.",
      );

      return;
    }

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const relativePath of files) {
      const localPath =
        path.join(
          authDir,
          relativePath,
        );

      const storagePath =
        `${sessionFolder}/${relativePath}`;

      try {
        /*
         * Read immediately.
         *
         * Baileys can remove a pre-key at any time.
         */
        const contents =
          await fs.readFile(localPath);

        const { error } =
          await supabase.storage
            .from(bucket)
            .upload(
              storagePath,
              contents,
              {
                upsert: true,
                contentType:
                  "application/json",
              },
            );

        if (error) {
          failed++;

          console.error(
            `SUPABASE UPLOAD ERROR for ${storagePath}:`,
            error.message,
          );

          continue;
        }

        uploaded++;
      } catch (error) {
        /*
         * Baileys may delete the file between
         * listing and reading it.
         */
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          skipped++;

          continue;
        }

        failed++;

        console.error(
          `FAILED TO UPLOAD ${relativePath}:`,
          error,
        );
      }
    }

    console.log(
      `WhatsApp auth backup complete. Uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}.`,
    );
  } finally {
    uploadRunning = false;

    /*
     * If another creds.update happened while
     * this upload was running, schedule one more.
     */
    if (uploadQueued) {
      uploadQueued = false;

      scheduleAuthUpload();
    }
  }
}

/* =========================================================
   SCHEDULED AUTH UPLOAD
   ========================================================= */

/**
 * Call this whenever Baileys fires creds.update.
 *
 * Multiple rapid events are combined into one upload.
 */
export function scheduleAuthUpload(
  authDir?: string,
): void {
  const directory =
    authDir ||
    process.env.AUTH_DIR?.trim() ||
    path.resolve(
      process.env.DATA_DIR?.trim() ||
        "data",
      "auth",
    );

  if (uploadTimer) {
    return;
  }

  uploadTimer = setTimeout(
    () => {
      uploadTimer = undefined;

      void performUploadAuthState(
        directory,
      );
    },
    3000,
  );
}

/**
 * Immediate upload.
 *
 * Use this when the WhatsApp connection
 * becomes fully online.
 */
export async function uploadAuthState(
  authDir: string,
): Promise<void> {
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = undefined;
  }

  await performUploadAuthState(
    authDir,
  );
}

/* =========================================================
   CLEAR AUTH STATE
   ========================================================= */

export async function clearAuthState(
  authDir: string,
): Promise<void> {
  console.log(
    `Starting WhatsApp auth reset for session ${sessionId}...`,
  );

  /*
   * Cancel pending backup.
   */
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = undefined;
  }

  uploadQueued = false;

  /* -------------------------------------------------------
     1. Clear local Render auth
     ------------------------------------------------------- */

  try {
    await fs.rm(authDir, {
      recursive: true,
      force: true,
    });

    await fs.mkdir(authDir, {
      recursive: true,
    });

    console.log(
      "Local WhatsApp auth state cleared.",
    );
  } catch (error) {
    console.error(
      "FAILED TO CLEAR LOCAL AUTH STATE:",
      error,
    );

    throw new Error(
      `Failed to clear local auth state: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  /* -------------------------------------------------------
     2. Clear ONLY this session from Supabase
     ------------------------------------------------------- */

  try {
    const files =
      await listStorageFiles(
        sessionFolder,
      );

    console.log(
      `Found ${files.length} auth file(s) for ${sessionId} to delete.`,
    );

    if (files.length > 0) {
      const { error } =
        await supabase.storage
          .from(bucket)
          .remove(files);

      if (error) {
        throw error;
      }

      console.log(
        `Supabase session ${sessionId} deleted successfully.`,
      );
    } else {
      console.log(
        `No Supabase auth files found for ${sessionId}.`,
      );
    }
  } catch (error) {
    console.error(
      "FAILED TO CLEAR SUPABASE AUTH STATE:",
      error,
    );

    throw new Error(
      `Failed to clear Supabase auth state: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  console.log(
    `WhatsApp auth state for ${sessionId} completely cleared.`,
  );
}
