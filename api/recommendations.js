// /api/recommendations?movieId=27205 — "Because you watched X" suggestions.
import { setCors, requireApiKey, fetchTmdb } from "./tmdb.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { movieId, page = "1" } = req.query;
  if (!movieId || !/^\d+$/.test(String(movieId))) {
    return res.status(400).json({ error: `Invalid or missing movieId: ${movieId}` });
  }

  const params = new URLSearchParams({ api_key: apiKey, language: "en-US", page: String(page) });
  const data = await fetchTmdb(`/movie/${movieId}/recommendations`, params, res);
  if (!data) return;

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  return res.status(200).json(data);
}
