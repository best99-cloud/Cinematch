// Rule-based (no AI/LLM) parser for free-text movie descriptions.
//
// This is NOT real natural-language understanding — it's keyword and pattern
// matching. It handles genre words, year constraints, a few plot keywords,
// industry/"wood" names, and "like X" similarity requests reasonably well.
// It deliberately does NOT attempt subjective/qualitative modifiers like
// "happy ending" or "but more emotional than X" — those get surfaced back
// to the caller as `unhandled` notes so the UI can be honest about what
// was ignored, rather than silently pretending to understand everything.

import { TMDB_GENRE_IDS, TMDB_INDUSTRY_FILTERS } from "./tmdb.js";

const GENRE_KEYWORDS = {
  scary: "horror", horror: "horror", terrifying: "horror", frightening: "horror",
  haunted: "horror", supernatural: "horror",
  funny: "comedy", comedy: "comedy", hilarious: "comedy", comedic: "comedy",
  romantic: "romance", romance: "romance",
  action: "action", explosive: "action", "action-packed": "action",
  thriller: "thriller", suspenseful: "thriller", suspense: "thriller",
  "sci-fi": "sci-fi", "science fiction": "sci-fi", futuristic: "sci-fi",
  animated: "animation", cartoon: "animation", anime: "animation",
  fantasy: "fantasy", magical: "fantasy", magic: "fantasy",
  crime: "crime", heist: "crime", gangster: "crime", mafia: "crime",
  emotional: "drama", touching: "drama", drama: "drama", dramatic: "drama",
  musical: "musical", documentary: "documentary",
};

// Plot/topic keywords mapped to TMDB keyword search terms (sent as a
// free-text "query" fragment, not a structured TMDB filter — TMDB doesn't
// have a clean "topics" filter on /discover, so these get folded into a
// keyword search pass instead).
const TOPIC_KEYWORDS = [
  "ghost", "ghosts", "vampire", "vampires", "zombie", "zombies", "alien", "aliens",
  "robot", "robots", "time travel", "heist", "wedding", "haunted house",
  "serial killer", "monster", "monsters", "witch", "witches", "demon", "demons",
  "superhero", "spy", "war", "pandemic", "apocalypse", "kidnapping",
];

const INDUSTRY_KEYWORDS = {
  hollywood: "hollywood", bollywood: "bollywood", nollywood: "nollywood",
  tollywood: "tollywood", kollywood: "kollywood", jollywood: "jollywood",
  french: "french", korean: "korean", chinese: "chinese", japanese: "japanese",
};

// Phrases we recognize but have no real data source for — we still detect
// them so the UI can tell the person "this part was ignored" rather than
// silently dropping it with no explanation.
const UNHANDLED_PATTERNS = [
  { pattern: /happy ending/i, note: "\"happy ending\" — no data source for this exists" },
  { pattern: /sad ending/i, note: "\"sad ending\" — no data source for this exists" },
  { pattern: /\bbut more (\w+)/i, note: (m) => `"but more ${m[1]}" — can't adjust similar-movie results by tone` },
  { pattern: /\bbut less (\w+)/i, note: (m) => `"but less ${m[1]}" — can't adjust similar-movie results by tone` },
  { pattern: /not too (\w+)/i, note: (m) => `"not too ${m[1]}" — can't filter by subjective intensity` },
];

export function parseMovieQuery(text) {
  const lower = text.toLowerCase();

  const result = {
    genres: [],
    topicKeywords: [],
    industry: null,
    yearMin: null,
    yearMax: null,
    similarToTitle: null,
    unhandled: [],
    originalQuery: text,
  };

  for (const [word, genre] of Object.entries(GENRE_KEYWORDS)) {
    if (lower.includes(word) && !result.genres.includes(genre)) {
      result.genres.push(genre);
    }
  }

  for (const term of TOPIC_KEYWORDS) {
    if (lower.includes(term)) {
      // Avoid adding both "ghost" and "ghosts" — keep whichever is already
      // present, otherwise add the plain singular/plural form found.
      const alreadyHasVariant = result.topicKeywords.some(
        (existing) => existing.startsWith(term) || term.startsWith(existing)
      );
      if (!alreadyHasVariant) result.topicKeywords.push(term);
    }
  }

  for (const [word, industry] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (lower.includes(word)) {
      result.industry = industry;
      break;
    }
  }

  const notOlderThan = lower.match(/not older than (\d{4})/);
  if (notOlderThan) result.yearMin = parseInt(notOlderThan[1], 10);

  const fromYear = lower.match(/from (\d{4})/);
  if (fromYear) result.yearMin = parseInt(fromYear[1], 10);

  const afterYear = lower.match(/after (\d{4})/);
  if (afterYear) result.yearMin = parseInt(afterYear[1], 10);

  const beforeYear = lower.match(/before (\d{4})/);
  if (beforeYear) result.yearMax = parseInt(beforeYear[1], 10);

  const notNewerThan = lower.match(/not newer than (\d{4})/);
  if (notNewerThan) result.yearMax = parseInt(notNewerThan[1], 10);

  // "like X" / "similar to X" — capture the title up to a clause boundary
  const likeMatch = lower.match(/(?:like|similar to)\s+([a-z0-9\s:'-]+?)(?:\s+but\b|\s+and\b|[.,]|$)/i);
  if (likeMatch) {
    result.similarToTitle = likeMatch[1].trim();
  }

  for (const { pattern, note } of UNHANDLED_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      result.unhandled.push(typeof note === "function" ? note(m) : note);
    }
  }

  return result;
}

export function genresToTmdbIds(genres) {
  return genres.map((g) => TMDB_GENRE_IDS[g]).filter(Boolean);
}

export function industryToFilter(industry) {
  return TMDB_INDUSTRY_FILTERS[industry] || null;
}
