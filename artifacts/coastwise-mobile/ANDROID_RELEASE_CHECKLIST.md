# Coastwise Android release checklist

The Android app shares Coastwise's React Native screens and local-first state with iOS. The Android application ID is `com.coastwise.drivercoach`. Camera, microphone, and foreground location are the only requested sensitive permissions; background location and location foreground services are explicitly blocked.

## Before internal testing

- [ ] Register the Expo mobile artifact from replit.com if it is not already registered.
- [ ] Set `EXPO_PUBLIC_DOMAIN` to the published Coastwise API domain.
- [ ] Run `pnpm release-check` to check dependencies, TypeScript, Expo Doctor, and both platform bundles.
- [ ] Confirm the adaptive icon is not clipped by circle, squircle, or rounded-square launchers.
- [ ] Install a signed Android build on physical phones from at least two manufacturers.
- [ ] Test Android 13, 14, and 15 permission flows, including “Don’t ask again” and recovery through Settings.
- [ ] Test gesture navigation, three-button navigation, display scaling, large text, TalkBack, and dark mode.
- [ ] Test camera and microphone interruption, incoming calls, app backgrounding, low connectivity, and process termination.
- [ ] Confirm drive recordings remain in app-private storage and disappear when app data is cleared or the app is uninstalled.
- [ ] Confirm no precise route, recording, identity, note, or raw answer enters an AI request.
- [ ] Measure location accuracy and battery use during a supervised drive.

## Google Play preparation

- [ ] Reserve `com.coastwise.drivercoach` in Google Play Console.
- [ ] Create an internal-testing release before closed or production testing.
- [ ] Supply phone and tablet screenshots, feature graphic, short description, support URL, and public privacy-policy URL.
- [ ] Complete the Data safety form for foreground location, camera, microphone, app-local drive data, and optional AI summaries.
- [ ] Complete the content rating and target-audience declarations.
- [ ] Explain in review notes that the app is operated by a supervising adult while parked and does not use background location.
- [ ] Verify the release targets the current Google Play API-level requirement at submission time.

Google Play submission is not currently handled by Replit’s iOS publishing flow. The Android bundle must be delivered through the project’s supported Android build and Play Console process.