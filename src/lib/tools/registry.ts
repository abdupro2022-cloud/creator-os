import { z } from "zod";
import {
  countParagraphs,
  countSentences,
  countWords,
  estimateSeconds,
  wordsPerMinute,
} from "../script";

/**
 * Centralized Tool Registry.
 *
 * Every tool is really implemented — nothing here is a stub. Tools are pure and
 * deterministic: they never call a network, they never invent facts, and they
 * declare the permission level the agent core must check before running them.
 *
 * Because the registry is a plain module it is importable by the Convex agent
 * core and by the browser (Settings shows the real registered inventory).
 */

export type ToolPermission =
  | "READ"
  | "LOW_RISK_WRITE"
  | "EXTERNAL_ACTION"
  | "DESTRUCTIVE";

/** Permission levels that must be confirmed by the creator before running. */
export const CONFIRMATION_REQUIRED: ToolPermission[] = [
  "EXTERNAL_ACTION",
  "DESTRUCTIVE",
];

export interface ToolResult<T = unknown> {
  toolId: string;
  ok: boolean;
  permission: ToolPermission;
  durationMs: number;
  data?: T;
  error?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  permission: ToolPermission;
  requiresConfirmation: boolean;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  run: (input: never) => Promise<unknown>;
}

export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  permission: ToolPermission;
  requiresConfirmation: boolean;
}

/* ------------------------------------------------------------------ */
/* 1. text.word_stats                                                  */
/* ------------------------------------------------------------------ */

const wordStatsInput = z.object({
  text: z.string(),
  pacing: z.enum(["slow", "medium", "fast"]).optional(),
});

const wordStatsOutput = z.object({
  words: z.number(),
  sentences: z.number(),
  paragraphs: z.number(),
  characters: z.number(),
  wordsPerMinute: z.number(),
  estSeconds: z.number(),
});

export type WordStats = z.infer<typeof wordStatsOutput>;

export function wordStats(input: z.infer<typeof wordStatsInput>): WordStats {
  const wpm = wordsPerMinute(input.pacing);
  const words = countWords(input.text);
  return {
    words,
    sentences: countSentences(input.text),
    paragraphs: countParagraphs(input.text),
    characters: input.text.length,
    wordsPerMinute: wpm,
    estSeconds: estimateSeconds(words, wpm),
  };
}

/* ------------------------------------------------------------------ */
/* 2. script.outline_validate                                          */
/* ------------------------------------------------------------------ */

export const outlineSectionSchema = z.object({
  role: z.enum(["hook", "intro", "body", "cta", "outro"]),
  heading: z.string(),
  intent: z.string().optional(),
  targetWords: z.number(),
});

export const outlineSchema = z.object({
  sections: z.array(outlineSectionSchema),
});

export type OutlineSection = z.infer<typeof outlineSectionSchema>;
export type Outline = z.infer<typeof outlineSchema>;

const outlineValidateInput = z.object({
  outline: outlineSchema,
  targetDurationSec: z.number().positive(),
  pacing: z.enum(["slow", "medium", "fast"]).optional(),
});

const outlineIssueSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  kind: z.string(),
  message: z.string(),
  sectionId: z.string().optional(),
});

const outlineValidateOutput = z.object({
  valid: z.boolean(),
  sections: z.array(outlineSectionSchema),
  issues: z.array(outlineIssueSchema),
  totalTargetWords: z.number(),
  budgetWords: z.number(),
  estSeconds: z.number(),
});

export type OutlineValidation = z.infer<typeof outlineValidateOutput>;

const MIN_SECTIONS = 3;
const MAX_SECTIONS = 12;
const MIN_SECTION_WORDS = 30;
const MAX_SECTION_WORDS = 500;

/**
 * Clamp a model-produced outline into something that can actually be narrated
 * inside the requested duration, and report what had to be fixed.
 */
