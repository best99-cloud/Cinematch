// Shared helpers for all /api/* serverless functions.
// Centralizes TMDB config, CORS headers, and error handling so each
// route file only needs to define its own TMDB endpoint + params.

export const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

export const TMDB_GENRE_IDS = {
  action: 28,
  comedy: 35,
  romance: 10749,
  thriller: 53,
  horror: 27,
  drama: 18,
  "sci-fi": 878,
  animation: 16,
  fantasy: 14,
  documentary: 99,
  crime: 80,
  musical: 10402,
};

export const TMDB_INDUSTRY_FILTERS = {
  hollywood: { with_origin_country: "US", with_original_language: "en" },
  bollywood: { with_origin_country: "IN", with_original_language: "hi" },
  nollywood: { with_origin_country: "NG", with_original_language: "en" },
  tollywood: { with_origin_country: "IN", with_original_language: "te" },
  kollywood: { with_origin_country: "IN", with_original_language: "ta" },
  jollywood: { with_origin_country: "GH", with_original_language: "en" },
  french: { with_origin_country: "FR", with_original_language: "fr" },
  korean: { with_origin_country: "KR", with_original_language: "ko" },
  chinese: { with_origin_country: "CN", with_original_language: "zh" },
  japanese: { with_origin_country: "JP", with_original_language: "ja" },
};

// Known watch-provider IDs on TMDB (used to render logos + deep links).
// TMDB's /watch/providers endpoint returns logo_path + provider_id per region;
// this map lets us link straight to the provider's own site as a fallback
// when TMDB doesn't give us a direct deep link for a specific title.
export const PROVIDER_HOMEPAGES = {
  8: "https://www.netflix.com",
  9: "https://www.amazon.com/gp/video/storefront",
  337: "https://www.disneyplus.com",
  15: "https://www.hulu.com",
  1899: "https://www.max.com",
  2: "https://tv.apple.com",
  122: "https://www.hotstar.com",
  220: "https://www.zee5.com",
  581: "https://www.showmax.com",
  192: "https://www.youtube.com",
};

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

export function requireApiKey(res) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "TMDB_API_KEY is not configured on the server. Add it in Vercel project settings → Environment Variables.",
    });
    return null;
  }
  return apiKey;
}

export async function fetchTmdb(path, params, res) {
  let tmdbRes;
  try {
    tmdbRes = await fetch(`${TMDB_BASE}${path}?${params.toString()}`);
  } catch (networkErr) {
    res.status(502).json({ error: `Network error reaching TMDB: ${networkErr.message}` });
    return null;
  }

  // Read as text first — TMDB (or an intermediary like a CDN, ad-blocker,
  // or regional network block) can return HTML or plain text instead of
  // JSON, especially during outages or rate-limit/anti-bot responses.
  // Calling .json() directly in that case throws a generic, undiagnosable
  // "Unexpected token '<'" error with no indication of what really happened.
  const rawText = await tmdbRes.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    res.status(502).json({
      error: `TMDB returned a non-JSON response (HTTP ${tmdbRes.status}). This usually means a network block, CDN error page, or a temporary TMDB outage — not a bug in this app. Raw response start: ${rawText.slice(0, 200)}`,
    });
    return null;
  }

  if (!tmdbRes.ok) {
    res.status(tmdbRes.status).json({ error: data.status_message || "TMDB API error" });
    return null;
  }

  return data;
}
