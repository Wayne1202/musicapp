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
  (HSL → hex).
- **Phase 2 — Shared logic**: moved `projectPlaybackPosition` into
  `packages/shared/src/playback.ts`; `apps/web` re-imports it from
  `@musicapp/shared` instead of its own local copy.
- **Phase 3 — Core lib layer**: `src/lib/session.ts` (AsyncStorage, not
  expo-secure-store — see commit message, it's a guest id not a
  credential, and SecureStore has no web support), `src/lib/api.ts`
  (near-verbatim port), `src/lib/socket.ts` + `src/hooks/useRoomSocket.ts`
  (near-verbatim port + `AppState`-based reconnect-on-foreground),
  `src/lib/toast.ts` + `src/components/ToastHost.tsx` (replaces `sonner`,
  no RN equivalent).
- **Phase 4 — Home screen**: `src/components/ui/{Card,Button,TextField}.tsx`
  primitives, `CreateRoomForm`/`JoinRoomForm`, `app/index.tsx`.
- **Phase 5 — Room screen shell**: `app/room/[code].tsx` — session check,
  REST fetch + socket sync, join-prompt/not-found/ended states, minimal
  now-playing/queue summary.

**End-to-end verified** (via `expo start --web` in the in-app browser,
cross-checked against the real web app in a second tab, both hitting the
local dev backend): created a room on mobile, joined the same room from
the web app as a second user, added a song from web, watched it appear on
mobile instantly via the shared Socket.IO room state. Confirms the ported
socket/api layer actually interoperates with the existing backend, not
just typechecks.

## In progress / next

- Phase 6: player integration (`react-native-youtube-iframe`, ported
  `usePlayerController`).
- Phase 7: full room UI port (NowPlaying, Queue w/ drag reorder,
  AddSongForm, OnlineUsers, Chat, reactions, vote-skip, settings,
  recently played/history).
- Phase 8: lifecycle polish.
- Phase 9: final pass, README update.

## Known follow-ups (not blocking)

- Android not self-verifiable on this machine (no emulator) — see BLOCKED.md.
- iOS Simulator not usable until Xcode is installed — see BLOCKED.md.
