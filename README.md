# CineMatch

AI-flavored movie discovery app: pick a "wood" (Hollywood, Bollywood, Nollywood, etc.), up to 3 genres, and a mood — get movie suggestions with real posters, trailers, and streaming links pulled live from TMDB.

## Features

- **Discover by industry + genre + mood** — live results from TMDB's discover endpoint, with infinite scroll ("Load More Movies").
- **Trending Today** — a horizontally-scrolling row of today's trending movies on the home screen.
- **Search** — by movie title/quote keywords, or by actor/director name.
- **Per-movie detail (loaded on expand, not upfront)**:
  - Real trailer (embedded YouTube player)
  - Streaming providers with logos and clickable links (stream / rent / buy)
  - Director, cast, runtime
  - "Because you liked X" — TMDB's recommendations for that title, clickable to jump straight to that movie
- **No forced offline fallback on empty results** — if TMDB genuinely has nothing for a specific industry+genre+mood combo, the app shows a clear "no results" message instead of silently substituting offline data. The offline dataset is still used as a safety net if the API call itself fails (network/auth/server error).

## How it's structured

- `src/App.jsx` — top-level state machine: selection screen, warning screen, results screen.
- `src/MovieCard.jsx` — individual result card; lazily fetches trailer/providers/recommendations only when expanded.
- `src/TrendingRow.jsx` — trending-today horizontal scroller.
- `src/SearchBar.jsx` — title/quote and actor/director search.
- `src/constants.js` — static config (industries, genres, moods, content warnings, offline fallback dataset).
- `api/_tmdb.js` — shared helpers (TMDB base URL, genre/industry ID maps, CORS, error handling).
- `api/movies.js` — discover movies by industry + genre (paginated).
- `api/trending.js` — trending movies today.
- `api/recommendations.js` — "because you watched X" for a given movie ID.
- `api/movie-details.js` — trailer + watch providers + director/cast for a given movie ID (one combined call via TMDB's `append_to_response`).
- `api/search.js` — search by title/keywords, or by actor/director name.

All API routes are Vercel serverless functions that hold the TMDB key **server-side** — the browser only ever calls your own `/api/...` routes, never `api.themoviedb.org` directly. This avoids both the key-exposure problem and any CORS/sandboxing issues.

## Run locally

```bash
npm install
npm run dev
```

This starts the Vite dev server (frontend only). To test the full app locally including the `/api/*` routes, use the Vercel CLI instead:

```bash
npm install -g vercel
vercel dev
```

`vercel dev` reads `.env.local` automatically, which already has `TMDB_API_KEY` set for local testing.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in (GitHub login works), and click **Add New Project**.
3. Import your repository — Vercel will auto-detect it as a Vite project.
4. Before deploying, go to **Project Settings → Environment Variables** and add:
   - Key: `TMDB_API_KEY`
   - Value: your TMDB v3 API key (get one free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
5. Click **Deploy**. You'll get a live URL like `cinematch.vercel.app`.

**Important:** `.env.local` is in `.gitignore` and will NOT be pushed to GitHub — that's intentional, so your real key never ends up in your public repo. You must add the key again in Vercel's dashboard (step 4).

## Notes

- TMDB attribution: this product uses the TMDB API but is not endorsed or certified by TMDB.
- `/api/movies`, `/api/recommendations`, and `/api/movie-details` cache successful responses for 1 hour at the edge (`Cache-Control: s-maxage=3600`) to reduce TMDB API calls. `/api/trending` and `/api/search` use shorter cache windows since they're more time-sensitive.
- Streaming provider region defaults to `US`. TMDB's watch-provider data varies significantly by region and doesn't cover every country evenly.
