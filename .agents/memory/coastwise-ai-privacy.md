---
name: Coastwise AI privacy
description: Privacy and safety boundary for optional AI coaching features.
---

AI coaching must be optional and must operate on an explicit, minimal summary. For drive debriefs, send only duration, distance, night status, selected skills, coach-event text, and low-mastery topic summaries. Keep video, routes, coordinates, speeds, identity, notes, recording metadata, and raw answers on-device.

**Why:** Coastwise’s trust depends on improving teen-driver coaching without turning sensitive recordings or precise location history into cloud AI inputs. AI output must also avoid claiming it observed the road or verified safe driving.

**How to apply:** Use typed allowlists on both client and server, validate structured model output, retain deterministic fallbacks, require an explicit user action, and update material privacy notice before broadening any AI input.