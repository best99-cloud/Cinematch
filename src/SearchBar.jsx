import { useState, useCallback } from "react";

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("movie"); // "movie" (title/quote keywords) | "person" (actor/director)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ query: trimmed, type: searchType });
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onResults({
        query: trimmed,
        type: searchType,
        personName: data.personName || null,
        results: data.results || [],
      });
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, searchType, onResults]);

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <button
          onClick={() => setSearchType("movie")}
          style={{
            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: searchType === "movie" ? "rgba(229,9,20,0.2)" : "rgba(255,255,255,0.05)",
            border: searchType === "movie" ? "1px solid rgba(229,9,20,0.5)" : "1px solid rgba(255,255,255,0.1)",
            color: searchType === "movie" ? "#fff" : "rgba(255,255,255,0.5)",
          }}
        >
          🎬 Title / Quote
        </button>
        <button
          onClick={() => setSearchType("person")}
          style={{
            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: searchType === "person" ? "rgba(229,9,20,0.2)" : "rgba(255,255,255,0.05)",
            border: searchType === "person" ? "1px solid rgba(229,9,20,0.5)" : "1px solid rgba(255,255,255,0.1)",
            color: searchType === "person" ? "#fff" : "rgba(255,255,255,0.5)",
          }}
        >
          🎭 Actor / Director
        </button>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
          placeholder={searchType === "person" ? "e.g. Christopher Nolan" : "e.g. Inception, or a line you remember"}
          style={{
            flex: 1, padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "14px", outline: "none",
          }}
        />
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: "12px 18px", borderRadius: "10px", border: "none", cursor: loading ? "default" : "pointer",
            background: query.trim() ? "linear-gradient(135deg, #E50914, #ff2d20)" : "rgba(255,255,255,0.08)",
            color: query.trim() ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "14px",
          }}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#f3b04a" }}>⚠️ {error}</div>
      )}
    </div>
  );
}
