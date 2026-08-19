import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { readdir, rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(artifactDir, "src");

async function getTypeScriptEntries(directory) {
  const entries = [];

  for (const entry of await readdir(directory, {
    withFileTypes: true,
  })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      entries.push(...(await getTypeScriptEntries(entryPath)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts")
    ) {
      entries.push(entryPath);
    }
  }

  return entries;
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");

  await rm(distDir, {
    recursive: true,
    force: true,
  });

  await esbuild({
    entryPoints: await getTypeScriptEntries(sourceDir),

    platform: "node",

    // IMPORTANT:
    // Do not bundle every command and handler into huge
    // duplicate files. Node will load dependencies normally.
    bundle: false,

    format: "esm",

    outdir: distDir,

    outExtension: {
      ".js": ".mjs",
    },

    logLevel: "info",

    sourcemap: "linked",

    plugins: [
      esbuildPluginPino({
        transports: ["pino-pretty"],
      }),
    ],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});