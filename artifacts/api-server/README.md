# AY-LEE BOT — Phase 1

AY-LEE BOT is a modular WhatsApp bot foundation built with TypeScript. Phase 1
provides the stable runtime, command system, persistent SQLite storage, logging,
and connection lifecycle needed for later phases.

## Implemented in Phase 1

- WhatsApp connection lifecycle with persisted multi-file authentication
- QR authentication instructions in the console
- Bounded reconnect attempts with exponential backoff
- Graceful shutdown on SIGINT and SIGTERM
- Modular command interface and automatic command discovery
- Commands:
  - `.menu`
  - `.help` and `.help <command>`
  - `.ping`
  - `.uptime`
  - `.owner`
  - `.botinfo`
- Safe handling for ordinary messages, unsupported message formats, deleted
  messages, missing sender data, and group metadata failures
- SQLite tables for `users`, `groups`, and `bot_settings`
- Prepared permission helpers for owner, group, group-admin, and bot-admin checks
- Redacted structured logging without message contents or authentication secrets

Advanced features are intentionally not implemented yet. Media downloaders,
AI, economy, games, moderation commands, welcome messages, stickers, and other
Phase 2+ features are out of scope.

## Replit setup

1. Copy `.env.example` values into the Replit environment as needed.
2. Add `OWNER_NUMBER` as a Secret or environment variable. Use the full
   international phone number without spaces or punctuation.
3. Start the `artifacts/api-server: API Server` workflow.
4. Authentication is saved under `AUTH_DIR` and should not be committed.

The workflow supplies `PORT`. `BOT_NAME`, `OWNER_NAME`, `PREFIX`, `BOT_VERSION`,
`DATA_DIR`, `AUTH_DIR`, `DATABASE_PATH`, and `MAX_RECONNECT_ATTEMPTS` have safe
defaults. QR credentials are not written to logs.

## Render Deployment

The deployable service is the `@workspace/api-server` workspace package. From
the repository root, use these exact Render commands:

**Build Command**

```bash
pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
```

**Start Command**

```bash
pnpm --filter @workspace/api-server run start
```

The included `render.yaml` contains the same commands and an HTTP health check
at `/api/healthz`. It is a Blueprint only; it does not deploy the service
automatically.

### Environment variables

Set these in the Render service:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OWNER_NUMBER` | Yes for owner authorization | Full international owner phone number, without spaces or punctuation |
| `NODE_ENV` | Yes | Set to `production` |
| `DATA_DIR` | No | Base directory for runtime data; defaults to `data` |
| `AUTH_DIR` | No | WhatsApp session directory; overrides `DATA_DIR/auth` |
| `DATABASE_PATH` | No | SQLite file path; overrides `DATA_DIR/ay-lee-bot.sqlite` |
| `MAX_RECONNECT_ATTEMPTS` | No | Reconnect limit; defaults to `8` |
| `BOT_NAME` | No | Bot display name; defaults to `AY-LEE BOT` |
| `OWNER_NAME` | No | Owner display name; defaults to `AY-LEE` |
| `PREFIX` | No | Command prefix; defaults to `.` |
| `BOT_VERSION` | No | Display version; defaults to `1.0.0` |
| `LOG_LEVEL` | No | Pino log level; defaults to `info` |
| `PORT` | No | Render supplies this automatically |

Use a Render persistent disk for `AUTH_DIR` and the directory containing
`DATABASE_PATH` if WhatsApp session and SQLite data must survive service
restarts. Mount the disk at the chosen `DATA_DIR` and keep the two path
variables aligned with that mount. Do not print, commit, or expose the
contents of the authentication directory.

Baileys is intentionally not installed or added by this deployment-preparation
change. If it is unavailable in the target environment, the HTTP service can
start and report health, but WhatsApp connectivity remains unavailable; this
setup does not pretend otherwise.

## Commands

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

The health endpoint remains available at `/api/healthz`.

## Add a command

Create a default-exported `Command` object under
`src/commands/<category>/<command>.ts`. The loader discovers compiled command
files automatically; no command handler rewrite or central command list is
needed.

```ts
import type { Command } from "../../types/command";

const command: Command = {
  name: "example",
  aliases: [],
  category: "general",
  description: "Describe the command.",
  usage: ".example",
  permissions: ["public"],
  async execute(context) {
    await context.sock.sendMessage(context.chatJid, {
      text: "Example response",
    });
  },
};

export default command;
```

## Required configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OWNER_NUMBER` | Recommended | Normalized number used by owner permission checks |
| `OWNER_NAME` | No | Owner display name; defaults to `AY-LEE` |
| `BOT_NAME` | No | Bot display name; defaults to `AY-LEE BOT` |
| `PREFIX` | No | Command prefix; defaults to `.` |
| `BOT_VERSION` | No | Display version; defaults to `1.0.0` |
| `AUTH_DIR` | No | WhatsApp credential directory |
| `DATABASE_PATH` | No | SQLite database file |

No API keys or passwords are required for Phase 1.

## Troubleshooting

- **A QR code is shown:** scan it with WhatsApp from Linked devices.
- **The session was logged out:** remove the configured auth directory and
  restart so a fresh QR code is generated.
- **Reconnect limit reached:** restart the workflow after checking the
  connection/network state.
- **`OWNER_NUMBER` warning:** owner-only checks cannot match until the variable
  is configured.
- **Baileys install blocked:** the Replit package firewall currently blocks
  both available Baileys tarball names in this environment. The connection
  adapter is present and will activate automatically once the dependency can be
  installed; the exact error is logged instead of pretending WhatsApp is
  connected.