# Karaoke feature — architecture notes

Written before implementation, per the task spec's step 1. This documents what exists, what
gets reused, and what's new. See `progress.md` for the (separate, already-complete) mobile-app
build log, `BLOCKED.md` for environment blockers, `TASKS_KARAOKE.md` for the live task list, and
`docs/karaoke-audio.md` for the audio/sync design specifically.

## Current architecture (as found)

**Monorepo**: npm workspaces — `apps/web` (Next.js 14), `apps/mobile` (Expo SDK 57 / React
Native 0.86 / React 19, Expo Router), `apps/server` (Node/Express/Socket.IO/Prisma),
`packages/shared` (types, Socket.IO event contracts, YouTube parsing, permission checks — used
by all three apps).

**Backend / database**: PostgreSQL via Prisma. Not Supabase — the task spec's "if the backend is
Supabase, use Supabase Realtime for signaling" doesn't apply here; the equivalent existing
realtime infrastructure is the already-running Socket.IO server (`apps/server/src/socket/index.ts`),
which is what signaling will be built on instead, per the spec's own "use existing infrastructure"
instruction.

**Auth / identity**: guest-only, no accounts. `UserSession { id, displayName, roomId }` — a
session is created per room via `POST /api/rooms` (create) or `POST /api/rooms/:code/join`
(join), returned to the client, and stored client-side (`localStorage` on web, `AsyncStorage` on
mobile) keyed by room code. Every authenticated REST call after that sends the session id as a
plain `x-session-id` header (`apps/server/src/middleware/sessionAuth.ts`); every socket
connection sends `{roomId, sessionId}` on `JOIN_ROOM` and the server stores them on
`socket.data`. No cookies, no JWTs. `UserSession.roomId` is a required, single, non-nullable FK —
a session belongs to exactly one (listening) room.

**Existing "listener screen"** (the room experience the spec refers to): `RoomDTO` — one row in
`Room` (code, name, host, settings, status ACTIVE/ENDED) plus a 1:1 `PlaybackState`
(currentVideoId/Title/Thumbnail/Duration/Timestamp/isPlaying) and a `QueueItem[]` list. Web:
`apps/web/src/app/room/[code]/RoomView.tsx` + `apps/web/src/components/room/*`. Mobile:
`apps/mobile/app/room/[code].tsx` + `apps/mobile/src/components/room/*` (built in a prior
session — see `progress.md`). Playback sync works by having every client independently load the
same YouTube video via an embedded player and periodically re-project/seek to a server-computed
"where playback should be right now" timestamp (`packages/shared/src/playback.ts`'s
`projectPlaybackPosition`, using `currentTimestamp` + wall-clock elapsed since `updatedAt`) — no
audio ever crosses the network; every device streams YouTube directly and only *state* (play/
pause/seek/song-change) is synced via Socket.IO.

**Song selection/playback implementation** (what gets reused for the karaoke backing track):
- URL/ID parsing + validation: `packages/shared/src/youtube.ts` (`extractYouTubeVideoId`,
  `isValidYouTubeUrl`).
- Server-side metadata fetch (title/thumbnail/duration, with a keyless-oEmbed fallback when no
  `YOUTUBE_API_KEY` is set) and optional search: `apps/server/src/services/youtube/*`.
- Mobile playback surface: `react-native-youtube-iframe` (a WebView-hosted YouTube IFrame
  player — the only legitimate way to play YouTube content on any platform, native included).
  `apps/mobile/src/hooks/usePlayerController.ts` owns the player instance, drift-corrects against
  a server timestamp the same way the web app does, and exposes play/pause/seek/skip. Rendered by
  `apps/mobile/src/components/room/PlayerEngine.tsx` — visible in the UI (unlike the web app's
  hidden 2x2px iframe, which is a browser-tab-audibility hack with no native equivalent).

