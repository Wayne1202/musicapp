# musicapp mobile app — progress

Tracking the Expo/React Native mobile app build (see the approved plan this
session for full context: reuse the existing Railway/Neon backend, same
REST+Socket.IO contract via `@musicapp/shared`; YouTube stays the content
source, background audio is a known accepted limitation — see BLOCKED.md
for environment-level blockers, not product ones).

## Done

- **Phase 1 — Scaffold**: `apps/mobile` created (Expo SDK 57, TypeScript,
  Expo Router, React 19 / React Native 0.86). Wired into the root npm
  workspace (`@musicapp/mobile`, depends on `@musicapp/shared` via `"*"`).
  Dark theme (`src/theme.ts`) ported from `apps/web`'s CSS variables
  (HSL → hex). Verified booting via `expo start --web` in the in-app
  browser (real iOS Simulator verification blocked on Xcode — see
  BLOCKED.md).

## In progress / next

- Phase 2: move `projectPlaybackPosition` from `apps/web/src/lib/playback.ts`
  into `packages/shared/src`, update the web app's import.
- Phase 3: core lib layer (session storage via `expo-secure-store`, REST
  client, socket client + `useRoomSocket` port).
- Phase 4: Home screen (create/join room).
- Phase 5: Room screen shell, first real end-to-end milestone.
- Phase 6: player integration (`react-native-youtube-iframe`).
- Phase 7: full room UI port.
- Phase 8: lifecycle polish.
- Phase 9: final pass, README update.

## Known follow-ups (not blocking)

- Android not self-verifiable on this machine (no emulator) — see BLOCKED.md.
- iOS Simulator not usable until Xcode is installed — see BLOCKED.md.