export function validateOutline(
  input: z.infer<typeof outlineValidateInput>,
): OutlineValidation {
  const wpm = wordsPerMinute(input.pacing);
  const budgetWords = Math.max(60, Math.round((input.targetDurationSec / 60) * wpm));
  const issues: OutlineValidation["issues"] = [];

  let sections = input.outline.sections
    .filter((s) => s.heading.trim().length > 0 || s.intent)
    .map((s) => ({
      role: s.role,
      heading: s.heading.trim().slice(0, 160) || "Untitled section",
      intent: s.intent?.trim().slice(0, 400) || undefined,
      targetWords: Math.min(
        MAX_SECTION_WORDS,
        Math.max(MIN_SECTION_WORDS, Math.round(s.targetWords || MIN_SECTION_WORDS)),
      ),
    }));

  if (sections.length < MIN_SECTIONS) {
    issues.push({
      severity: "critical",
      kind: "too_few_sections",
      message: `The outline had ${sections.length} usable section(s); at least ${MIN_SECTIONS} are required. Add them in Script Studio before drafting.`,
    });
  }
  if (sections.length > MAX_SECTIONS) {
    issues.push({
      severity: "warning",
      kind: "too_many_sections",
      message: `Trimmed the outline to the first ${MAX_SECTIONS} sections.`,
    });
    sections = sections.slice(0, MAX_SECTIONS);
  }
  if (!sections.some((s) => s.role === "hook")) {
    issues.push({
      severity: "warning",
      kind: "missing_hook",
      message: "No hook section in the outline — the first body section will carry the opening.",
    });
  }
  const last = sections[sections.length - 1];
  if (last && last.role !== "cta" && last.role !== "outro") {
    issues.push({
      severity: "info",
      kind: "weak_close",
      message: "The outline does not end on a call to action or outro.",
    });
  }

  const rawTotal = sections.reduce((sum, s) => sum + s.targetWords, 0);
  if (rawTotal > 0 && budgetWords > 0) {
    const ratio = budgetWords / rawTotal;
    if (ratio < 0.65 || ratio > 1.35) {
      sections = sections.map((s) => ({
        ...s,
        targetWords: Math.min(
          MAX_SECTION_WORDS,
          Math.max(MIN_SECTION_WORDS, Math.round(s.targetWords * ratio)),
        ),
      }));
      issues.push({
        severity: "warning",
        kind: "rescaled_to_duration",
        message: `Rescaled section lengths to fit the ${Math.round(
          input.targetDurationSec / 60,
        )} minute target.`,
      });
    }
  }

  const totalTargetWords = sections.reduce((sum, s) => sum + s.targetWords, 0);
  return {
    valid: sections.length >= MIN_SECTIONS,
    sections,
    issues,
    totalTargetWords,
    budgetWords,
    estSeconds: estimateSeconds(totalTargetWords, wpm),
  };
}

/* ------------------------------------------------------------------ */
/* 3. script.qa_scan                                                   */
/* ------------------------------------------------------------------ */

const qaSectionSchema = z.object({
  id: z.string(),
  role: z.enum(["hook", "intro", "body", "cta", "outro"]),
  heading: z.string(),
  body: z.string(),
});

const qaScanInput = z.object({
  sections: z.array(qaSectionSchema),
  prohibited: z.array(z.string()).default([]),
  pacing: z.enum(["slow", "medium", "fast"]).optional(),
});

const qaScanOutput = z.object({
  totals: z.object({
    words: z.number(),
    sentences: z.number(),
    estSeconds: z.number(),
    wordsPerMinute: z.number(),
  }),
  sectionMetrics: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      role: z.string(),
      words: z.number(),
      estSeconds: z.number(),
    }),
  ),
  issues: z.array(outlineIssueSchema),
});

export type QaScan = z.infer<typeof qaScanOutput>;

const FILLER_OPENERS = [
  "in this video",
  "in today's video",
  "welcome back",
  "hey guys",
  "as we all know",
  "without further ado",
  "في هذا الفيديو",
  "في فيديو اليوم",
  "كما نعلم جميعا",
  "كما نعلم جميعاً",
  "بدون مزيد من التأخير",
];

/**
 * Phrases that assert evidence. When one of these appears without a real source
 * attached to the section, the creator is told to supply a source — the tool
 * never invents one.
 */
const CLAIM_MARKERS = [
  "studies show",
  "study shows",
  "research shows",
  "researchers found",
  "experts say",
  "scientists say",
  "statistics show",
  "data shows",
  "according to",
  "percent of",
  "% of",
  "أظهرت الدراسات",
  "تشير الدراسات",
  "وفقا ل",
  "وفقاً ل",
  "بحسب",
  "الإحصائيات",
  "الخبراء يقولون",
];