**Realtime infrastructure that already exists**: Socket.IO, one shared `io` instance
(`apps/server/src/index.ts`), typed via `ClientToServerEvents`/`ServerToClientEvents`
(`packages/shared/src/socket-events.ts`). Per-room ephemeral (non-persisted) state already lives
in plain in-memory `Map`s inside `apps/server/src/socket/index.ts` — presence, an active
vote-to-skip, a debounce timestamp, an auto-end-empty-room timer — all keyed by `roomId`, all
reset on server restart (acceptable given the single-instance deployment; see CLAUDE.md). This is
the established, existing pattern for state that doesn't need to survive a restart — WebRTC
signaling state (who's connected, in-flight offers) fits this same tier exactly and will follow
the same pattern rather than introducing a new persistence mechanism.

**Mobile navigation**: Expo Router, file-based (`apps/mobile/app/`). `app/index.tsx` (home:
create/join a listening room), `app/room/[code].tsx` (listening room). Karaoke gets its own
sibling routes rather than being bolted onto the listening-room screen, since it's a distinct
room *type* (singer/listeners/mic vs. shared-queue/synced-YouTube), matching how the spec
describes it as a new, separate experience.

**State management (mobile)**: no global store (no Redux/Zustand) — per-screen React state plus
TanStack Query for server data (`@tanstack/react-query`) and a hand-rolled reducer hook per
realtime concern (`useRoomSocket` for the listening room). Karaoke follows the same shape: a
`useKaraokeRoomSocket` hook (REST snapshot + socket-driven state, mirroring `useRoomSocket`) plus
a separate `useKaraokeWebRTC` hook owning peer connections/mic capture.

**Env/config handling**: `EXPO_PUBLIC_*` vars read via `process.env` at build time (Expo's
convention, mirrors Next's `NEXT_PUBLIC_*`), see `apps/mobile/.env.example`. Server reads plain
`process.env` via `apps/server/src/lib/env.ts`. No new env vars are strictly required for
karaoke's MVP (Socket.IO signaling reuses `EXPO_PUBLIC_SOCKET_URL`); STUN/TURN config is
addressed in `docs/karaoke-audio.md`.

## What gets reused as-is

- Guest-session pattern (create/join → id + displayName, stored client-side, sent as
  `x-session-id`) — same *pattern*, new tables (see below; a karaoke room is a different entity
  from a listening `Room`, so this is a parallel identity, not a shared one — `UserSession.roomId`
  is a required 1:1 FK to a listening `Room` and isn't reused directly).
- Socket.IO server/instance, event-constant style (`SocketEvents.X = "x"`), typed
  `ServerToClientEvents`/`ClientToServerEvents` maps, in-memory per-room `Map` state pattern.
- YouTube URL parsing/validation (`packages/shared/src/youtube.ts`), metadata-fetch service
  (`apps/server/src/services/youtube/*`).
- `react-native-youtube-iframe` for the backing-track playback surface, and the existing
  server-timestamp-projection sync strategy (`projectPlaybackPosition`) for keeping every
  listener's locally-played backing track aligned — see `docs/karaoke-audio.md` for exactly how
  this composes with the new WebRTC mic audio.
- Mobile UI primitives (`apps/mobile/src/components/ui/{Card,Button,TextField}.tsx`), theme
  (`apps/mobile/src/theme.ts`), toast system (`apps/mobile/src/lib/toast.ts`).
- REST client conventions (`apps/mobile/src/lib/api.ts`'s `request()`/`ApiError` pattern),
  Express router/service-layer split, `HttpError`-based error handling.

## What's new

- **Database**: two new Prisma models, `KaraokeRoom` and `KaraokeMember` (see schema migration).
  Deliberately *not* adding a third `karaoke_sessions` table as the spec's example schema
  suggests — a "session" here (mic on → mic off) is fully captured by `KaraokeRoom.status`
  (WAITING/SINGING/ENDED) plus its song/timestamp fields, so a separate table would just
  duplicate room state for no MVP benefit ("do not create unnecessary tables" is itself a spec
  instruction). No raw audio is ever persisted anywhere — WebRTC media never touches the server.
- **Signaling**: new Socket.IO events (`karaoke_*` namespace) relaying SDP offers/answers/ICE
  candidates directly between the singer's socket and each listener's socket, plus room-lifecycle
  events (join/leave/start-singing/mic-toggle/end-session). No new transport — same `io` instance.
- **WebRTC audio**: `react-native-webrtc` on the mobile client — singer captures a mic-only local
  audio track and opens one `RTCPeerConnection` per listener (a star topology centered on the
  singer, not a full mesh, since listeners never need to hear each other or send audio at all).
  This is a **native module and cannot run inside Expo Go** — see `BLOCKED.md`, this is the
  single biggest practical constraint on testing.
- **Mobile screens**: `app/karaoke/index.tsx` (create/join), `app/karaoke/[code].tsx` (room,
  role-conditional UI for singer vs. listener), new hooks/components under
  `src/{hooks,components/karaoke,lib}`.
- **Backend**: `apps/server/src/routes/karaoke.ts`, `services/karaokeRoomService.ts`,
  `socket/karaoke.ts`, `middleware/karaokeSessionAuth.ts` (mirrors `sessionAuth.ts` but checks
  `KaraokeMember` instead of `UserSession`).
