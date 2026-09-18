# Coastwise iOS release checklist

This native source was prepared in the workspace, but the Expo artifact could not be registered from the iOS Replit app. Open the project on replit.com to create the mobile artifact, install dependencies, run Expo Doctor, and create device builds.

## Before TestFlight

- [ ] Create/register the Expo artifact as `coastwise-mobile` on replit.com.
- [ ] Install the versions in `package.json` with `pnpm install`.
- [ ] Convert `assets/icon.svg` and `assets/splash.svg` to PNG assets if the Expo build requires raster files.
- [ ] Set `EXPO_PUBLIC_DOMAIN` to the published API domain; do not hardcode a development hostname.
- [ ] Run `CI=1 pnpm exec expo install --check`.
- [ ] Run `pnpm dlx expo-doctor@latest` and resolve every finding.
- [ ] Run `pnpm typecheck`.
- [ ] Test on physical iPhones, including iPhone SE-sized screens.
- [ ] Test camera and microphone denial, location denial, interruption, low connectivity, and app restart.
- [ ] Confirm recordings remain local and are not included in debrief or plan requests.
- [ ] Confirm no screen encourages interaction while driving.

## Apple metadata and review

- [ ] Reserve `com.coastwise.drivercoach` in Apple Developer.
- [ ] Create App Store Connect app record, age rating, screenshots, support URL, and privacy-policy URL.
- [ ] Complete the App Privacy nutrition label for location, camera, microphone, local data, and AI processing.
- [ ] Add the optional AI summary to the privacy policy and App Review notes.
- [ ] Declare that location and camera are used only during an explicitly started supervised session.
- [ ] Complete export-compliance and content-rights questions.
- [ ] Run a TestFlight beta with teen drivers and supervising adults before submission.