export function qaScan(input: z.infer<typeof qaScanInput>): QaScan {
  const wpm = wordsPerMinute(input.pacing);
  const issues: QaScan["issues"] = [];
  let totalWords = 0;
  let totalSentences = 0;

  const sectionMetrics = input.sections.map((section) => {
    const words = countWords(section.body);
    const sentences = countSentences(section.body);
    totalWords += words;
    totalSentences += sentences;
    const lower = section.body.toLowerCase();

    if (words === 0) {
      issues.push({
        severity: "critical",
        kind: "empty_section",
        message: `"${section.heading}" has no body text yet.`,
        sectionId: section.id,
      });
    }

    if (section.role === "hook" && words > 80) {
      issues.push({
        severity: "warning",
        kind: "long_hook",
        message: `The hook is ${words} words (${estimateSeconds(words, wpm)}s). Tighten it to roughly 25-45 words.`,
        sectionId: section.id,
      });
    }

    for (const term of input.prohibited) {
      const needle = term.trim().toLowerCase();
      if (needle.length < 2) continue;
      if (lower.includes(needle)) {
        issues.push({
          severity: "warning",
          kind: "prohibited_style",
          message: `Contains "${term}", which your style profile lists as prohibited.`,
          sectionId: section.id,
        });
      }
    }

    const firstLine = section.body.trim().split("\n")[0]?.toLowerCase() ?? "";
    for (const filler of FILLER_OPENERS) {
      if (firstLine.startsWith(filler)) {
        issues.push({
          severity: "info",
          kind: "filler_opener",
          message: `Opens with "${filler}" — consider starting on the substance instead.`,
          sectionId: section.id,
        });
        break;
      }
    }

    const matchedMarkers = CLAIM_MARKERS.filter((marker) => lower.includes(marker));
    if (matchedMarkers.length > 0) {
      issues.push({
        severity: "warning",
        kind: "needs_source",
        message: `Asserts evidence (${matchedMarkers
          .slice(0, 3)
          .map((m) => `"${m}"`)
          .join(", ")}). No source is attached, so this must be verified before publishing.`,
        sectionId: section.id,
      });
    }

    if (section.role === "cta" && words === 0) {
      issues.push({
        severity: "info",
        kind: "empty_cta",
        message: "The call to action section is empty.",
        sectionId: section.id,
      });
    }

    return {
      id: section.id,
      heading: section.heading,
      role: section.role,
      words,
      estSeconds: estimateSeconds(words, wpm),
    };
  });

  const countedSentences = input.sections
    .map((s) => s.body.split(/\n+/))
    .flat()
    .map((line) => line.trim())
    .filter((line) => line.length > 60);
  const duplicates = countedSentences.filter(
    (line, index) => countedSentences.indexOf(line) !== index,
  );
  if (duplicates.length > 0) {
    issues.push({
      severity: "info",
      kind: "repeated_lines",
      message: `${duplicates.length} repeated line(s) detected across sections.`,
    });
  }

  if (!input.sections.some((s) => s.role === "cta" || s.role === "outro")) {
    issues.push({
      severity: "info",
      kind: "no_close",
      message: "No call to action or outro section in this script.",
    });
  }

  return {
    totals: {
      words: totalWords,
      sentences: totalSentences,
      estSeconds: estimateSeconds(totalWords, wpm),
      wordsPerMinute: wpm,
    },
    sectionMetrics,
    issues,
  };
}

/* ------------------------------------------------------------------ */
/* 4. publish.chapter_plan                                             */
/* ------------------------------------------------------------------ */

const chapterPlanInput = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      role: z.enum(["hook", "intro", "body", "cta", "outro"]),
      estSeconds: z.number().min(0),
    }),
  ),
  /** Shortest section that may start a chapter, in seconds. */
  minChapterSeconds: z.number().optional(),
});

const chapterPlanOutput = z.object({
  chapters: z.array(
    z.object({
      atSeconds: z.number(),
      label: z.string(),
      sectionId: z.string().optional(),
    }),
  ),
  totalSeconds: z.number(),
  issues: z.array(outlineIssueSchema),
});

export type ChapterPlan = z.infer<typeof chapterPlanOutput>;

/** YouTube ignores a chapter list whose first marker is not at 00:00. */
const CHAPTER_FLOOR_SECONDS = 10;
const CHAPTER_CEILING_SECONDS = 20;

