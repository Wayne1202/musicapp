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
