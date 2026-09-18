# musicapp — Collaborative Music Room

## Product spec (MVP)

A web app where friends join a shared room, queue YouTube songs, and listen
together in sync while playing games or browsing other tabs. Background
playback (tab not focused) is a hard requirement.

A karaoke feature (one singer streams live mic audio via WebRTC over a
synced YouTube backing track; everyone else listens) was added later on top
of this MVP — see "Karaoke feature" in Status below and `PROJECT_KARAOKE.md`.
Voice chat beyond that is still out of scope.

**Auth:** guest-only. Users enter a display name and get a session ID stored
in `localStorage`. No email/OAuth.

**Core features:**
1. Rooms — create, join by code, join by URL, show online users.
2. Shared playlist — one queue per room, any user can add, appended to the end.
3. Add songs — paste a YouTube URL (`youtube.com/watch?v=`, `youtu.be/`, also
   tolerates `/embed/`, `/shorts/`, `/live/`, and a bare 11-char video ID).
   Extract and store `videoId`, `title`, `thumbnail`, `duration`. YouTube
   search is optional/not implemented.
4. Synchronized playback — browser streams directly from YouTube; backend only
   synchronizes state (`currentVideoId`, `currentTimestamp`, `isPlaying`,
   `queue[]`). New joiners load the current song, seek to the room's
   timestamp, and continue.
5. Real-time updates via Socket.IO: `user_joined`, `user_left`, `song_added`,
   `queue_updated`, `song_changed`, `playback_started`, `playback_paused`,
   `playback_seeked`.
6. Background playback — implemented by keeping the YouTube IFrame player
   mounted (2x2px, positioned off-screen, never `display:none`/
   `visibility:hidden`) so the browser treats it as active/audible,
   Spotify-Web-style. The player instance itself is owned by
   `usePlayerController` (one instance per room, shared by the full
   NowPlaying card and the mobile bottom bar) and rendered by
   `apps/web/src/components/room/PlayerEngine.tsx`. Mobile browsers only
   honor a "real user tap" for a brief synchronous window, so the first
   play call is deliberately synchronous (no `await` before it).

**UI:** dark-mode-first, Spotify/Discord-inspired, shadcn/ui components,
responsive. Layout: header (room name, online count, invite) → add-song bar →
now playing (art, title, progress, play/pause/skip) → queue + online users
side by side.

**Constraints:** TypeScript everywhere, Next.js App Router, shadcn/ui (no
plain HTML controls), no Firebase/Supabase, guest sessions only.

## Tech stack

- **apps/web** — Next.js 14 (App Router), React 18, TypeScript, Tailwind,
  shadcn/ui (Radix primitives in `src/components/ui`), TanStack Query,
  socket.io-client, react-youtube.
- **apps/mobile** — Expo SDK 57 (React Native 0.86, React 19), TypeScript,
  Expo Router, TanStack Query, socket.io-client, react-native-youtube-iframe.
  Hits the exact same backend as apps/web (stateless REST + Socket.IO,
  `x-session-id` header — no cookies, so no CORS/session changes were needed
  server-side for a native client). Its own `src/hooks/usePlayerController.ts`
  and `src/components/room/PlayerEngine.tsx` are a from-scratch port, not a
  copy, of the web app's — react-native-youtube-iframe is a *controlled*
  component (a `play` boolean prop) rather than react-youtube's imperative
  playVideo()/pauseVideo(), and its player is rendered visibly (no reason to
  hide it the way the web app hides its iframe for the browser-tab-audibility
  trick — see item 6 below). Background audio is *not* solved on mobile
  either — see "Known platform limitation" below, it now covers native too.
- **apps/server** — Node, Express, TypeScript, Socket.IO, Prisma.
- **packages/shared** — types, Socket.IO event name/payload contracts, and
  YouTube URL parsing / playback-position / permission-check utilities
  shared by all three apps (`@musicapp/shared`).
- **Database** — PostgreSQL via Prisma (`apps/server/prisma/schema.prisma`:
  `Room`, `UserSession`, `QueueItem`, `PlaybackState`, `RecentlyPlayedItem`,
  `ChatMessage`).

