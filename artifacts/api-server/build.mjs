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

    // Bundle dependencies, but split shared code into chunks
    // instead of copying it into every command.
    bundle: true,
    splitting: true,

    format: "esm",

    outdir: distDir,

    outExtension: {
      ".js": ".mjs",
    },

    logLevel: "info",

    sourcemap: "linked",

    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "baileys",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],

    plugins: [
      esbuildPluginPino({
        transports: ["pino-pretty"],
      }),
    ],

    banner: {
      js: `import { createRequire as __bannerCrReq } from "node:module";
import __bannerPath from "node:path";
import __bannerUrl from "node:url";

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});