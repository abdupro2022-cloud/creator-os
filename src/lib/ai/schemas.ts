import { z } from "zod";
import { outlineSchema } from "../tools/registry";
import { countWords, stripCodeFences } from "../script";

/**
 * Output contracts for every agent step.
 *
 * A model response is only accepted when it parses against one of these
 * schemas, which is what keeps the pipeline from writing half-valid data into
 * the database.
 */

export const knowledgeKindSchema = z.enum([
  "fact",
  "inference",
  "suggestion",
  "unverified",
]);

export const ideaDevelopmentSchema = z.object({
  title: z.string().min(3),
  oneLiner: z.string().min(3),
  angle: z.string().min(3),
  hook: z.string().min(3),
  audience: z.string().min(2),
  format: z.enum(["long_form", "short", "both"]),
  whyNow: z.string(),
  keyPoints: z
    .array(
      z.object({
        text: z.string().min(1),
        kind: knowledgeKindSchema,
      }),
    )
    .min(1),
  openQuestions: z.array(z.string()).default([]),
  riskNotes: z.array(z.string()).default([]),
});
export type IdeaDevelopment = z.infer<typeof ideaDevelopmentSchema>;

export const scriptOutlineSchema = outlineSchema;

export interface SectionText {
  body: string;
  notes?: string;
}

/**
 * Sections come back as plain text rather than JSON. A long paragraph inside a
 * JSON string is fragile: truncation or a broken escape silently corrupts the
 * draft. This splits narration from an optional production note instead.
 */
export function parseSectionText(
  text: string,
  delimiter = "---NOTE---",
): ParseResult<SectionText> {
  const cleaned = stripCodeFences(text)
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .trim();

  if (cleaned.length === 0) {
    return { ok: false, error: "The model returned an empty section." };
  }

  const [rawBody, ...rest] = cleaned.split(delimiter);
  const body = rawBody.trim();
  const notes = rest.join("\n").trim();

  if (body.length === 0) {
    return { ok: false, error: "The model returned no narration text." };
  }
  if (countWords(body) < 10) {
    return {
      ok: false,
      error: "The model returned too little narration to be usable.",
    };
  }

  return { ok: true, data: { body, notes: notes.length > 0 ? notes : undefined } };
}

/**
 * The publish kit as the model may describe it.
 *
 * Chapters are deliberately absent: they are derived arithmetically from the
 * real section durations, so a model never gets to state a timestamp.
 */
export const publishPackSchema = z.object({
  titles: z
    .array(
      z.object({
        text: z.string().min(3),
        rationale: z.string(),
      }),
    )
    .min(3)
    .max(6),
  description: z.string().min(20),
  tags: z.array(z.string()).default([]),
  pinnedComment: z.string().default(""),
  thumbnail: z.object({
    overlayText: z.string(),
    subject: z.string(),
    composition: z.string(),
  }),
  shorts: z
    .array(
      z.object({
        title: z.string().min(3),
        hook: z.string().min(3),
        beats: z.array(z.string()).default([]),
        /** Heading of the script section this cut comes from, when one matches. */
        sourceHeading: z.string().optional(),
      }),
    )
    .min(1)
    .max(6),
});
export type PublishPack = z.infer<typeof publishPackSchema>;

export const verificationSchema = z.object({
  summary: z.string(),
  score: z.number().min(0).max(100),
  issues: z
    .array(
      z.object({
        severity: z.enum(["info", "warning", "critical"]),
        kind: z.string(),
        message: z.string(),
        heading: z.string().optional(),
      }),
    )
    .default([]),
});
export type Verification = z.infer<typeof verificationSchema>;

export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Pull the first JSON object out of a model response (fences tolerated). */
export function extractJson(text: string): ParseResult<unknown> {
  const cleaned = stripCodeFences(text);
  try {
    return { ok: true, data: JSON.parse(cleaned) };
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return { ok: false, error: "The model returned no JSON object." };
    }
    try {
      return { ok: true, data: JSON.parse(cleaned.slice(start, end + 1)) };
    } catch (error) {
      return {
        ok: false,
        error: `The model returned malformed JSON: ${
          error instanceof Error ? error.message : "parse error"
        }`,
      };
    }
  }
}

/** Validate raw model text against a schema, returning a readable error. */
export function parseModelOutput<T>(
  text: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const extracted = extractJson(text);
  if (!extracted.ok) return { ok: false, error: extracted.error };
  const parsed = schema.safeParse(extracted.data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "output"} ${issue.message}`)
      .join("; ");
    return { ok: false, error: `The model output did not match the expected shape: ${detail}` };
  }
  return { ok: true, data: parsed.data };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