function chapterLabel(heading: string): string {
  const label = heading
    .replace(/\s+/g, " ")
    .replace(/[:.\-–—]+$/, "")
    .trim();
  return (label || "Chapter").slice(0, 90);
}

/**
 * Build chapter markers arithmetically from the real per-section duration
 * estimates. Timestamps therefore always agree with the draft — none of these
 * numbers were chosen by a model. Sections shorter than the minimum chapter
 * length are folded into the chapter that precedes them.
 */
type PlanSection = z.infer<typeof chapterPlanInput>["sections"][number];

function derive(
  sections: PlanSection[],
  threshold: number,
): { chapters: ChapterPlan["chapters"]; elapsed: number } {
  const chapters: ChapterPlan["chapters"] = [];
  let elapsed = 0;

  for (const section of sections) {
    if (chapters.length === 0) {
      // The first marker is always 0:00, otherwise YouTube discards the list.
      chapters.push({
        atSeconds: 0,
        label: chapterLabel(section.heading),
        sectionId: section.id,
      });
    } else if (section.role !== "hook" && section.estSeconds >= threshold) {
      chapters.push({
        atSeconds: elapsed,
        label: chapterLabel(section.heading),
        sectionId: section.id,
      });
    }
    elapsed += Math.max(0, section.estSeconds);
  }

  return { chapters, elapsed };
}

export function planChapters(
  input: z.infer<typeof chapterPlanInput>,
): ChapterPlan {
  const requested = input.minChapterSeconds ?? CHAPTER_CEILING_SECONDS;
  const threshold = Math.min(
    CHAPTER_CEILING_SECONDS,
    Math.max(CHAPTER_FLOOR_SECONDS, requested),
  );
  const issues: ChapterPlan["issues"] = [];

  let { chapters, elapsed } = derive(input.sections, threshold);

  // YouTube only shows a chapter list from three markers onward. Rather than
  // return a list that will simply be ignored, relax the minimum — but never
  // below the 10 seconds YouTube itself requires — so the markers stay useful.
  if (
    input.sections.length > 0 &&
    chapters.length > 1 &&
    chapters.length < 3 &&
    threshold > CHAPTER_FLOOR_SECONDS
  ) {
    const relaxed = derive(input.sections, CHAPTER_FLOOR_SECONDS);
    if (relaxed.chapters.length > chapters.length) {
      chapters = relaxed.chapters;
      elapsed = relaxed.elapsed;
      issues.push({
        severity: "info",
        kind: "chapters_relaxed",
        message: `Lowered the chapter minimum to ${CHAPTER_FLOOR_SECONDS}s so the list reaches the three markers YouTube needs.`,
      });
    }
  }

  if (input.sections.length === 0) {
    issues.push({
      severity: "critical",
      kind: "chapters_incomplete",
      message:
        "There are no written sections yet, so no chapter markers could be derived.",
    });
  } else if (chapters.length < 3) {
    issues.push({
      severity: "warning",
      kind: "too_few_chapters",
      message: `Only ${chapters.length} section(s) reach the ${threshold}s minimum. YouTube shows a chapter list from 3 markers onward — lengthen or merge the short sections.`,
    });
  }

  if (elapsed > 0 && elapsed < 60) {
    issues.push({
      severity: "info",
      kind: "below_chapter_minimum",
      message: `The draft runs about ${elapsed}s, which is too short for chapters to help viewers.`,
    });
  }

  return { chapters, totalSeconds: elapsed, issues };
}

/* ------------------------------------------------------------------ */
/* 5. publish.metadata_check                                           */
/* ------------------------------------------------------------------ */

/** YouTube's hard title limit. Longer titles cannot be published at all. */
export const TITLE_HARD_LIMIT = 100;
/** Where search results and most mobile surfaces truncate a title. */
export const TITLE_TRUNCATION_LIMIT = 70;
export const DESCRIPTION_LIMIT = 5000;
export const TAG_TOTAL_LIMIT = 500;

const metadataCheckInput = z.object({
  titles: z.array(z.string()),
  tags: z.array(z.string()).default([]),
  description: z.string().default(""),
});

