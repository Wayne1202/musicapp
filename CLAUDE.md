# musicapp — Collaborative Music Room

## Product spec (MVP)

A web app where friends join a shared room, queue YouTube songs, and listen
together in sync while playing games or browsing other tabs. Background
playback (tab not focused) is a hard requirement. Karaoke and voice chat are
explicitly out of scope for now.

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
plain HTML controls), no Firebase/Supabase, guest sessions only, no karaoke.

## Tech stack

- **apps/web** — Next.js 14 (App Router), React 18, TypeScript, Tailwind,
  shadcn/ui (Radix primitives in `src/components/ui`), TanStack Query,
  socket.io-client, react-youtube.
- **apps/server** — Node, Express, TypeScript, Socket.IO, Prisma.
- **packages/shared** — types, Socket.IO event name/payload contracts, and
  YouTube URL parsing utilities shared by both apps (`@musicapp/shared`).
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

Phase 1 (MVP) + Phase 2 (deploy) + Phase 3 (UX depth) are all implemented:
rooms, queue (add/remove/move/drag-reorder/shuffle/clear/repeat, remaining
play time), playback sync with periodic drift correction, song attribution
(queue rows and now-playing), recently-played history, presence (typing
indicator, colored avatars), toast notifications for room events, a mobile
bottom mini-player bar, and a real-time room chat. Not implemented: YouTube
search, auth beyond guest sessions, Spotify integration, karaoke — all
explicitly out of scope per the spec.

**Known platform limitation** (not a bug): audio does not continue when a
phone's browser is backgrounded in favor of a *different app* (as opposed to
switching browser tabs, which works fine). This is an OS-level restriction on
cross-origin iframe media (our player is an embedded YouTube iframe) that
every YouTube-embed-based web app hits — fixing it for real would require a
native app or extracting YouTube's audio stream server-side (the latter
violates YouTube's ToS and won't be implemented).

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
