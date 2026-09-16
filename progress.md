# musicapp mobile app — progress

Tracking the Expo/React Native mobile app build. Context: reuse the existing
Railway/Neon backend, same REST+Socket.IO contract via `@musicapp/shared`;
YouTube stays the content source, background audio is a known accepted
limitation, confirmed not fixable by going native (see CLAUDE.md's "Known
platform limitation" for the full reasoning) — see `BLOCKED.md` for
environment-level blockers, not product ones.

**Deployed**: pushed to `main` and live in production as of this writing — Railway auto-deployed
the updated backend (the karaoke migration applied automatically via the Dockerfile's
`prisma migrate deploy` step, verified against the real production database) and Vercel
redeployed the unchanged web app. EAS build env vars (`development`/`preview` environments) are
configured to point real device builds at the production Railway/Vercel URLs rather than this
Mac's local dev server, so an installed build works from any network. See
`TASKS_KARAOKE.md`/`BLOCKED.md` for the karaoke feature specifically (a separate, later addition
to this same mobile app).

## Shipped (core loop complete, end-to-end verified)

- **Scaffold**: `apps/mobile` (Expo SDK 57, TypeScript, Expo Router, React 19
  / React Native 0.86), wired into the root npm workspace as `@musicapp/mobile`.
  Dark theme (`src/theme.ts`) ported from `apps/web`'s CSS variables.
- **Shared logic**: `projectPlaybackPosition` moved into
  `packages/shared/src/playback.ts` so both apps use one copy.
- **Core lib layer**: session storage (AsyncStorage — not expo-secure-store,
  see `src/lib/session.ts`'s comment), REST client (`src/lib/api.ts`, near-
  verbatim port), Socket.IO client + `useRoomSocket` (near-verbatim port +
  `AppState`-based reconnect-on-foreground), a minimal toast pub-sub
  replacing `sonner` (no RN equivalent).
- **Home screen**: create/join room, small native UI primitives
  (`src/components/ui/{Card,Button,TextField,Avatar}.tsx`).
- **Room screen**: `app/room/[code].tsx` — session check, REST fetch +
  socket sync, join-prompt/not-found/room-ended states.
- **YouTube player**: `react-native-youtube-iframe`, visible in the UI
  (unlike the web app's hidden 2x2px trick, which is a browser-tab-
  audibility hack with no native equivalent or benefit).
  `usePlayerController.ts` is a from-scratch port (not a copy) of the web
  app's, adapted to the library's controlled-component API (`play` boolean
  prop vs. react-youtube's imperative playVideo()/pauseVideo()). A real bug
  surfaced during verification and was fixed: `seekTo` can throw
  synchronously before the player ref is ready, wrapped in a `safeSeekTo`
  helper (same defensive pattern as this session's earlier web-app fix to
  `getCurrentTime()`).
- **Full room UI**: AddSongForm (URL paste + debounced search), Queue
  (add/remove/move via up/down buttons, lock/repeat/shuffle/clear, clear
  confirmation modal), OnlineUsers (avatars, host crown, away/activity,
  make-host), ChatPanel (history + live messages, typing indicator,
  @mention "you were mentioned" toast, emoji picker), VoteSkipBanner,
  ReactionLayer (floating-emoji overlay, RN `Animated` instead of the web
  app's CSS keyframes), RecentlyPlayed + RoomHistory (on-demand-fetch
  modals), InviteDialog (room code, QR code, copy link, native share
  sheet), RoomSettingsDialog (queue-add permission, skip mode, all the
  toggle settings, end-room with confirmation).

**Verified end-to-end** (via `expo start --web` in the in-app browser,
cross-checked against the real web app running in a second browser tab,
both hitting the local dev backend): created a room on mobile, joined the
same room from the web app as a second user, confirmed real-time sync both
directions, added a song via URL paste (landed correctly in the queue),
sent a chat message (appeared correctly with avatar/timestamp), player
mounted and loaded real YouTube video metadata. Full interactive
play/pause/seek-actually-plays-audio verification was not possible through
this workaround (the community web-webview shim used to make it bundle at
all for `expo start --web` doesn't implement `injectJavaScript`, which the
player library needs internally) — needs the iOS Simulator or a physical
device; see `BLOCKED.md`.

`npm run build --workspace=packages/shared`, `--workspace=apps/web`,
`--workspace=apps/server`, and `npx tsc --noEmit` in `apps/mobile` all pass
cleanly as of the last commit in this log.

## Deliberately deferred (not architecturally blocked)

Exists on the web app, not yet ported — no reason it couldn't be, just
wasn't built in this pass:

- Message-mention autocomplete dropdown (mention *highlighting rendering*
  and the "you were mentioned" toast ARE implemented; only the
  type-ahead suggestion list while composing is missing)
- Drag-and-drop queue reordering (up/down buttons are a full functional
  substitute today — same `canEditQueue` permission gate, same
  remove/move/shuffle/clear actions, just no drag gesture)

## Known follow-ups (environment, not code)

- iOS Simulator unusable until Xcode is installed on this machine (only
  the command-line tools are present) — see `BLOCKED.md` for the exact
  fix command (needs the user's password, can't be run by the agent).
- No Android Studio/emulator on this machine — Android is code-complete
  (nothing platform-specific was needed for any feature built) but not
  self-verified. Needs manual testing once tooling exists, or a physical
  device with Expo Go.
- Distribution (App Store / Play Store, EAS build config, signing) is
  out of scope for this pass entirely — everything above was built and
  verified via local development only. See README.md's "Mobile app"
  section for the dev-loop run instructions.
