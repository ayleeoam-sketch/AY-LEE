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

if (
  !supabaseUrl ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);

/*
 * Each WhatsApp bot gets its own folder.
 *
 * ay-lee-auth/
 *   AY-LEE-BOT-01/
 *     creds.json
 *     pre-key-1.json
 *     ...
 */
const sessionFolder = sessionId;

/* =========================================================
   LOCAL FILES
   ========================================================= */

async function listLocalFiles(
  dir: string,
  base = dir,
): Promise<string[]> {
  const entries = await fs.readdir(dir, {
    withFileTypes: true,
  });

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
    console.error(
      "SUPABASE STORAGE LIST ERROR:",
      error,
    );

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

    /*
     * Supabase folders normally have id === null.
     */
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

  const files =
    await listStorageFiles(
      sessionFolder,
    );

  console.log(
    `Found ${files.length} WhatsApp auth file(s) for session ${sessionId}.`,
  );

  if (files.length === 0) {
    console.log(
      `No existing WhatsApp session found for ${sessionId}. A new QR code will be generated.`,
    );

    return;
  }

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
        console.error(
          `SUPABASE DOWNLOAD ERROR for ${storagePath}:`,
          error,
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
    } catch (error) {
      console.error(
        `Failed to restore auth file ${storagePath}:`,
        error,
      );
    }
  }

  console.log(
    `WhatsApp auth state restored for session ${sessionId}.`,
  );
}

/* =========================================================
   UPLOAD AUTH STATE
   ========================================================= */

/*
 * Uploading auth files can race with Baileys because
 * Baileys constantly creates/replaces/deletes key files.
 *
 * Therefore:
 *
 * - Missing files are skipped.
 * - Individual upload failures don't kill the bot.
 * - The whole auth upload does not throw.
 */

export async function uploadAuthState(
  authDir: string,
): Promise<void> {
  console.log(
    `Checking local WhatsApp auth directory: ${authDir}`,
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

  console.log(
    `Found ${files.length} local WhatsApp auth file(s).`,
  );

  if (files.length === 0) {
    console.warn(
      "No WhatsApp auth files found locally. Nothing to upload.",
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
       * IMPORTANT:
       *
       * Read the file immediately before upload.
       * Baileys may have removed/replaced it after
       * listLocalFiles() ran.
       */
      const contents =
        await fs.readFile(localPath);

      console.log(
        `Uploading WhatsApp auth file: ${storagePath}`,
      );

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
          error,
        );

        continue;
      }

      uploaded++;

      console.log(
        `Uploaded successfully: ${storagePath}`,
      );
    } catch (error) {
      /*
       * ENOENT is normal occasionally because
       * Baileys can delete/replace a key file
       * between listing and reading it.
       */
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        skipped++;

        console.warn(
          `Auth file disappeared before upload, skipping: ${relativePath}`,
        );

        continue;
      }

      failed++;

      console.error(
        `FAILED TO PROCESS AUTH FILE ${relativePath}:`,
        error,
      );
    }
  }

  console.log(
    `WhatsApp auth upload completed for ${sessionId}. Uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}.`,
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
        console.error(
          "SUPABASE AUTH DELETE ERROR:",
          error,
        );

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
