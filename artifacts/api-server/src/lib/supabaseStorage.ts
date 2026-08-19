import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ay-lee-auth";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function listFilesRecursive(
  dir: string,
  base = dir,
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, base)));
    } else {
      files.push(
        path.relative(base, fullPath).replaceAll("\\", "/"),
      );
    }
  }

  return files;
}

export async function downloadAuthState(authDir: string): Promise<void> {
  await fs.mkdir(authDir, { recursive: true });

  const { data, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000 });

  if (error) {
    console.error("SUPABASE STORAGE ERROR:", error);
    throw new Error(
      `Failed to list auth files: ${error.message}`,
    );
  }

  for (const file of data ?? []) {
    if (!file.name) continue;

    const { data: fileData, error: downloadError } =
      await supabase.storage
        .from(bucket)
        .download(file.name);

    if (downloadError) {
      console.error(
        "SUPABASE DOWNLOAD ERROR:",
        downloadError,
      );

      throw new Error(
        `Failed to download ${file.name}: ${downloadError.message}`,
      );
    }

    const destination = path.join(authDir, file.name);

    await fs.mkdir(path.dirname(destination), {
      recursive: true,
    });

    await fs.writeFile(
      destination,
      Buffer.from(await fileData.arrayBuffer()),
    );
  }
}

export async function uploadAuthState(
  authDir: string,
): Promise<void> {
  const files = await listFilesRecursive(authDir);

  for (const relativePath of files) {
    const localPath = path.join(authDir, relativePath);
    const contents = await fs.readFile(localPath);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(relativePath, contents, {
        upsert: true,
        contentType: "application/json",
      });

    if (error) {
      console.error(
        "SUPABASE UPLOAD ERROR:",
        error,
      );

      throw new Error(
        `Failed to upload ${relativePath}: ${error.message}`,
      );
    }
  }
}
