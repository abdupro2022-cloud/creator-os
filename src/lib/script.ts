/**
 * Deterministic text/script metrics shared by the backend tools and the UI, so
 * a word count shown in the browser is always the same number the backend
 * computed. Nothing here is an estimate invented by a model.
 */

export const WORDS_PER_MINUTE = {
  slow: 130,
  medium: 150,
  fast: 175,
} as const;

export type PacingKey = keyof typeof WORDS_PER_MINUTE;

export function wordsPerMinute(pacing: string | undefined): number {
  if (pacing === "slow" || pacing === "fast") return WORDS_PER_MINUTE[pacing];
  return WORDS_PER_MINUTE.medium;
}

/** Whitespace-delimited count — correct for Latin and Arabic scripts alike. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed
    .split(/[.!?؟。]+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function countParagraphs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
}

export function estimateSeconds(words: number, wpm: number = WORDS_PER_MINUTE.medium): number {
  if (words <= 0) return 0;
  return Math.round((words / wpm) * 60);
}

/** Active UI language, read from <html lang> so both helpers stay in sync. */
function activeLang(): string {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const ar = activeLang() === "ar";
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return ar
      ? `${hours} س ${mins % 60} د`
      : `${hours}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const lang = activeLang();
  const ar = lang === "ar";
  if (diff < minute) return ar ? "الآن" : "just now";
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return ar ? `قبل ${n} د` : `${n}m ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return ar ? `قبل ${n} س` : `${n}h ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return ar ? `قبل ${n} ي` : `${n}d ago`;
  }
  return new Date(timestamp).toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Models sometimes wrap JSON in code fences; strip them before parsing. */
export function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export const SECTION_ROLE_ORDER = [
  "hook",
  "intro",
  "body",
  "cta",
  "outro",
] as const;

export type ScriptSectionRole = (typeof SECTION_ROLE_ORDER)[number];

export function sectionRoleLabel(role: string): string {
  switch (role) {
    case "hook":
      return "Hook";
    case "intro":
      return "Intro";
    case "body":
      return "Body";
    case "cta":
      return "Call to action";
    case "outro":
      return "Outro";
    default:
      return role;
  }
}

/** Pacing keys shown as pills on the style profile and dashboard. */
export function pacingLabel(pacing: string): string {
  switch (pacing) {
    case "slow":
      return "slow";
    case "fast":
      return "fast";
    default:
      return "medium";
  }
}
