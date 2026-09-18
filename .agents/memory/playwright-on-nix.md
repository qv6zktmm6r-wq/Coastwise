---
name: Playwright on Nix
description: Environment requirements and browser-binary compatibility for Playwright in this workspace.
---

Playwright downloading Chromium successfully does not mean the browser can launch in this Nix workspace. Its Linux shared libraries must also be installed, and `libgbm` may still be required after installing the broader Chromium dependency set.

Playwright's downloaded Ubuntu WebKit build can also require exact shared-library sonames that current Nix packages do not provide, even when equivalent libraries are installed. Treat a WebKit launch failure from missing versioned sonames as runner incompatibility rather than an application test failure.

**Why:** Chromium and Firefox launched after their Nix libraries were present, while the pinned Ubuntu WebKit build still required incompatible `libjpeg`, GLES, atomic, and GStreamer sonames.

**How to apply:** When adding or upgrading browser checks, treat browser binaries and Nix shared libraries as separate requirements. Add compatible libraries through the environment dependency manager rather than apt. For WebKit, use a runner whose browser build matches its host libraries instead of symlinking incompatible sonames.