const metadataCheckOutput = z.object({
  valid: z.boolean(),
  titles: z.array(
    z.object({
      text: z.string(),
      chars: z.number(),
      issues: z.array(z.string()),
    }),
  ),
  cleanTags: z.array(z.string()),
  tagCharacters: z.number(),
  tagIssues: z.array(z.string()),
  issues: z.array(outlineIssueSchema),
});

export type MetadataCheck = z.infer<typeof metadataCheckOutput>;

/**
 * Share of letters that are upper case — a cheap shouting detector. Scripts
 * without letter case (Arabic, Chinese, …) simply score 0.
 */
export function uppercaseRatio(text: string): number {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return 0;
  return letters.replace(/[^\p{Lu}]/gu, "").length / letters.length;
}

/**
 * Check a publish kit against the real YouTube field limits and normalise the
 * tag list. Everything reported here is a measured fact about the text, not an
 * opinion about how good the copy is.
 */
export function checkMetadata(
  input: z.infer<typeof metadataCheckInput>,
): MetadataCheck {
  const issues: MetadataCheck["issues"] = [];

  const titles = input.titles.map((raw) => {
    const text = raw.replace(/\s+/g, " ").trim();
    const found: string[] = [];

    if (text.length < 12) {
      found.push(
        "Very short — there is little for a viewer or a search engine to latch onto.",
      );
    }
    if (text.length > TITLE_HARD_LIMIT) {
      found.push(
        `YouTube rejects titles past ${TITLE_HARD_LIMIT} characters; this one is ${text.length}.`,
      );
    } else if (text.length > TITLE_TRUNCATION_LIMIT) {
      found.push(
        `Search and most mobile surfaces truncate around ${TITLE_TRUNCATION_LIMIT} characters.`,
      );
    }
    if (text.length >= 12 && uppercaseRatio(text) > 0.6) {
      found.push("Almost entirely upper case — this reads as shouting.");
    }
    const hashtags = (text.match(/#/g) ?? []).length;
    if (hashtags > 3) {
      found.push(`${hashtags} hashtags; YouTube only honours three in a title.`);
    }

    return { text, chars: text.length, issues: found };
  });

  if (titles.length === 0) {
    issues.push({
      severity: "critical",
      kind: "no_title",
      message: "No title options were produced.",
    });
  } else if (titles.some((title) => title.chars > TITLE_HARD_LIMIT)) {
    issues.push({
      severity: "critical",
      kind: "title_too_long",
      message: `At least one title is longer than YouTube's ${TITLE_HARD_LIMIT}-character limit and would be cut off at upload.`,
    });
  } else if (titles.every((title) => title.issues.length > 0)) {
    issues.push({
      severity: "warning",
      kind: "titles_need_work",
      message:
        "Every title option has at least one problem — pick one and tighten it before publishing.",
    });
  }

  const seen = new Set<string>();
  const cleanTags: string[] = [];
  const tagIssues: string[] = [];
  let dropped = 0;

  for (const raw of input.tags) {
    const tag = raw.replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (tag.length === 0) {
      dropped += 1;
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    cleanTags.push(tag.slice(0, 60));
  }

  if (dropped > 0) {
    tagIssues.push(`${dropped} empty or duplicate tag(s) were removed.`);
  }

  const tagCharacters = cleanTags.join(",").length;
  if (tagCharacters > TAG_TOTAL_LIMIT) {
    tagIssues.push(
      `Tags total ${tagCharacters} characters; YouTube ignores the rest past ${TAG_TOTAL_LIMIT}. Remove about ${tagCharacters - TAG_TOTAL_LIMIT}.`,
    );
    issues.push({
      severity: "critical",
      kind: "tags_over_limit",
      message: `The tag list is ${tagCharacters} characters against a ${TAG_TOTAL_LIMIT} limit.`,
    });
  }
  if (cleanTags.length === 0) {
    tagIssues.push("No usable tags — YouTube uses these to decide where to place the video.");
    issues.push({
      severity: "warning",
      kind: "no_tags",
      message: "No usable tags were produced.",
    });
  }

  const description = input.description.trim();
  if (description.length === 0) {
    issues.push({
      severity: "warning",
      kind: "empty_description",
      message:
        "The description is empty. The first two lines are the only part most viewers ever read.",
    });
  } else if (description.length > DESCRIPTION_LIMIT) {
    issues.push({
      severity: "critical",
      kind: "description_too_long",
      message: `The description is ${description.length} characters against a ${DESCRIPTION_LIMIT} limit.`,
    });
  } else if (description.length < 200) {
    issues.push({
      severity: "info",
      kind: "thin_description",
      message:
        "A very short description — use it for your sources, chapters and the next video.",
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "critical"),
    titles,
    cleanTags,
    tagCharacters,
    tagIssues,
    issues,
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                           */
/* ------------------------------------------------------------------ */

export const TOOLS: ToolDefinition[] = [
  {
    id: "text.word_stats",
    name: "Word statistics",
    description:
      "Counts words, sentences and paragraphs and derives a narration duration estimate from the creator's pacing.",
    permission: "READ",
    requiresConfirmation: false,
    inputSchema: wordStatsInput,
    outputSchema: wordStatsOutput,
    run: async (input) => wordStats(input as z.infer<typeof wordStatsInput>),
  },
  {
    id: "script.outline_validate",
    name: "Outline validator",
    description:
      "Normalises a generated outline and rescales section lengths so it fits the requested duration.",
    permission: "READ",
    requiresConfirmation: false,
    inputSchema: outlineValidateInput,
    outputSchema: outlineValidateOutput,
    run: async (input) => validateOutline(input as z.infer<typeof outlineValidateInput>),
  },
  {
    id: "script.qa_scan",
    name: "Script QA scan",
    description:
      "Deterministic quality and safety scan: empty sections, prohibited style, filler openers, repeated lines and unsourced evidence claims.",
    permission: "READ",
    requiresConfirmation: false,
    inputSchema: qaScanInput,
    outputSchema: qaScanOutput,
    run: async (input) => qaScan(input as z.infer<typeof qaScanInput>),
  },
  {
    id: "publish.chapter_plan",
    name: "Chapter planner",
    description:
      "Derives YouTube chapter markers from the real per-section duration estimates, so the timestamps always match the draft.",
    permission: "READ",
    requiresConfirmation: false,
    inputSchema: chapterPlanInput,
    outputSchema: chapterPlanOutput,
    run: async (input) => planChapters(input as z.infer<typeof chapterPlanInput>),
  },
  {
    id: "publish.metadata_check",
    name: "Metadata checker",
    description:
      "Measures titles, tags and description against YouTube's real field limits and normalises the tag list. Findings are measurements, not opinions.",
    permission: "READ",
    requiresConfirmation: false,
    inputSchema: metadataCheckInput,
    outputSchema: metadataCheckOutput,
    run: async (input) => checkMetadata(input as z.infer<typeof metadataCheckInput>),
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function listTools(): ToolSummary[] {
  return TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    permission: tool.permission,
    requiresConfirmation: tool.requiresConfirmation,
  }));
}

/**
 * Run a registered tool: validate the input against its schema, reject any
 * permission level that needs confirmation the caller did not provide, and
 * always return a structured ToolResult (never throw at the call site).
 */
export async function callTool(
  id: string,
  rawInput: unknown,
  options: { confirmed?: boolean } = {},
): Promise<ToolResult> {
  const startedAt = Date.now();
  const tool = getTool(id);
  if (!tool) {
    return {
      toolId: id,
      ok: false,
      permission: "READ",
      durationMs: 0,
      error: `Unknown tool "${id}".`,
    };
  }

  const base = {
    toolId: tool.id,
    permission: tool.permission,
  };

  const needsConfirmation =
    tool.requiresConfirmation || CONFIRMATION_REQUIRED.includes(tool.permission);
  if (needsConfirmation && !options.confirmed) {
    return {
      ...base,
      ok: false,
      durationMs: 0,
      error: `Tool "${tool.id}" requires ${tool.permission} confirmation before it can run.`,
    };
  }

  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ...base,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: `Invalid input for "${tool.id}": ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "input"} ${issue.message}`)
        .join("; ")}`,
    };
  }

  try {
    const data = await tool.run(parsed.data as never);
    const checked = tool.outputSchema.safeParse(data);
    if (!checked.success) {
      return {
        ...base,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: `Tool "${tool.id}" returned an invalid result.`,
      };
    }
    return {
      ...base,
      ok: true,
      durationMs: Date.now() - startedAt,
      data: checked.data,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : `Tool "${tool.id}" failed.`,
    };
  }
}
