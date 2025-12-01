# Alphy (code name DAH)

Alphy is a social forum plus mind-mapping environment with integrated book discovery and download tooling (Flibusta + Z-Library). The backend is a Node/Express API with MongoDB, Socket.IO, and Puppeteer-powered scrapers. The frontend is a Next.js client located in `client/`.

## Local Development

### Prerequisites

- Node.js 18+
- MongoDB instance
- Redis 6+ (required for the Z-Library job queue)

### Install dependencies

```bash
npm install
(cd client && npm install)
```

### Start services

1. **Redis**  
   - macOS (Homebrew): `brew services start redis`  
   - Docker: `docker run --name dah-redis -p 6379:6379 -d redis:7`

2. **Backend API**  
   ```bash
   npm run dev:server
   ```

3. **Z-Library worker (required for search/download jobs)**  
   ```bash
   npm run worker:zlibrary
   ```

4. **Frontend (optional / separate deployment)**  
   ```bash
   cd client
   npm run dev
   ```

### Environment variables

Create a `.env` file in the project root with at least:

```
MONGODB_URI=...
JWT_SECRET=...
VK_TOKEN=...
IMGBB_API_KEY=...
REDIS_URL=redis://127.0.0.1:6379
ZLIBRARY_BASE_URL=https://z-library.sk
ZLIBRARY_PASSWORD=...
ZLIBRARY_ACCOUNT_POOL=email1@example.com,email2@example.com
ZLIBRARY_PROXY_URL=https://zlibrary-proxy.alphy-flibusta.workers.dev
FLIBUSTA_PROXY_URL=https://flibusta-proxy.alphy-flibusta.workers.dev
```

## Job Queue & Workers

- `queues/zlibraryQueue.js` exposes helpers that the API uses to enqueue search/download/warmup jobs.  
- `workers/zlibraryWorker.js` hosts a single Puppeteer session and processes jobs one-at-a-time (per Render free dyno).  
- `workers/zlibraryWarmupCron.js` can be run on a Render cron instance to keep sessions warm.  
- Scripts:
  - `npm run worker:zlibrary`
  - `npm run cron:zlibrary-warmup`

## Deployment

### Render.com backend & workers

`render.yaml` now provisions four services plus a shared Redis instance:

1. `dah-api` (Express API & Mongo integrations)
2. `zlib-worker-a` (Puppeteer worker, concurrency=1)
3. `zlib-worker-b` (second redundant worker)
4. `dah-redis` (shared queue backend)

Deploy by connecting the repo in Render and selecting “Infrastructure as Code → render.yaml”. Secrets such as `MONGODB_URI`, `JWT_SECRET`, `VK_TOKEN`, etc. remain `sync: false` so they can be injected via the Render dashboard. If you need session warmups, trigger the `/api/books/zlibrary/warmup` endpoint from an external scheduler (e.g., GitHub Actions or UptimeRobot) since Render’s cron jobs aren’t free.

### Frontend (Vercel)

The Next.js client is deployed independently (Vercel recommended) with the following env vars:

- `NEXT_PUBLIC_API_URL=https://dah.onrender.com`
- `NEXT_PUBLIC_SITE_URL=https://alphy.tech`
- `NEXT_PUBLIC_IMGBB_API_KEY=...`
- `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=...`
- `NEXT_PUBLIC_FLIBUSTA_PROXY_URL=https://flibusta-proxy.alphy-flibusta.workers.dev`


