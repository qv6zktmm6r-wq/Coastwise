---
name: Playwright on Nix
description: Environment requirements for launching Playwright Chromium in this workspace.
---

Playwright downloading Chromium successfully does not mean the browser can launch in this Nix workspace. Its Linux shared libraries must also be installed, and `libgbm` may still be required after installing the broader Chromium dependency set.

**Why:** Playwright's browser installation completed but launch validation failed first for the common Linux libraries and then separately for `libgbm`.

**How to apply:** When adding or upgrading browser checks, treat browser binaries and Nix shared libraries as separate requirements. If launch validation reports a missing library, add the corresponding Nix package through the environment dependency manager rather than using apt.