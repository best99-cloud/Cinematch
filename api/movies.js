// /api/movies — discover movies by industry + genre, paginated.
import { setCors, requireApiKey, fetchTmdb, TMDB_GENRE_IDS, TMDB_INDUSTRY_FILTERS } from "./_tmdb.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { industry, genres, page = "1" } = req.query;

  const industryFilter = TMDB_INDUSTRY_FILTERS[industry];
  if (!industryFilter) {
    return res.status(400).json({ error: `Unknown industry: ${industry}` });
  }

  const genreList = (genres || "").split(",").filter(Boolean);
  const genreIds = genreList.map((g) => TMDB_GENRE_IDS[g]).filter(Boolean);
  if (genreIds.length === 0) {
    return res.status(400).json({ error: `No valid genres provided: ${genres}` });
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    sort_by: "popularity.desc",
    page: String(page),
    with_genres: genreIds.join(","),
    with_origin_country: industryFilter.with_origin_country,
    with_original_language: industryFilter.with_original_language,
    include_adult: "false",
  });

  const data = await fetchTmdb("/discover/movie", params, res);
  if (!data) return;

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  return res.status(200).json(data);
}
