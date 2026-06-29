import { useState, useCallback } from "react";

import {
  FALLBACK_MOVIE_DB, INDUSTRIES, GENRES, MOODS, ALL_GENRE_WARNINGS,
} from "./constants.js";
import MovieCard from "./MovieCard.jsx";
import TrendingRow from "./TrendingRow.jsx";
import AdBanner from "./AdBanner.jsx";
import SearchBar from "./SearchBar.jsx";

export default function MovieSuggester() {
  const [step, setStep] = useState("select"); // select | warning | loading | results
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);
  const [expandedMovie, setExpandedMovie] = useState(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState(null);

  // Pagination / infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenTmdbIds, setSeenTmdbIds] = useState(() => new Set());

  // Search results (separate from the genre/mood/industry flow)
  const [searchResult, setSearchResult] = useState(null);

  const toggleGenre = (id) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const canSuggest = selectedIndustry && selectedGenres.length > 0 && selectedMood;

  // Severity order — pick the highest-rated selected genre for the warning screen
  const severityOrder = ["horror", "romance", "crime", "thriller", "action", "drama", "sci-fi", "fantasy", "musical", "documentary", "animation", "comedy"];
  const activeWarningGenre = severityOrder.find((g) => selectedGenres.includes(g));
  const warningConfig = activeWarningGenre ? ALL_GENRE_WARNINGS[activeWarningGenre] : null;

  const handleGetSuggestions = () => {
    if (!canSuggest) return;
    if (warningConfig && !ageConfirmed) {
      setStep("warning");
    } else {
      fetchMovies();
    }
  };

  // Fallback: filters the small local dataset (used only if the TMDB API call itself fails — network/auth/server error)
  const fetchFromLocalFallback = useCallback((reason) => {
    const byIndustry = FALLBACK_MOVIE_DB.filter((m) => m.industry === selectedIndustry);
    let results = byIndustry.filter(
      (m) => m.genre.some((g) => selectedGenres.includes(g)) && m.mood.includes(selectedMood)
    );
    let fallbackNote = reason
      ? `Live data unavailable (${reason}) — showing offline results instead.`
      : "Showing offline results — live data was unavailable.";

    if (results.length === 0) {
      results = byIndustry.filter((m) => m.genre.some((g) => selectedGenres.includes(g)));
    }
    if (results.length === 0) {
      results = byIndustry;
    }
    if (results.length === 0) {
      results = FALLBACK_MOVIE_DB.filter((m) => m.genre.some((g) => selectedGenres.includes(g)));
    }

    const finalResults = [...results].sort(() => Math.random() - 0.5).map((m) => ({
      ...m,
      posterUrl: null, // no TMDB poster available offline
    }));

    setMovies(finalResults);
    setFallbackMessage(fallbackNote);
    setHasMorePages(false);
    setStep("results");
  }, [selectedIndustry, selectedGenres, selectedMood]);

  const mapTmdbResults = useCallback((rawResults) => {
    const industryLabel = INDUSTRIES.find((i) => i.id === selectedIndustry)?.label;
    return rawResults.map((m) => {
      const ratingOutOf10 = m.vote_average ? Math.round(m.vote_average * 10) / 10 : null;
      let moodMatch = "Great Pick";
      if (ratingOutOf10 >= 7.5) moodMatch = "Perfect Match";
      else if (ratingOutOf10 && ratingOutOf10 < 6) moodMatch = "Hidden Gem";

      return {
        title: m.title || m.original_title || "Untitled",
        year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
        director: null,
        rating: ratingOutOf10,
        duration: null,
        synopsis: m.overview || "No synopsis available.",
        whyWatch: null,
        cast: [],
        language: m.original_language ? m.original_language.toUpperCase() : industryLabel,
        industry: selectedIndustry,
        genre: selectedGenres,
        moodMatch,
        posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        tmdbId: m.id,
      };
    });
  }, [selectedIndustry, selectedGenres]);

  const fetchMovies = useCallback(async () => {
    setStep("loading");
    setError(null);
    setSearchResult(null);
    setCurrentPage(1);
    setHasMorePages(true);

    if (selectedGenres.length === 0) {
      fetchFromLocalFallback("no genres selected");
      return;
    }

    try {
      const params = new URLSearchParams({
        industry: selectedIndustry,
        genres: selectedGenres.join(","),
        page: "1",
      });

      let response;
      try {
        response = await fetch(`/api/movies?${params.toString()}`);
      } catch (networkErr) {
        throw new Error(`network: ${networkErr.message}`);
      }

      if (!response.ok) {
        let bodyText = "";
        try { bodyText = await response.text(); } catch {}
        throw new Error(`HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 150)}` : ""}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`bad JSON: ${jsonErr.message}`);
      }

      if (data.status_code) {
        throw new Error(`TMDB error ${data.status_code}: ${data.status_message || "unknown"}`);
      }

      const rawResults = Array.isArray(data.results) ? data.results : [];
      const newIds = new Set(rawResults.map((m) => m.id));
      setSeenTmdbIds(newIds);

      const mapped = mapTmdbResults(rawResults);
      mapped.sort((a, b) => {
        if (!!a.posterUrl !== !!b.posterUrl) return a.posterUrl ? -1 : 1;
        return (b.rating || 0) - (a.rating || 0);
      });

      setMovies(mapped);
      setFallbackMessage(null);
      setHasMorePages((data.page || 1) < (data.total_pages || 1));
      setStep("results");
      // Note: zero live results is shown as a clear empty state on the results
      // screen rather than silently substituting offline data — the person
      // asked to see exactly what's live, including when that's "nothing."
    } catch (err) {
      console.error("TMDB fetch error:", err);
      // Genuine failures (network down, key invalid, TMDB outage) still fall
      // back to offline data so the app doesn't just break.
      fetchFromLocalFallback(err.message || "unknown error");
    }
  }, [selectedIndustry, selectedGenres, selectedMood, fetchFromLocalFallback, mapTmdbResults]);

  const loadMoreMovies = useCallback(async () => {
    if (loadingMore || !hasMorePages || fallbackMessage) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const params = new URLSearchParams({
        industry: selectedIndustry,
        genres: selectedGenres.join(","),
        page: String(nextPage),
      });
      const response = await fetch(`/api/movies?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const rawResults = Array.isArray(data.results) ? data.results : [];
      const fresh = rawResults.filter((m) => !seenTmdbIds.has(m.id));
      const updatedSeen = new Set(seenTmdbIds);
      fresh.forEach((m) => updatedSeen.add(m.id));
      setSeenTmdbIds(updatedSeen);

      const mapped = mapTmdbResults(fresh);
      setMovies((prev) => [...prev, ...mapped]);
      setCurrentPage(nextPage);
      setHasMorePages(nextPage < (data.total_pages || 1));
    } catch (err) {
      console.error("Load more error:", err);
      setHasMorePages(false);
    } finally {
      setLoadingMore(false);
    }
  }, [currentPage, hasMorePages, loadingMore, fallbackMessage, selectedIndustry, selectedGenres, seenTmdbIds, mapTmdbResults]);

  // Clicking a "Because you watched..." or trending poster jumps straight to a single-movie result view
  const handleSelectRelatedMovie = useCallback((tmdbMovie) => {
    const mapped = mapTmdbResults([tmdbMovie]);
    setMovies(mapped);
    setSeenTmdbIds(new Set([tmdbMovie.id]));
    setFallbackMessage(null);
    setHasMorePages(false);
    setExpandedMovie(0);
    setSearchResult(null);
    setStep("results");
  }, [mapTmdbResults]);

  const handleSearchResults = useCallback((result) => {
    setSearchResult(result);
    setFallbackMessage(null);
    setHasMorePages(false);
    setExpandedMovie(null);
    setMovies(mapTmdbResults(result.results));
    setStep("results");
  }, [mapTmdbResults]);


  const reset = () => {
    setStep("select");
    setSelectedIndustry(null);
    setSelectedGenres([]);
    setSelectedMood(null);
    setMovies([]);
    setExpandedMovie(null);
    setAgeConfirmed(false);
    setFallbackMessage(null);
    setCurrentPage(1);
    setHasMorePages(true);
    setSeenTmdbIds(new Set());
    setSearchResult(null);
  };

  const moodMatchColor = (match) => {
    if (match === "Perfect Match") return "#F5C518";
    if (match === "Great Pick") return "#4CAF50";
    return "#9B59B6";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #13131f 50%, #0d0d1a 100%)",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e8e8f0",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ fontSize: "28px" }}>🎬</div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
            CineMatch
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.5px" }}>
            AI-POWERED MOVIE DISCOVERY
          </div>
        </div>
        {step === "results" && (
          <button onClick={reset} style={{
            marginLeft: "auto",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#e8e8f0",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}>
            ← Start Over
          </button>
        )}
      </div>

      {/* SELECTION SCREEN */}
      {step === "select" && (
        <div style={{ maxWidth: "680px", margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ fontSize: "36px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "10px" }}>
              Find your next<br />
              <span style={{
                background: "linear-gradient(90deg, #E50914, #ff6b35)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>favourite film</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "15px" }}>
              Pick your cinema world, genre & mood — AI picks the movie.
            </div>
          </div>

          <SearchBar onResults={handleSearchResults} />

          <TrendingRow onSelect={handleSelectRelatedMovie} />

          <AdBanner variant="native" />

          {/* Industry */}
          <Section label="🌍 Choose your Cinema World" sublabel="Select one">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {INDUSTRIES.map((ind) => (
                <button key={ind.id} onClick={() => setSelectedIndustry(ind.id)} style={{
                  background: selectedIndustry === ind.id
                    ? "linear-gradient(135deg, rgba(229,9,20,0.25), rgba(229,9,20,0.1))"
                    : "rgba(255,255,255,0.04)",
                  border: selectedIndustry === ind.id
                    ? "1.5px solid rgba(229,9,20,0.6)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "24px" }}>{ind.flag}</span>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: "14px" }}>{ind.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{ind.desc}</div>
                  </div>
                  {selectedIndustry === ind.id && (
                    <span style={{ marginLeft: "auto", color: "#E50914", fontSize: "16px" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </Section>

          {/* Genre */}
          <Section label="🎭 Pick your Genre(s)" sublabel="Up to 3">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {GENRES.map((g) => {
                const active = selectedGenres.includes(g.id);
                const disabled = !active && selectedGenres.length >= 3;
                const intenseConfig = ALL_GENRE_WARNINGS[g.id];
                return (
                  <button key={g.id} onClick={() => !disabled && toggleGenre(g.id)} style={{
                    background: active ? "linear-gradient(135deg, rgba(229,9,20,0.25), rgba(229,9,20,0.08))" : "rgba(255,255,255,0.04)",
                    border: active ? "1.5px solid rgba(229,9,20,0.6)" : "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "12px 8px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.4 : 1,
                    textAlign: "center",
                    transition: "all 0.18s",
                    position: "relative",
                  }}>
                    {intenseConfig && (
                      <div style={{
                        position: "absolute", top: "5px", right: "5px",
                        fontSize: "8px", fontWeight: 800,
                        background: intenseConfig.bgColor,
                        color: intenseConfig.color,
                        border: `1px solid ${intenseConfig.borderColor}`,
                        borderRadius: "4px",
                        padding: "1px 4px",
                        letterSpacing: "0.3px",
                        lineHeight: "14px",
                      }}>
                        {intenseConfig.rating}
                      </div>
                    )}
                    <div style={{ fontSize: "22px", marginBottom: "4px" }}>{g.icon}</div>
                    <div style={{ color: active ? "#fff" : "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 500 }}>
                      {g.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Inline advisory — shown for all genres */}
          {warningConfig && selectedGenres.length > 0 && (
            <div style={{
              marginTop: "-16px",
              marginBottom: "24px",
              background: warningConfig.bgColor,
              border: `1px solid ${warningConfig.borderColor}`,
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <span style={{ fontSize: "12px", color: warningConfig.color, fontWeight: 600 }}>
                Content advisory required for {warningConfig.label} ({warningConfig.rating}). You'll be prompted before results load.
              </span>
            </div>
          )}

          {/* Mood */}
          <Section label="🌡️ What's your mood?" sublabel="Select one">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
              {MOODS.map((m) => (
                <button key={m.id} onClick={() => setSelectedMood(m.id)} style={{
                  background: selectedMood === m.id
                    ? "linear-gradient(135deg, rgba(229,9,20,0.25), rgba(229,9,20,0.08))"
                    : "rgba(255,255,255,0.04)",
                  border: selectedMood === m.id
                    ? "1.5px solid rgba(229,9,20,0.6)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.18s",
                }}>
                  <span style={{ fontSize: "20px" }}>{m.icon}</span>
                  <span style={{ color: selectedMood === m.id ? "#fff" : "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 500 }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* CTA */}
          <button
            onClick={handleGetSuggestions}
            disabled={!canSuggest}
            style={{
              width: "100%",
              padding: "18px",
              background: canSuggest
                ? "linear-gradient(135deg, #E50914, #ff2d20)"
                : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "14px",
              color: canSuggest ? "#fff" : "rgba(255,255,255,0.25)",
              fontSize: "16px",
              fontWeight: 700,
              cursor: canSuggest ? "pointer" : "not-allowed",
              letterSpacing: "0.3px",
              transition: "all 0.2s",
              marginTop: "8px",
              boxShadow: canSuggest ? "0 8px 30px rgba(229,9,20,0.35)" : "none",
            }}
          >
            {canSuggest ? "🎬  Get My Movie Suggestions" : "Complete your selections above"}
          </button>
          {error && (
            <div style={{
              marginTop: "12px",
              color: "#ff6b6b",
              textAlign: "left",
              fontSize: "12px",
              background: "rgba(255,107,107,0.08)",
              border: "1px solid rgba(255,107,107,0.25)",
              borderRadius: "10px",
              padding: "12px 14px",
              wordBreak: "break-word",
              fontFamily: "monospace",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* WARNING SCREEN */}
      {step === "warning" && warningConfig && (
        <div style={{ maxWidth: "480px", margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Warning badge */}
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: warningConfig.bgColor,
            border: `2px solid ${warningConfig.borderColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "36px", marginBottom: "20px",
            boxShadow: `0 0 40px ${warningConfig.color}30`,
          }}>
            ⚠️
          </div>

          {/* Rating badge */}
          <div style={{
            background: warningConfig.bgColor,
            border: `1.5px solid ${warningConfig.borderColor}`,
            borderRadius: "8px",
            padding: "4px 14px",
            fontSize: "13px",
            fontWeight: 800,
            color: warningConfig.color,
            letterSpacing: "1px",
            marginBottom: "16px",
          }}>
            RATED {warningConfig.rating} · {warningConfig.icon} {warningConfig.label.toUpperCase()}
          </div>

          <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: "10px" }}>
            Content Advisory
          </div>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.6, marginBottom: "28px" }}>
            {warningConfig.advisory}
          </div>

          {/* Warning list */}
          <div style={{
            width: "100%",
            background: warningConfig.bgColor,
            border: `1px solid ${warningConfig.borderColor}`,
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "28px",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: warningConfig.color, letterSpacing: "1px", marginBottom: "14px" }}>
              THIS CONTENT MAY INCLUDE
            </div>
            {warningConfig.warnings.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < warningConfig.warnings.length - 1 ? "10px" : 0 }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: warningConfig.color, flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{w}</span>
              </div>
            ))}
          </div>

          {/* Age confirmation */}
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "20px" }}>
            By continuing, you confirm you are of appropriate age and consent to viewing mature content.
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", width: "100%" }}>
            <button onClick={() => setStep("select")} style={{
              flex: 1,
              padding: "14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              color: "rgba(255,255,255,0.55)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}>
              ← Go Back
            </button>
            <button onClick={() => { setAgeConfirmed(true); fetchMovies(); }} style={{
              flex: 2,
              padding: "14px",
              background: `linear-gradient(135deg, ${warningConfig.color}, ${warningConfig.color}cc)`,
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 6px 24px ${warningConfig.color}40`,
            }}>
              I Understand — Show Movies
            </button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {step === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "20px" }}>
          <div style={{ fontSize: "56px", animation: "spin 2s linear infinite" }}>🎬</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>Curating your films...</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>Fetching live results...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* RESULTS */}
      {step === "results" && (
        <div style={{ maxWidth: "680px", margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#fff" }}>
              {searchResult ? "Search Results 🔎" : "Your Picks 🍿"}{" "}
              <span style={{ fontSize: "14px", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>
                ({movies.length} {movies.length === 1 ? "match" : "matches"})
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
              {searchResult ? (
                searchResult.type === "person" ? (
                  searchResult.personName
                    ? <>Movies with <strong style={{ color: "rgba(255,255,255,0.6)" }}>{searchResult.personName}</strong></>
                    : <>No person found matching "{searchResult.query}"</>
                ) : searchResult.type === "describe" ? (
                  <>You described: "{searchResult.query}"</>
                ) : (
                  <>Results for "{searchResult.query}"</>
                )
              ) : (
                <>
                  {INDUSTRIES.find((i) => i.id === selectedIndustry)?.label} •{" "}
                  {selectedGenres.map((g) => GENRES.find((x) => x.id === g)?.label).join(", ")} •{" "}
                  {MOODS.find((m) => m.id === selectedMood)?.label}
                </>
              )}
            </div>
          </div>

          {searchResult?.type === "describe" && (searchResult.understood || searchResult.unhandled?.length > 0) && (
            <div style={{
              marginBottom: "20px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "14px 16px",
              fontSize: "12px",
            }}>
              {searchResult.understood && (
                <div style={{ marginBottom: searchResult.unhandled?.length > 0 ? "10px" : 0 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>✅ Understood: </span>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>
                    {[
                      searchResult.understood.similarTo && `similar to "${searchResult.understood.similarTo}"`,
                      searchResult.understood.genres?.length > 0 && `genre(s): ${searchResult.understood.genres.join(", ")}`,
                      searchResult.understood.industry && `industry: ${searchResult.understood.industry}`,
                      searchResult.understood.topics?.length > 0 && `topics: ${searchResult.understood.topics.join(", ")}`,
                      searchResult.understood.yearMin && `from ${searchResult.understood.yearMin}`,
                      searchResult.understood.yearMax && `up to ${searchResult.understood.yearMax}`,
                    ].filter(Boolean).join(" • ") || "nothing specific — showing general results"}
                  </span>
                </div>
              )}
              {searchResult.unhandled?.length > 0 && (
                <div>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>⚠️ Ignored: </span>
                  <span style={{ color: "rgba(255,255,255,0.55)" }}>
                    {searchResult.unhandled.join("; ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {fallbackMessage && (
            <div style={{
              marginBottom: "20px",
              background: "rgba(243,156,18,0.1)",
              border: "1px solid rgba(243,156,18,0.35)",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "12.5px",
              color: "#f3b04a",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              fontFamily: "monospace",
            }}>
              <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
              <span>{fallbackMessage}</span>
            </div>
          )}

          {movies.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
                No results found
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>
                {searchResult?.type === "describe"
                  ? "Try rephrasing with a clearer genre, year, or movie title to compare against."
                  : searchResult
                  ? "Try a different name, title, or a few words from the scene you remember."
                  : "TMDB doesn't have live results for this exact industry + genre + mood combo right now. Try a different mood or fewer genres."}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {movies.map((movie, i) => (
              <div key={movie.tmdbId ?? `${movie.title}-${i}`}>
                <MovieCard
                  movie={movie}
                  index={i}
                  isExpanded={expandedMovie === i}
                  onToggle={setExpandedMovie}
                  onSelectRecommendation={handleSelectRelatedMovie}
                />
                {/* Ad placed after the 2nd result, but only if there are at
                    least 3 results — avoids showing an ad right above a
                    near-empty list, which would look out of place. */}
                {i === 1 && movies.length >= 3 && <AdBanner variant="banner" />}
              </div>
            ))}
          </div>

          {/* Infinite scroll: load more results from TMDB, only when results came from live data */}
          {!fallbackMessage && hasMorePages && (
            <button
              onClick={loadMoreMovies}
              disabled={loadingMore}
              style={{
                width: "100%", marginTop: "16px", padding: "14px", borderRadius: "12px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600,
                cursor: loadingMore ? "default" : "pointer",
              }}
            >
              {loadingMore ? "Loading more..." : "Load More Movies"}
            </button>
          )}

          <button onClick={reset} style={{
            width: "100%",
            marginTop: "24px",
            padding: "16px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "14px",
            color: "rgba(255,255,255,0.6)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}>
            🔄 Start a New Search
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ label, sublabel, children }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{label}</div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{sublabel}</div>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", width: "60px", flexShrink: 0, paddingTop: "2px" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>{value}</div>
    </div>
  );
}
