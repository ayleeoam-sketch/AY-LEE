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
4. Watch the console for the QR code and scan it from WhatsApp:
   **Settings → Linked devices → Link a device**.
5. Authentication is saved under `AUTH_DIR` and should not be committed.

The workflow supplies `PORT`. `BOT_NAME`, `OWNER_NAME`, `PREFIX`, `BOT_VERSION`,
`AUTH_DIR`, `DATABASE_PATH`, and `MAX_RECONNECT_ATTEMPTS` have safe defaults.

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