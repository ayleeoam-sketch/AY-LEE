---
name: Native dependency validation
description: Runtime validation constraint for native Node.js dependencies.
---

Native Node.js dependencies can allow TypeScript checks and bundling to pass while the runtime still lacks its compiled binding when dependencies were installed with lifecycle scripts disabled.

**Why:** The API server can build successfully without proving that the existing SQLite driver can open a database in the current environment; startup can fail before application-level loading is reached.

**How to apply:** Treat a missing native binding as an environment/install validation issue first. For runtime smoke tests, use a normal locked install with lifecycle scripts enabled; do not replace the existing database driver just to make a local smoke test pass.