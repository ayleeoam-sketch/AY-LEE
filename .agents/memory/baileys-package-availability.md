---
name: Baileys package availability
description: Environment-specific constraint affecting WhatsApp runtime installation.
---

The prior environment rejected upstream Baileys tarballs, but on August 18, 2026 a normal pnpm install probe for the official scoped package `@whiskeysockets/baileys@7.0.0-rc14` succeeded in an isolated temporary project. Baileys is still not declared or installed in this repository.

**Why:** Package availability can vary by Replit environment; the earlier firewall rejection should not be bypassed, and the successful probe does not by itself establish API compatibility with the existing adapter.

**How to apply:** Before relying on WhatsApp authentication, check the current official package version and install it through normal pnpm controls, then validate compatibility before changing the adapter or manifest.