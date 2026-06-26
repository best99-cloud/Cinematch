import { useState, useEffect, useCallback } from "react";

export default function TrendingRow({ onSelect }) {
  const [trending, setTrending] = useState(null);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrending = useCallback(async (bustCache) => {
    try {
      // bustCache appends a changing query param so a manual refresh always
      // reaches the network instead of the browser silently reusing a
      // previous response object in memory.
      const url = bustCache ? `/api/trending?_=${Date.now()}` : "/api/trending";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrending((data.results || []).slice(0, 10));
      setFetchedAt(data.fetchedAt || null);
      setError(null);
    } catch (err) {
      setError(err.message || "Couldn't load trending");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTrending(false).catch(() => {});
    return () => { cancelled = true; };
  }, [loadTrending]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrending(true);
    setRefreshing(false);
  };

  if (error) return null; // Trending is a bonus widget — fail quietly rather than block the page
  if (!trending) {
    return (
      <div style={{ marginBottom: "28px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
        Loading trending movies...
      </div>
    );
  }
  if (trending.length === 0) return null;

  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>
          🔥 Trending Today
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: "none", border: "none", color: "#D4F500",
            fontSize: "11px", cursor: refreshing ? "default" : "pointer", padding: "4px 8px",
          }}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px" }}>
        {trending.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect?.(m)}
            style={{ flexShrink: 0, width: "92px", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
          >
            <div style={{ width: "92px", height: "132px", borderRadius: "10px", overflow: "hidden", background: "#1a1a1a", marginBottom: "6px", position: "relative" }}>
              {m.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w154${m.poster_path}`}
                  alt={m.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🎬</div>
              )}
              {m.vote_average > 0 && (
                <div style={{
                  position: "absolute", bottom: "4px", left: "4px", background: "rgba(0,0,0,0.7)",
                  borderRadius: "5px", padding: "1px 5px", fontSize: "10px", fontWeight: 700, color: "#F5C518",
                }}>
                  ⭐ {Math.round(m.vote_average * 10) / 10}
                </div>
              )}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>
              {m.title}
            </div>
          </button>
        ))}
      </div>
      {fetchedAt && (
        <div style={{ fontSize: "10px", color: "#D4F500", marginTop: "8px" }}>
          Last updated: {new Date(fetchedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
