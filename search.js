// /api/search?query=...&type=person|movie — search by actor/director name or
// free-text (title/quote-ish keyword search via TMDB's /search/movie).
import { setCors, requireApiKey, fetchTmdb, TMDB_IMG_BASE } from "./tmdb.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { query, type = "movie", page = "1" } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  if (type === "person") {
    // Step 1: find the person
    const personParams = new URLSearchParams({ api_key: apiKey, language: "en-US", query, page: "1" });
    const personData = await fetchTmdb("/search/person", personParams, res);
    if (!personData) return;

    const person = personData.results?.[0];
    if (!person) {
      return res.status(200).json({ results: [], personName: null });
    }

    // Step 2: get that person's movie credits (acting + directing combined)
    const creditsParams = new URLSearchParams({ api_key: apiKey, language: "en-US" });
    const creditsData = await fetchTmdb(`/person/${person.id}/movie_credits`, creditsParams, res);
    if (!creditsData) return;

    const combined = [...(creditsData.cast || []), ...(creditsData.crew || []).filter((c) => c.job === "Director")];
    const seen = new Set();
    const deduped = combined.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    deduped.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({
      results: deduped,
      personName: person.name,
      personPhoto: person.profile_path ? `${TMDB_IMG_BASE}/w185${person.profile_path}` : null,
    });
  }

  // Default: free-text movie search (title, or any words from a remembered quote/scene)
  const params = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    query,
    page: String(page),
    include_adult: "false",
  });
  const data = await fetchTmdb("/search/movie", params, res);
  if (!data) return;

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  return res.status(200).json(data);
}
