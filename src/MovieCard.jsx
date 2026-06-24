import { useState, useCallback } from "react";
import { POSTER_ART, DEFAULT_POSTER, INDUSTRIES } from "./constants.js";

function moodMatchColor(match) {
  if (match === "Perfect Match") return "#F5C518";
  if (match === "Great Pick") return "#4CAF50";
  return "#9B59B6";
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

export default function MovieCard({ movie, index, isExpanded, onToggle, onSelectRecommendation }) {
  const [details, setDetails] = useState(null); // trailer, providers, director, cast
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);

  const primaryGenre = movie.genre?.[0];
  const poster = POSTER_ART[primaryGenre] || DEFAULT_POSTER;

  const loadDetails = useCallback(async () => {
    if (!movie.tmdbId || details || detailsLoading) return;
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const res = await fetch(`/api/movie-details?movieId=${movie.tmdbId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDetails(data);
    } catch (err) {
      setDetailsError(err.message || "Couldn't load extra details");
    } finally {
      setDetailsLoading(false);
    }
  }, [movie.tmdbId, details, detailsLoading]);

  const loadRecommendations = useCallback(async () => {
    if (!movie.tmdbId || recommendations) return;
    try {
      const res = await fetch(`/api/recommendations?movieId=${movie.tmdbId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecommendations((data.results || []).slice(0, 6));
    } catch {
      // Recommendations are a nice-to-have; fail silently rather than showing an error for this sub-feature.
    }
  }, [movie.tmdbId, recommendations]);

  const handleToggle = () => {
    onToggle(isExpanded ? null : index);
    if (!isExpanded) {
      loadDetails();
      loadRecommendations();
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px",
      overflow: "hidden",
    }}>
      <div onClick={handleToggle} style={{ padding: "16px", cursor: "pointer", display: "flex", gap: "14px" }}>
        <div style={{
          width: "64px", height: "96px", borderRadius: "10px", flexShrink: 0,
          background: movie.posterUrl ? "#111" : poster.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          position: "relative", overflow: "hidden",
        }}>
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <>
              {poster.icon}
              <div style={{ position: "absolute", bottom: "4px", left: "4px", right: "4px", fontSize: "8px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textAlign: "center", textTransform: "uppercase" }}>
                {movie.year}
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{movie.title}</div>
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "6px",
              background: moodMatchColor(movie.moodMatch) + "25", color: moodMatchColor(movie.moodMatch),
              border: `1px solid ${moodMatchColor(movie.moodMatch)}50`, whiteSpace: "nowrap",
            }}>
              {movie.moodMatch}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "5px", flexWrap: "wrap" }}>
            {movie.rating != null && <span style={{ color: "#F5C518", fontSize: "12px", fontWeight: 600 }}>⭐ {movie.rating}</span>}
            {movie.year && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{movie.year}</span>}
            {movie.language && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>🗣 {movie.language}</span>}
          </div>
          <div style={{ marginTop: "8px", color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: 1.45 }}>
            {movie.synopsis}
          </div>
        </div>

        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", flexShrink: 0, alignSelf: "flex-start" }}>
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>

      {isExpanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "18px", background: "rgba(0,0,0,0.2)" }}>
          {detailsLoading && (
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "12px" }}>
              Loading trailer & streaming info...
            </div>
          )}

          {detailsError && (
            <div style={{ fontSize: "12px", color: "#f3b04a", marginBottom: "12px" }}>
              ⚠️ {detailsError}
            </div>
          )}

          {details?.director && <InfoRow label="Director" value={details.director} />}
          {details?.cast?.length > 0 && <InfoRow label="Cast" value={details.cast.join(", ")} />}
          {details?.runtime && <InfoRow label="Runtime" value={`${details.runtime} min`} />}

          {/* Trailer */}
          {details?.trailerKey && (
            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", marginBottom: "8px" }}>
                TRAILER
              </div>
              {showTrailer ? (
                <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: "10px", overflow: "hidden" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1`}
                    title={`${movie.title} trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTrailer(true); }}
                  style={{
                    width: "100%", padding: "12px", background: "rgba(229,9,20,0.15)",
                    border: "1px solid rgba(229,9,20,0.4)", borderRadius: "10px", color: "#ff6b6b",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  ▶ Play Trailer
                </button>
              )}
            </div>
          )}

          {/* Watch providers — real logos + clickable links */}
          <div style={{ marginTop: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", marginBottom: "8px" }}>
              WHERE TO WATCH
            </div>
            {details?.watchProviders && (details.watchProviders.flatrate.length > 0 || details.watchProviders.rent.length > 0 || details.watchProviders.buy.length > 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {details.watchProviders.flatrate.length > 0 && (
                  <ProviderRow label="Stream" providers={details.watchProviders.flatrate} />
                )}
                {details.watchProviders.rent.length > 0 && (
                  <ProviderRow label="Rent" providers={details.watchProviders.rent} />
                )}
                {details.watchProviders.buy.length > 0 && (
                  <ProviderRow label="Buy" providers={details.watchProviders.buy} />
                )}
              </div>
            ) : (
              !detailsLoading && (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                  No streaming info found for this title in your region.
                </div>
              )
            )}
            <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)", marginTop: "8px", lineHeight: 1.5 }}>
              ℹ️ Availability via TMDB, region defaults to US — confirm on the platform before watching. Not endorsed or certified by TMDB.
            </div>
          </div>

          {/* Because you watched this... */}
          {recommendations && recommendations.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", marginBottom: "8px" }}>
                BECAUSE YOU LIKED {movie.title.toUpperCase()}
              </div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                {recommendations.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={(e) => { e.stopPropagation(); onSelectRecommendation?.(rec); }}
                    style={{
                      flexShrink: 0, width: "72px", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: "72px", height: "104px", borderRadius: "8px", overflow: "hidden",
                      background: "#1a1a1a", marginBottom: "4px",
                    }}>
                      {rec.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w154${rec.poster_path}`}
                          alt={rec.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🎬</div>
                      )}
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>
                      {rec.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderRow({ label, providers }) {
  return (
    <div>
      <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>{label}</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {providers.map((p) => (
          <a
            key={p.id}
            href={p.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px",
              borderRadius: "20px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none",
              color: "rgba(255,255,255,0.8)", fontSize: "11.5px", fontWeight: 600,
            }}
          >
            {p.logo ? (
              <img src={p.logo} alt={p.name} style={{ width: "16px", height: "16px", borderRadius: "4px" }} />
            ) : null}
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
