import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildPublishMessages } from "../../lib/ai/prompts";
import { parseModelOutput, publishPackSchema } from "../../lib/ai/schemas";
import {
  callTool,
  type ChapterPlan,
  type MetadataCheck,
  type QaScan,
} from "../../lib/tools/registry";
import { formatDuration } from "../../lib/script";

/**
 * Agent core — publish kit.
 *
 * Two halves, deliberately separated:
 *
 *   deterministic  chapter markers (publish.chapter_plan) and the metadata
 *                  measurement (publish.metadata_check) — both computed from
 *                  the real draft, so timestamps and limits are facts
 *   model          the copy itself: titles, description, tags, thumbnail brief
 *                  and the Shorts cuts worth pulling out of this script
 *
 * The kit never uploads anything. It is copy the creator takes to YouTube, and
 * the model is told plainly that it may not invent links, numbers or sources.
 */

interface Settings {
  publishModel?: string;
  routingPreference: "balanced" | "quality" | "speed";
  extraModelIds: string[];
}

interface Profile {
  language: string;
  dialect: string;
  tone: string[];
  pacing: string;
  storytelling: string[];
  audience: string;
  targetLengthMin: number;
  hookStyles: string[];
  prohibited: string[];
  notes?: string;
}

interface Context {
  settings: Settings;
  profile: Profile | null;
}

interface GenerateOutcome {
  ok: boolean;
  packId?: Id<"publishPacks">;
  titleCount?: number;
  chapterCount?: number;
  shortCount?: number;
  issues?: string[];
  error?: string;
}

/**
 * The settings table stores a model pin per task. The publish kit reuses the
 * script pin when no dedicated one exists, so the creator only has to choose a
 * model once.
 */
async function loadContext(
  ctx: ActionCtx,
  ownerId: Id<"users">,
): Promise<Context> {
  const [settings, profile] = await Promise.all([
    ctx.runQuery(internal.settings.forUser, { ownerId }),
    ctx.runQuery(internal.creatorProfile.forUser, { ownerId }),
  ]);
  const raw = settings as Settings & { scriptModel?: string };
  return {
    settings: {
      publishModel: raw.publishModel ?? raw.scriptModel,
      routingPreference: raw.routingPreference,
      extraModelIds: raw.extraModelIds ?? [],
    },
    profile: (profile as Profile | null) ?? null,
  };
}

