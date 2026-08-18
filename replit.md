# AY-LEE BOT

Phase 1 foundation for a modular WhatsApp bot with persistent SQLite data and general-purpose commands.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server and bot
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run build` — build the bot service
- Required bot configuration: see `artifacts/api-server/.env.example`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Bot: modular TypeScript command system with a Baileys runtime adapter
- Local data: SQLite via better-sqlite3
- Logging: Pino
- Build: esbuild

## Where things live

- `artifacts/api-server/src/config.ts` — environment-backed bot configuration
- `artifacts/api-server/src/commands/` — auto-discovered command modules
- `artifacts/api-server/src/connection/` — WhatsApp lifecycle adapter
- `artifacts/api-server/src/database/` — SQLite schema and persistence helpers
- `artifacts/api-server/README.md` — setup, authentication, and troubleshooting

## Architecture decisions

- Commands are compiled as separate entry points so the runtime can discover new modules without a central registry edit.
- WhatsApp startup is isolated behind a runtime adapter so dependency/install failure cannot crash the health server or pretend to be connected.
- Reconnect attempts are bounded and exponentially delayed to prevent an outage from creating an infinite reconnect loop.

## Product

AY-LEE BOT currently responds to six general commands: menu, help, ping, uptime, owner, and botinfo. Advanced media, AI, moderation, economy, and game features are reserved for later phases.

## User preferences

Phase 1 only; do not add advanced commands until the foundation is verified.

## Gotchas

- Baileys is an external runtime dependency; if the package firewall blocks it, the service remains healthy but WhatsApp stays stopped and logs the exact cause.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details