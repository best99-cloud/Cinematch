// /api/smart-search?query=... — free-text movie description search.
//
// Parses the text with rule-based matching (see queryParser.js — NOT a real
// AI/LLM call), converts whatever it understood into TMDB filters, and
// returns results plus a transparency report of what was understood vs.
// ignored, so the UI can be honest with the person about both.

import { setCors, requireApiKey, fetchTmdb } from "./tmdb.js";
import { parseMovieQuery, genresToTmdbIds, industryToFilter } from "./queryParser.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const { query } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  const parsed = parseMovieQuery(query);

  let results = [];
  let resolvedSimilarTitle = null;

  if (parsed.similarToTitle) {
    // Step 1: find the reference movie by title
    const searchParams = new URLSearchParams({
      api_key: apiKey,
      language: "en-US",
      query: parsed.similarToTitle,
      page: "1",
      include_adult: "false",
    });
    const searchData = await fetchTmdb("/search/movie", searchParams, res);
    if (!searchData) return; // fetchTmdb already sent the error response

    const referenceMovie = searchData.results?.[0];
    if (referenceMovie) {
      resolvedSimilarTitle = referenceMovie.title;
      const recParams = new URLSearchParams({ api_key: apiKey, language: "en-US", page: "1" });
      const recData = await fetchTmdb(`/movie/${referenceMovie.id}/recommendations`, recParams, res);
      if (!recData) return;
      results = recData.results || [];

      // Apply genre filter client-side on top of recommendations, if any was also detected
      if (parsed.genres.length > 0) {
        const genreIds = genresToTmdbIds(parsed.genres);
        results = results.filter((m) => m.genre_ids?.some((id) => genreIds.includes(id)));
      }
    } else {
      parsed.unhandled.push(`couldn't find a movie titled "${parsed.similarToTitle}"`);
    }
  } else {
    // No "similar to" reference — build a /discover query from whatever we parsed.
    const discoverParams = new URLSearchParams({
      api_key: apiKey,
      language: "en-US",
      sort_by: "popularity.desc",
      page: "1",
      include_adult: "false",
    });

    const genreIds = genresToTmdbIds(parsed.genres);
    if (genreIds.length > 0) discoverParams.set("with_genres", genreIds.join(","));

    const industryFilter = industryToFilter(parsed.industry);
    if (industryFilter) {
      discoverParams.set("with_origin_country", industryFilter.with_origin_country);
      discoverParams.set("with_original_language", industryFilter.with_original_language);
    }

    if (parsed.yearMin) discoverParams.set("primary_release_date.gte", `${parsed.yearMin}-01-01`);
    if (parsed.yearMax) discoverParams.set("primary_release_date.lte", `${parsed.yearMax}-12-31`);

    // If we have topic keywords but nothing else specific, fall back to a
    // plain title/keyword search instead of discover (discover has no good
    // free-text field; search/movie does).
    const hasStructuredFilters = genreIds.length > 0 || industryFilter || parsed.yearMin || parsed.yearMax;

    if (!hasStructuredFilters && parsed.topicKeywords.length > 0) {
      const kwParams = new URLSearchParams({
        api_key: apiKey,
        language: "en-US",
        query: parsed.topicKeywords.join(" "),
        page: "1",
        include_adult: "false",
      });
      const kwData = await fetchTmdb("/search/movie", kwParams, res);
      if (!kwData) return;
      results = kwData.results || [];
    } else if (hasStructuredFilters) {
      const discoverData = await fetchTmdb("/discover/movie", discoverParams, res);
      if (!discoverData) return;
      results = discoverData.results || [];

      // If we also picked up topic keywords, narrow the discover results by
      // title/overview containing those words (discover can't do this natively).
      if (parsed.topicKeywords.length > 0) {
        const narrowed = results.filter((m) =>
          parsed.topicKeywords.some(
            (kw) => m.title?.toLowerCase().includes(kw) || m.overview?.toLowerCase().includes(kw)
          )
        );
        // Only apply the narrowing if it doesn't wipe out every result —
        // overview text matching is imprecise, so an empty result here more
        // likely means the keyword just isn't in the overview text, not that
        // there are truly no matches.
        if (narrowed.length > 0) results = narrowed;
      }
    } else {
      parsed.unhandled.push("couldn't extract any specific genre, industry, year, or topic from this query");
    }
  }

  // Return results in their original TMDB shape (not pre-mapped) so the
  // frontend can run them through the same mapTmdbResults() function used
  // by every other search/discover path, instead of needing special-case
  // handling for this one endpoint.
  const trimmedResults = results.slice(0, 20);

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  return res.status(200).json({
    results: trimmedResults,
    understood: {
      genres: parsed.genres,
      topics: parsed.topicKeywords,
      industry: parsed.industry,
      yearMin: parsed.yearMin,
      yearMax: parsed.yearMax,
      similarTo: resolvedSimilarTitle,
    },
    unhandled: parsed.unhandled,
  });
}
