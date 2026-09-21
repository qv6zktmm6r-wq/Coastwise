---
name: Mobile GPS speed estimates
description: Reliability constraints for live speed and braking coaching in mobile browsers.
---

Do not treat the browser's reported geolocation speed as authoritative. Estimate visible speed from several recent, plausible coordinate movements, and show users whether GPS and motion sensors are available.

**Why:** Real iPhone testing produced a stable-looking speed near 55 mph while the vehicle was moving near 10 mph. Browser GPS and timestamps can be stale or noisy, and GPS alone is not dependable enough for prompt hard-braking detection.

**How to apply:** Require multiple recent fixes before displaying speed, smooth with a robust statistic, reject inaccurate or implausible jumps, and use device motion as a corroborating braking signal when permission is available. Describe all values as coaching estimates, not calibrated vehicle measurements.