function excerpt(body: string, limit = 240): string {
  const flat = body.trim().replace(/\s+/g, " ");
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

export const generate = action({
  args: {
    scriptId: v.id("scripts"),
    /** Shortest section that may start a chapter, in seconds. */
    minChapterSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GenerateOutcome> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, error: "You are not signed in." };

    const loaded = await ctx.runQuery(internal.publishing.loadForScript, {
      scriptId: args.scriptId,
      ownerId: userId,
    });

    const written = loaded.sections.filter(
      (section) => section.status === "written" && section.body.trim().length > 0,
    );
    if (written.length === 0) {
      return {
        ok: false as const,
        error:
          "Draft at least one section first — the publish kit is built from the finished script.",
      };
    }

    const context = await loadContext(ctx, userId);
    const packId = await ctx.runMutation(internal.publishing.startPack, {
      ownerId: userId,
      scriptId: args.scriptId,
      projectId: loaded.script.projectId,
    });

    const runId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.script.projectId,
      kind: "publish_pack",
      taskType: "publish_pack",
      targetId: packId,
    });

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Planning",
      status: "done",
      detail: `${written.length} written section(s), about ${formatDuration(
        loaded.script.estSeconds,
      )} of narration.`,
    });

    /* ---------------- deterministic half: real measurements ---------------- */

    const planResult = await callTool("publish.chapter_plan", {
      sections: loaded.sections.map((section) => ({
        id: section._id,
        heading: section.heading,
        role: section.role,
        estSeconds: section.estSeconds,
      })),
      minChapterSeconds: args.minChapterSeconds,
    });

    if (!planResult.ok || !planResult.data) {
      const error = planResult.error ?? "The chapter plan could not be derived.";
      await ctx.runMutation(internal.publishing.failPack, {
        packId,
        runId,
        error,
      });
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Analyzing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: planResult.durationMs,
        candidates: [],
        errorMessage: error,
        targetId: packId,
      });
      return { ok: false as const, error };
    }

    const plan = planResult.data as ChapterPlan;

    const scan = await callTool("script.qa_scan", {
      sections: written.map((section) => ({
        id: section._id,
        role: section.role,
        heading: section.heading,
        body: section.body,
      })),
      prohibited: context.profile?.prohibited ?? [],
      pacing: context.profile?.pacing,
    });

    const scanData = scan.ok ? (scan.data as QaScan | undefined) : undefined;
    const scanFindings = scanData
      ? scanData.issues.map(
          (issue) => `${issue.severity} (${issue.kind}): ${issue.message}`,
        )
      : [`The script scan could not run: ${scan.error ?? "unknown error"}`];

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Analyzing",
      status: "done",
      detail: `Chapter plan: ${plan.chapters.length} marker(s). Script scan: ${scanFindings.length} finding(s).`,
    });

    /* --------------------- model half: the actual copy --------------------- */

    const result = await ctx.runAction(internal.agent.step.run, {
      taskType: "publish_pack",
      messages: buildPublishMessages({
        title: loaded.script.title,
        angle: "",
        hook: excerpt(written[0]?.body ?? "", 400),
        wordCount: loaded.script.wordCount,
        estSeconds: loaded.script.estSeconds,
        targetDurationSec: loaded.script.targetDurationSec,
        format: loaded.script.estSeconds < 180 ? "short" : "long_form",
        sections: written.map((section) => ({
          heading: section.heading,
          role: section.role,
          words: section.wordCount,
          excerpt: excerpt(section.body),
        })),
        chapterLabels: plan.chapters.map(
          (chapter) => `${formatDuration(chapter.atSeconds)} ${chapter.label}`,
        ),
        deterministicFindings: scanFindings,
        profile: context.profile,
      }),
      temperature: 0.7,
      maxTokens: 2600,
      preference: context.settings.routingPreference,
      preferredModelId: context.settings.publishModel,
      extraModelIds: context.settings.extraModelIds,
    });

    if (!result.ok) {
      const error = result.error ?? "The model call failed.";
      await ctx.runMutation(internal.publishing.failPack, {
        packId,
        runId,
        error,
      });
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Writing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: error,
        targetId: packId,
      });
      return { ok: false as const, error };
    }

    const parsed = parseModelOutput(result.text, publishPackSchema);
    if (!parsed.ok || !parsed.data) {
      const error = parsed.error ?? "The publish kit was unusable.";
      await ctx.runMutation(internal.publishing.failPack, {
        packId,
        runId,
        error,
      });
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Writing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: error,
        targetId: packId,
      });
      return { ok: false as const, error };
    }

    const pack = parsed.data;

    /* -------------------- deterministic half again: the check ------------- */

    const checkResult = await callTool("publish.metadata_check", {
      titles: pack.titles.map((title) => title.text),
      tags: pack.tags,
      description: pack.description,
    });

    if (!checkResult.ok || !checkResult.data) {
      const error =
        checkResult.error ??
        "The metadata could not be measured against YouTube's limits.";
      await ctx.runMutation(internal.publishing.failPack, {
        packId,
        runId,
        error,
      });
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Verifying",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: error,
        targetId: packId,
      });
      return { ok: false as const, error };
    }

    const check = checkResult.data as MetadataCheck;

    const titleIssues = check.titles.flatMap((title, index) =>
      title.issues.map((issue) => `Title ${index + 1}: ${issue}`),
    );

    const metadataIssues = [
      ...check.issues.map((issue) => `${issue.severity}: ${issue.message}`),
      ...check.tagIssues,
    ];

    const headings = new Map(
      loaded.sections.map((section) => [
        section.heading.trim().toLowerCase(),
        section.heading,
      ]),
    );

    const shorts = pack.shorts.map((cut) => {
      const matched = cut.sourceHeading
        ? headings.get(cut.sourceHeading.trim().toLowerCase())
        : undefined;
      return {
        title: cut.title.slice(0, 120),
        hook: cut.hook.slice(0, 400),
        beats: cut.beats.map((beat) => beat.slice(0, 300)).slice(0, 6),
        /** Dropped when it does not name a section that really exists. */
        sourceHeading: matched,
      };
    });

    await ctx.runMutation(internal.publishing.applyPack, {
      packId,
      titles: pack.titles.map((title) => ({
        text: title.text.slice(0, 140),
        rationale: title.rationale.slice(0, 300),
      })),
      description: pack.description.slice(0, 5000),
      tags: check.cleanTags,
      chapters: plan.chapters,
      pinnedComment: pack.pinnedComment.slice(0, 600),
      thumbnail: {
        overlayText: pack.thumbnail.overlayText.slice(0, 60),
        subject: pack.thumbnail.subject.slice(0, 300),
        composition: pack.thumbnail.composition.slice(0, 300),
      },
      shorts,
      titleIssues,
      metadataIssues,
      model: result.model,
      runId,
    });

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: "done",
      detail: `Metadata check: ${check.issues.length} issue(s) across ${check.titles.length} title(s) and ${check.cleanTags.length} tag(s).`,
    });
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Saving",
      status: "done",
      detail: `Kit saved: ${pack.titles.length} title(s), ${plan.chapters.length} chapter(s), ${shorts.length} Shorts cut(s).`,
    });
    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: "completed",
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: result.latencyMs,
      candidates: result.candidates,
      targetId: packId,
    });

    return {
      ok: true as const,
      packId,
      titleCount: pack.titles.length,
      chapterCount: plan.chapters.length,
      shortCount: shorts.length,
      issues: [...titleIssues, ...metadataIssues].slice(0, 12),
    };
  },
});
