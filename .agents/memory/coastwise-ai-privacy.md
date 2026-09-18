---
name: Coastwise AI privacy
description: Privacy and safety boundary for optional AI coaching features.
---

AI coaching must be optional and must operate on an explicit, minimal summary. Drive debriefs may use duration, distance, night status, selected skills, coach-event text, and low-mastery topics. Next-drive plans may use low-mastery topics, unfinished mission title/category/time, and recent duration, night, skills, and prior debrief outcomes. Keep video, routes, coordinates, speeds, identity, notes, dates, recording metadata, and raw answers on-device.

**Why:** Coastwise’s trust depends on improving teen-driver coaching without turning sensitive recordings or precise location history into cloud AI inputs. AI output must also avoid claiming it observed the road or verified safe driving.

**How to apply:** Use typed allowlists on both client and server, validate structured model output, keep safety guidance deterministic, persist useful output locally, require an explicit user action, and update material privacy notice before broadening any AI input.