// /api/movie-details?movieId=27205 — trailers + streaming providers for one title.
// Uses TMDB's append_to_response to fetch videos + watch/providers in a single
// upstream request instead of three separate round-trips.
import { setCors, requireApiKey, fetchTmdb, TMDB_IMG_BASE, PROVIDER_HOMEPAGES } from "./tmdb.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { movieId, region = "US" } = req.query;
  if (!movieId || !/^\d+$/.test(String(movieId))) {
    return res.status(400).json({ error: `Invalid or missing movieId: ${movieId}` });
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    append_to_response: "videos,watch/providers,credits",
  });

  const data = await fetchTmdb(`/movie/${movieId}`, params, res);
  if (!data) return;

  // Pick the best trailer: prefer an official YouTube "Trailer", else any YouTube video.
  const videos = data.videos?.results || [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    videos.find((v) => v.site === "YouTube") ||
    null;

  // Watch providers for the requested region, with clickable links.
  const regionProviders = data["watch/providers"]?.results?.[region];
  const flatten = (list = []) =>
    list.map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: p.logo_path ? `${TMDB_IMG_BASE}/w92${p.logo_path}` : null,
      link: PROVIDER_HOMEPAGES[p.provider_id] || regionProviders?.link || null,
    }));

  const watchProviders = regionProviders
    ? {
        flatrate: flatten(regionProviders.flatrate),
        rent: flatten(regionProviders.rent),
        buy: flatten(regionProviders.buy),
        tmdbLink: regionProviders.link || null,
      }
    : { flatrate: [], rent: [], buy: [], tmdbLink: null };

  const director = data.credits?.crew?.find((c) => c.job === "Director")?.name || null;
  const cast = (data.credits?.cast || []).slice(0, 4).map((c) => c.name);

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  return res.status(200).json({
    id: data.id,
    title: data.title,
    runtime: data.runtime,
    director,
    cast,
    trailerKey: trailer?.key || null,
    trailerSite: trailer?.site || null,
    watchProviders,
  });
}
