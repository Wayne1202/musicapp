# Blocked items

Non-blocking to continued development — noted here for visibility, work continues on other tasks in the meantime.

## iOS Simulator unavailable (environment)

This Mac has only the Xcode command-line tools installed, not full Xcode, so
the iOS Simulator can't boot a simulator device. Needed to fix (requires the
user's password, can't be run by the agent):

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

(Xcode itself must be installed from the Mac App Store first if it isn't already.)

**Workaround in use**: verifying `apps/mobile` screens via `expo start --web`
(React Native Web) in the in-app browser during development. This catches
real runtime/rendering bugs but isn't the true native target — final
iOS-specific verification (WebView/YouTube player behavior, native gestures,
simulator-specific quirks) is deferred until Xcode is installed.

## Android emulator not installed (environment)

Confirmed by user: no Android Studio / emulator on this machine. Code is
written to be cross-platform correct (Expo/React Native targets both from
one codebase, no Android-specific code needed for the features built so
far), but Android has not been self-verified. Needs manual testing by the
user once Android tooling exists, or a physical device with Expo Go.

## Player interactivity not verifiable via the expo-web workaround (environment)

`react-native-youtube-iframe` needed `react-native-web-webview` (a
community shim) to bundle at all for `expo start --web` — without it,
Metro can't resolve `react-native-webview` on the web platform. With it
installed, the player DOES mount and load the correct video's real
metadata/thumbnail (confirms `videoId` wiring, network access, and the
component tree are all correct) — but the shim doesn't implement
`injectJavaScript`, which the library uses internally to send play/pause/
seek commands into the underlying iframe. So tapping play produces
`Uncaught (in promise) TypeError: webViewRef.current.injectJavaScript is
not a function` from inside the library's own code (not something app
code can catch/fix) and interactive playback control (play/pause/seek
actually taking effect) can't be confirmed this way.

`src/hooks/usePlayerController.ts`'s own `seekTo` calls are already
defensively wrapped (`safeSeekTo`) after this surfaced one real instance
of it — that fix is verified (no more crash on tap). What's NOT verified
here is whether `play`/`pause`/`seek` actually reach real playback, since
that depends entirely on the native WebView bridge this shim doesn't
provide. Needs the iOS Simulator (blocked above) or a physical device
with Expo Go to confirm end-to-end.
