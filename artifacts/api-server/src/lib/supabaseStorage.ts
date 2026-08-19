import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const bucket =
  process.env.SUPABASE_BUCKET || "ay-lee-auth";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);

async function listLocalFiles(
  dir: string,
  base = dir,
): Promise<string[]> {
  const entries = await fs.readdir(dir, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await listLocalFiles(fullPath, base)),
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

async function listStorageFiles(
  folder = "",
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder || undefined, {
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
    if (!item.name) continue;

    const itemPath = folder
      ? `${folder}/${item.name}`
      : item.name;

    // Supabase Storage returns folders with id === null
    if (item.id === null) {
      files.push(
        ...(await listStorageFiles(itemPath)),
      );
    } else {
      files.push(itemPath);
    }
  }

  return files;
}

export async function downloadAuthState(
  authDir: string,
): Promise<void> {
  await fs.mkdir(authDir, {
    recursive: true,
  });

  const files = await listStorageFiles();

  console.log(
    `Found ${files.length} WhatsApp auth file(s) in Supabase.`,
  );

  for (const filePath of files) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error(
        `SUPABASE DOWNLOAD ERROR for ${filePath}:`,
        error,
      );

      throw new Error(
        `Failed to download ${filePath}: ${error.message}`,
      );
    }

    const destination = path.join(
      authDir,
      filePath,
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
  }
}

export async function uploadAuthState(
  authDir: string,
): Promise<void> {
  console.log(
    `Checking local WhatsApp auth directory: ${authDir}`,
  );

  const files = await listLocalFiles(authDir);

  console.log(
    `Found ${files.length} local WhatsApp auth file(s).`,
  );

  if (files.length === 0) {
    console.warn(
      "No WhatsApp auth files found locally. Nothing to upload.",
    );

    return;
  }

  for (const relativePath of files) {
    const localPath = path.join(
      authDir,
      relativePath,
    );

    console.log(
      `Uploading WhatsApp auth file: ${relativePath}`,
    );

    const contents = await fs.readFile(
      localPath,
    );

    const { error } = await supabase.storage
      .from(bucket)
      .upload(
        relativePath,
        contents,
        {
          upsert: true,
          contentType: "application/json",
        },
      );

    if (error) {
      console.error(
        `SUPABASE UPLOAD ERROR for ${relativePath}:`,
        error,
      );

      throw new Error(
        `Failed to upload ${relativePath}: ${error.message}`,
      );
    }

    console.log(
      `Uploaded successfully: ${relativePath}`,
    );
  }

  console.log(
    "WhatsApp auth state successfully uploaded to Supabase.",
  );
}

/**
 * Completely clears the WhatsApp authentication session
 * from both Render's local filesystem and Supabase Storage.
 *
 * This is useful after WhatsApp has been unlinked/logged out
 * and a fresh QR code is required.
 */
export async function clearAuthState(
  authDir: string,
): Promise<void> {
  console.log(
    "Starting complete WhatsApp auth state reset...",
  );

  // -------------------------------------------------------
  // 1. Clear local Render auth files
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // 2. Clear Supabase Storage auth files
  // -------------------------------------------------------

  try {
    const files = await listStorageFiles();

    console.log(
      `Found ${files.length} WhatsApp auth file(s) in Supabase to delete.`,
    );

    if (files.length > 0) {
      const { error } = await supabase.storage
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
        "Supabase WhatsApp auth files deleted successfully.",
      );
    } else {
      console.log(
        "Supabase auth bucket is already empty.",
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
    "WhatsApp auth state completely cleared.",
  );
}
