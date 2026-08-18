# AY-LEE BOT

Phase 2A foundation for a modular WhatsApp bot with persistent SQLite data,
general-purpose commands, and group management infrastructure.

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
  - `commands/general/` — Phase 1 general commands
  - `commands/admin/` — Phase 2A group management commands
- `artifacts/api-server/src/connection/` — WhatsApp lifecycle adapter
- `artifacts/api-server/src/database/` — SQLite schema and persistence helpers
- `artifacts/api-server/README.md` — setup, authentication, and troubleshooting

## Architecture decisions

- Commands are compiled as separate entry points so the runtime can discover new modules without a central registry edit.
- WhatsApp startup is isolated behind a runtime adapter so dependency/install failure cannot crash the health server or pretend to be connected.
- Reconnect attempts are bounded and exponentially delayed to prevent an outage from creating an infinite reconnect loop.

## Product

AY-LEE BOT includes the Phase 1 general commands plus Phase 2A group
management: moderation toggles, membership actions, warnings, message
deletion, member mentions, invite links, and welcome/goodbye settings.
Advanced media, AI, economy, and game features are reserved for later phases.

## Current scope

Phase 2A only; do not add AI, media, downloaders, economy, games, or other
later-phase features until this foundation is verified.

## Gotchas

- Baileys is an external runtime dependency; if the package firewall blocks it, the service remains healthy but WhatsApp stays stopped and logs the exact cause.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details