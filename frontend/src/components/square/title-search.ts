import { FINANCE_TITLE_GROUPS } from "./finance-titles";

const TITLE_SUGGESTIONS = 12;

/** Higher scores sort first. Zero means the title is not a match. */
export function titleScore(title: string, query: string): number {
  const hay = title.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  if (hay === needle) return 1000;
  if (hay.startsWith(needle)) return 900 - hay.length / 1000;
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  const wordIndex = words.findIndex((word) => word.startsWith(needle));
  if (wordIndex >= 0) return 800 - wordIndex * 20 - hay.length / 1000;
  const at = hay.indexOf(needle);
  if (at >= 0) return 600 - at - hay.length / 1000;
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => words.some((word) => word.startsWith(token)) || hay.includes(token))) {
    return 500 - hay.length / 1000;
  }
  return 0;
}

export function suggestedTitles(query: string) {
  return FINANCE_TITLE_GROUPS.flatMap((group) => group.titles.map((title) => ({ title, score: titleScore(title, query) })))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, TITLE_SUGGESTIONS);
}
