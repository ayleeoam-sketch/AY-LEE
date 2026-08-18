---
name: Baileys package availability
description: Environment-specific constraint affecting WhatsApp runtime installation.
---

The workspace package firewall currently rejects both the scoped and unscoped npm tarballs for the upstream Baileys package. The bot keeps WhatsApp loading behind a runtime adapter so the health server, command discovery, and SQLite foundation remain usable without pretending that WhatsApp is connected.

**Why:** The firewall rejection occurs before package installation and should not be bypassed; vendoring or fetching around it would weaken the workspace's dependency safety controls.

**How to apply:** Before relying on WhatsApp authentication in a future session, check whether the Baileys package can install cleanly. If it can, add the dependency and remove the runtime-unavailable condition; otherwise keep the explicit startup error and report the blocker.