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
   mounted at 1x1px (never `display:none`) so the browser treats the tab as
   active/audible, Spotify-Web-style. See `apps/web/src/components/room/NowPlaying.tsx`.

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
  `Room`, `UserSession`, `QueueItem`, `PlaybackState`).

npm workspaces monorepo; root `package.json` has `dev`, `dev:server`,
`dev:web`, `build`, `db:generate`, `db:migrate`, `db:studio`.

## Status

All of the above is implemented (rooms, queue, playback sync, presence,
background playback, dark-mode shadcn UI). Verified working end-to-end with a
two-session Playwright run (create room → add song → auto-starts playback →
second user joins by URL → both sessions see live presence/queue updates via
Socket.IO). Not implemented: YouTube search (explicitly optional in the spec).

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
