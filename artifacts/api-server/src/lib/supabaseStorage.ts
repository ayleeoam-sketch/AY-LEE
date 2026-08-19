import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ay-lee-auth";

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

/**
 * Recursively list files in the Supabase Storage bucket.
 */
async function listStorageFiles(
  folder = "",
): Promise<string[]> {
  const { data, error } = await supabase.storage
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
    if (!item.name) continue;

    const itemPath = folder
      ? `${folder}/${item.name}`
      : item.name;

    // Supabase folders have a metadata property.
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

/**
 * Download the WhatsApp authentication files
 * from Supabase Storage into the local auth directory.
 */
export async function downloadAuthState(
  authDir: string,
): Promise<void> {
  await fs.mkdir(authDir, {
    recursive: true,
  });

  let files: string[];

  try {
    files = await listStorageFiles();
  } catch (error) {
    console.error(
      "SUPABASE AUTH DOWNLOAD ERROR:",
      error,
    );

    throw error;
  }

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

/**
 * Upload all WhatsApp authentication files
 * from the local auth directory to Supabase Storage.
 */
export async function uploadAuthState(
  authDir: string,
): Promise<void> {
  const files = await listLocalFiles(authDir);

  console.log(
    `Uploading ${files.length} WhatsApp auth file(s) to Supabase.`,
  );

  for (const relativePath of files) {
    const localPath = path.join(
      authDir,
      relativePath,
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
  }

  console.log(
    "WhatsApp auth state successfully uploaded to Supabase.",
  );
}
