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

## Karaoke: react-native-webrtc cannot run in Expo Go, and can't be verified via the expo-web workaround either

Two separate, compounding constraints for the karaoke feature specifically:

1. **`react-native-webrtc` is a native module and cannot run inside Expo Go at all** (confirmed
   by the library's own docs — this isn't like `react-native-webview`, which Expo Go happens to
   include; WebRTC's native binaries simply aren't compiled into the Expo Go client app). This
   needs a **custom dev client** (`expo-dev-client`, via `eas build --profile development` or a
   local `expo run:ios`/`expo run:android`), not Expo Go.
2. **The `expo start --web` workaround used throughout this project for the listening-room
   feature does not work for karaoke either**, for a different reason: `react-native-webrtc`
   does ship *something* for the web platform, but it references `requireNativeComponent`, which
   `react-native-web` doesn't implement — it throws an error at runtime immediately on import.
   Confirmed by loading `/karaoke` in the browser workaround after the feature was built.

**What this means in practice**: the karaoke feature's mobile code is fully typechecked and
statically verified, and its *signaling* correctness (the part that runs entirely on the
existing Socket.IO server, independent of react-native-webrtc) was verified via a scripted
2-client test — but the WebRTC audio path itself has not been, and cannot be, run or observed by
this agent in this environment. It needs either:
   - An EAS Build (cloud, no local Xcode/Android Studio needed) producing a real installable dev
     client — Android is achievable without any Apple credentials; iOS still needs the user's
     own Apple ID in the credentials flow (or local Xcode, already blocked above), same
     constraint as the rest of this file.
   - Or a local custom dev client build, once Xcode/Android Studio exist on this machine.

See TASKS_KARAOKE.md for what's been attempted and docs/karaoke-audio.md for the full
architecture this needs to validate.

**Important gotcha found and fixed**: EAS cloud builds do **not** automatically pick up
`apps/mobile/.env` the way local `expo start` does — they use EAS's own separate "Environments"
feature (`eas env:*`), which was empty. The first Android build queued (and sat queued for 35+
minutes) would have installed with no backend URL configured at all — every request would have
silently tried `http://localhost:4000` (the code's hardcoded fallback), which on a real phone
means "the phone's own localhost," i.e. nothing. Fixed by running `eas env:create` for
`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL`/`EXPO_PUBLIC_WEB_ORIGIN` on both the
`development` and `preview` environments (pointed at the production Railway/Vercel URLs, now
that production is verified working with the karaoke migration applied — see the "production
deploy" note in `progress.md`/`TASKS_KARAOKE.md`), then cancelling and resubmitting the build so
it picks the new values up (environment resolution happens at submission time, not build-start
time, so the original already-queued build would not have retroactively picked them up).

**EAS build attempts** (both `--non-interactive`, both from `apps/mobile`):
- `eas build --profile development --platform android` — **succeeded** in starting (build id
  `6a541620-86f6-42ca-a377-9ee634ed4bc5`; a first attempt, `0f00c471-...`, was cancelled and
  resubmitted after fixing the env-vars gotcha above). No local Xcode/Android Studio needed at
  all. Check status: `eas build:view 6a541620-86f6-42ca-a377-9ee634ed4bc5`, or
  https://expo.dev/accounts/wayne1202/projects/musicapp-mobile/builds/6a541620-86f6-42ca-a377-9ee634ed4bc5
- `eas build --profile development --platform ios` — **fails immediately** at the credentials
  step: `"You're in non-interactive mode. EAS CLI couldn't find any credentials suitable for
  internal distribution. Run this command again in interactive mode."` This needs the user to
  run `eas build --profile development --platform ios` themselves, interactively, and sign in
  with their own Apple ID when prompted (a free Apple ID works for internal/development
  distribution — no paid $99/year Apple Developer Program membership required for this). This is
  a credential the agent should not and cannot enter on the user's behalf.