npm workspaces monorepo; root `package.json` has `dev`, `dev:server`,
`dev:web`, `build`, `db:generate`, `db:migrate`, `db:studio`.

## Status

**Deployed and live**: frontend on Vercel (`musicapp-web-fawn.vercel.app`),
backend on Railway (Dockerfile-based, `musicappserver-production.up.railway.app`),
database on Neon. GitHub: `github.com/Wayne1202/musicapp`, `main` branch,
auto-deploys both services on push. See `README.md` for the full deploy
walkthrough and `apps/server/Dockerfile`'s comments for the OpenSSL/Prisma
gotchas that took a few iterations to get right on Railway (Alpine → Debian
slim → explicit `apt-get install openssl`, and generating the Prisma client
*after* `prisma/schema.prisma` is actually in the build context).

Phase 1 (MVP) + Phase 2 (deploy) + Phase 3 (UX depth) + Phase 4 (in-app
search, misc polish) are all implemented on **apps/web**: rooms, queue
(add/remove/move/drag-reorder/shuffle/clear/repeat, remaining play time),
in-app YouTube search, playback sync with periodic drift correction, song
attribution (queue rows and now-playing), recently-played history, room
history feed, presence (typing indicator, colored avatars), reactions,
vote-to-skip, room settings (queue lock, skip mode, etc.), toast
notifications for room events, a mobile-web bottom mini-player bar, and a
real-time room chat with @mentions. Not implemented: auth beyond guest
sessions, Spotify integration — out of scope per the spec.

**Phase 5 (native mobile app, `apps/mobile`)**: near full feature parity
with apps/web, verified end-to-end (create/join room, real-time sync with
the web app, YouTube player mount + play/pause/seek, queue add/remove/
move, chat with emoji picker, reactions, online users + host transfer,
vote-skip, invite via QR/link/share, room settings, recently-played/room-
history). Deliberately deferred, not architecturally blocked:
message-mention autocomplete (plain @mentions still highlight and toast)
and drag-and-drop queue reorder (up/down buttons are a full functional
substitute). See `progress.md` for the phase-by-phase build log and
`BLOCKED.md` for environment gaps (no full Xcode install on the dev
machine at the time this was built, no Android emulator) that limited how
much of it could be self-verified
versus needing manual testing.

