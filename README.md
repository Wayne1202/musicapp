# Music Room

Create a room, share the link, paste YouTube songs into a shared queue, and listen together
in sync — playback continues even if you switch tabs or minimize the browser.

## Stack

- **apps/web** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query,
  Socket.IO client, react-youtube.
- **apps/server** — Node, Express, TypeScript, Socket.IO, Prisma.
- **packages/shared** — types and constants shared by both apps.
- **Database** — PostgreSQL.

## Local development

You need Node.js 18.17+ (or 20+) and a local PostgreSQL. Then:

```bash
npm install
cp apps/server/.env.example apps/server/.env   # edit DATABASE_URL if needed
cp apps/web/.env.example apps/web/.env
npm run db:generate
npm run db:migrate
npm run dev        # backend on :4000, web on :3000
```

Open http://localhost:3000. `docker-compose.yml` at the repo root will start a local Postgres
for you (`docker compose up -d`) if you don't already have one running — just make sure the
`DATABASE_URL` in `apps/server/.env` matches it.

## Deploying to production

This app deploys as three separate pieces: the database (Neon), the backend (Railway), and the
web app (Vercel). None of them need you to touch a terminal — everything below is clicking
around in each service's website. The one fiddly part is that Railway and Vercel each need to
know the *other's* URL, so you'll deploy once, copy a URL, paste it into the other service, and
redeploy. The steps below are in the right order to minimize back-and-forth.

### 1. Push this code to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

### 2. Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up / log in.
2. Create a new project (any name/region is fine).
3. On the project dashboard, find the **Connection string** dropdown and copy **both**
   variants — you need both, not just one:
   - **Pooled connection** (host has `-pooler` in it) — this is `DATABASE_URL`, used for the
     app's normal runtime queries.
   - **Direct connection** (no `-pooler`) — this is `DIRECT_URL`, used only by
     `prisma migrate deploy` when the container boots. Prisma's migration engine takes an
     advisory lock that Neon's pooler (PgBouncer, transaction mode) doesn't support reliably —
     pointing migrations at the pooled URL can make `migrate deploy` silently no-op (it reports
     success without actually applying the migration) instead of failing loudly. If you skip
     this and a migration ever seems to "not take" after a deploy, this is why.
4. Keep this tab open — you'll paste both strings into Railway next.

### 3. Deploy the backend (Railway)

1. Go to [railway.app](https://railway.app) and sign up / log in with GitHub.
2. **New Project -> Deploy from GitHub repo** -> pick this repo.
3. Railway will try to build it automatically — it should detect `railway.json` at the repo
   root and use `apps/server/Dockerfile` to build. If it asks for a **Root Directory**, leave
   it blank/as the repo root (the Dockerfile needs sibling access to `packages/shared`).
4. Open the service's **Variables** tab and add (see `apps/server/.env.production.example`
   for the full list with explanations):
   - `DATABASE_URL` — the **pooled** Neon connection string from step 2.
   - `DIRECT_URL` — the **direct** (non-pooled) Neon connection string from step 2.
   - `CLIENT_ORIGIN` — for now, put a placeholder like `https://placeholder.vercel.app`; you'll
     come back and fix this in step 5 once you know your real Vercel URL.
   - `YOUTUBE_API_KEY` — optional, leave blank to use the no-key fallback.
5. Open **Settings -> Networking -> Generate Domain** to get a public URL, something like
   `https://musicapp-production.up.railway.app`. Copy it.
6. Wait for the deploy to finish, then visit `<that-url>/health` — you should see `{"ok":true}`.

### 4. Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up / log in with GitHub.
2. **Add New -> Project** -> pick this repo.
3. Vercel will ask for a **Root Directory** — set it to `apps/web`. It auto-detects Next.js;
   no build command changes needed.
4. Add environment variables (see `apps/web/.env.production.example`):
   - `NEXT_PUBLIC_API_URL` — the Railway URL from step 3.5.
   - `NEXT_PUBLIC_SOCKET_URL` — the same Railway URL.
5. Click **Deploy**. When it finishes you'll get a URL like `https://musicapp.vercel.app`.
   Copy it.

### 5. Close the loop: tell Railway about the Vercel URL

1. Back in Railway, open the service's **Variables** tab again.
2. Set `CLIENT_ORIGIN` to your real Vercel URL from step 4.5 (e.g.
   `https://musicapp.vercel.app`) — this is what allows the browser to talk to your backend
   (CORS) and is required for Socket.IO to connect.
3. Save — Railway redeploys automatically.

### 6. Try it

Open your Vercel URL, create a room, and share the link. That's it — you're live.

### Updating after the first deploy

Both Railway and Vercel auto-deploy whenever you push to the `main` branch on GitHub. No
manual redeploy step needed for future changes.

## Environment variables reference

| App | Variable | Where it comes from |
|---|---|---|
| server | `DATABASE_URL` | Neon **pooled** connection string (runtime queries) |
| server | `DIRECT_URL` | Neon **direct** connection string (migrations only — see step 2) |
| server | `PORT` | Set by Railway automatically in production |
| server | `CLIENT_ORIGIN` | Your Vercel URL (comma-separate multiple origins) |
| server | `YOUTUBE_API_KEY` | Optional, from Google Cloud Console |
| web | `NEXT_PUBLIC_API_URL` | Your Railway URL |
| web | `NEXT_PUBLIC_SOCKET_URL` | Your Railway URL (same as above) |
