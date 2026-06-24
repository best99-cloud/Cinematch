// /api/trending — trending movies today, optionally filtered to an industry.
import { setCors, requireApiKey, fetchTmdb, TMDB_INDUSTRY_FILTERS } from "./_tmdb.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { industry } = req.query;

  const params = new URLSearchParams({ api_key: apiKey, language: "en-US" });
  const data = await fetchTmdb("/trending/movie/day", params, res);
  if (!data) return;

  let results = data.results || [];

  // TMDB's trending endpoint doesn't support origin-country filtering directly,
  // so when an industry is requested we filter client-side by original_language
  // as a reasonable proxy (imperfect, but avoids a second round-trip per title).
  if (industry && TMDB_INDUSTRY_FILTERS[industry]) {
    const lang = TMDB_INDUSTRY_FILTERS[industry].with_original_language;
    results = results.filter((m) => m.original_language === lang);
  }

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  return res.status(200).json({ ...data, results });
}