**Karaoke feature** (added on top of the MVP, on both platforms): one
SINGER selects a YouTube song and streams live mic audio over WebRTC to
LISTENERS, who also hear the same backing track via the existing playback-
sync mechanism (`projectPlaybackPosition`) — no new infrastructure, reuses
the same Socket.IO server for signaling. Backend: `KaraokeRoom`/
`KaraokeMember` Prisma models, `apps/server/src/{routes,socket,services}/
karaoke*`. Mobile (`apps/mobile/app/karaoke/*`): uses `react-native-webrtc`,
a native module — needs a custom EAS dev-client build (Android build
verified working; iOS needs a paid Apple Developer Program membership, see
`BLOCKED.md`) since it can't run in Expo Go. Web (`apps/web/src/app/
karaoke/*`, added 2026-09-18): uses the browser's native WebRTC support
instead — no native module, no build/account needed at all, verified
end-to-end in two browser tabs (mic capture itself untested only because
this dev environment's browser tool sandboxes it, see `BLOCKED.md`). Full
details: `PROJECT_KARAOKE.md`, `docs/karaoke-audio.md`, `TASKS_KARAOKE.md`.
**Long-term direction** (not yet built): the user wants web and mobile to
converge into one system with real cross-device login rather than today's
guest-only, per-device sessions — see memory note on this if picking up
auth/identity work.

**Known platform limitation** (not a bug, and confirmed not fixable by going
native either): audio does not continue when a phone's browser is
backgrounded in favor of a *different app* (as opposed to switching browser
tabs, which works fine). This was originally written assuming a native app
would fix it via `UIBackgroundModes`/foreground-service audio — it doesn't.
YouTube's IFrame Player API (the only legitimate way to embed YouTube
playback) runs inside a WebView/iframe sandbox by design on *every*
platform, native apps included, and never exposes a raw stream — this is
very likely deliberate on YouTube's part, since background audio is a
Premium-subscription selling point they have a business reason to keep
exclusive to their own app. Actually fixing this would mean either
extracting YouTube's audio stream server-side (violates YouTube's ToS, won't
be implemented) or switching the content source to something with an
official background-audio SDK (Spotify, Apple Music, ...) — a real product
pivot (every listener needs a paid account on that service; catalog changes
from "any YouTube link" to that service's library) that was discussed and
explicitly deferred, not chosen, when apps/mobile was built. `apps/mobile`
exists anyway for the native-app/native-UX value on its own, not because it
solves this.

**Mobile CSS gotcha worth knowing**: a flex item with `min-w-0 flex-1` plus a
`truncate` child can still force horizontal viewport overflow with certain
long/CJK text, even though that's the textbook fix — discovered via a queue
row with a Korean title. The reliable fix that empirically closed it was
adding an explicit `w-0` alongside `min-w-0 flex-1` (see `Queue.tsx`,
`ChatPanel.tsx`, `RecentlyPlayed.tsx`, `BottomPlayerBar.tsx`,
`AddSongForm.tsx`). Always verify mobile layout with a real Playwright
mobile-viewport pass (checking `document.documentElement.scrollWidth` vs
`clientWidth`) before calling a mobile change done — screenshots alone can
look fine while overflow is actually present just off-frame.

## Local setup on this machine

This machine's specifics — a fresh clone elsewhere may not need all of this:

- **Node version matters for Prisma.** The default `node` on PATH here is
  v18.16.0 (too old for Next.js 14, which needs >=18.17) and its architecture
  didn't match the Prisma-generated engine (`darwin-arm64` client vs binary
  needing plain `darwin`/x64). Fix: use Homebrew's `node@20`
  (`/usr/local/opt/node@20/bin`) for everything — `export
  PATH="/usr/local/opt/node@20/bin:$PATH"` before running npm/node commands —
  and re-run `npm run db:generate` if you ever regenerate the Prisma client
  under a different node than the one that runs the server.
- **Port 5432 is occupied by an unrelated, pre-existing PostgreSQL 15
  instance** on this machine (`/Library/PostgreSQL/15`, password-protected,
  not ours to touch). The project's own Postgres (via `brew` `postgresql@16`)
  was reconfigured to **port 5433** instead
  (`/usr/local/var/postgresql@16/postgresql.conf`, `port = 5433`), started
  with `brew services start postgresql@16`. A `musicapp` role/db were created
  with `CREATEDB` (needed for Prisma's shadow database during
  `migrate dev`). `apps/server/.env`'s `DATABASE_URL` points at
  `localhost:5433`. The committed `docker-compose.yml` still maps Postgres to
  5432 for anyone using Docker instead — that's fine, it's a separate path
  from this manual setup.
- `.env` files (`apps/server/.env`, `apps/web/.env`) are gitignored-style
  local config, not committed — copy from the adjacent `.env.example` files.
  They already exist on this machine with the above `DATABASE_URL`.

## Run it

```bash
export PATH="/usr/local/opt/node@20/bin:$PATH"   # only needed on this machine
npm run db:generate   # after any prisma schema change or fresh clone
npm run db:migrate     # applies migrations (first run creates the schema)
npm run dev            # backend :4000 + web :3000 together
# or separately: npm run dev:server / npm run dev:web
```

Health check: `curl http://localhost:4000/health`. Optional
`YOUTUBE_API_KEY` in `apps/server/.env` gets real durations; without it the
server falls back to YouTube's keyless oEmbed endpoint (title + thumbnail
only).

For the mobile app: `cd apps/mobile && npx expo start`, then `i`/`a` for a
simulator/emulator or scan the QR with Expo Go on a physical device. See
`apps/mobile/.env.example` for why `localhost` only works from the iOS
Simulator or a web preview, not a physical device or the Android emulator.
