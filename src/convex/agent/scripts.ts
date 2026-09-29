"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildOutlineMessages,
  buildSectionMessages,
  buildVerificationMessages,
} from "../../lib/ai/prompts";
import {
  parseModelOutput,
  parseSectionText,
  scriptOutlineSchema,
  verificationSchema,
} from "../../lib/ai/schemas";
import { callTool, type OutlineValidation, type QaScan } from "../../lib/tools/registry";
import { countWords, wordsPerMinute } from "../../lib/script";

/**
 * Agent core — script drafting.
 *
 * Three real phases, each recorded as its own run:
 *   1. outline      the plan, validated and rescaled to the target duration
 *   2. sections     one model call per section, written straight to the database
 *                   so the Script Studio fills in progressively
 *   3. verification a deterministic QA scan plus a model review pass
 *
 * A section that fails is marked failed and the rest continue, so a partial
 * failure still leaves usable work instead of nothing.
 */

type AnyDoc = Doc<"scriptSections">;

interface Settings {
  ideaModel?: string;
  scriptModel?: string;
  verificationModel?: string;
  routingPreference: "balanced" | "quality" | "speed";
  extraModelIds: string[];
  autoVerify: boolean;
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

interface VerifyOutcome {
  ok: boolean;
  score?: number;
  issues?: number;
  error?: string;
}

interface DraftOutcome {
  ok: boolean;
  scriptId?: Id<"scripts">;
  sectionsWritten?: number;
  sectionsFailed?: number;
  verification?: VerifyOutcome | null;
  outlineIssues?: string[];
  error?: string;
}

async function loadContext(
  ctx: ActionCtx,
  ownerId: Id<"users">,
): Promise<Context> {
  const [settings, profile] = await Promise.all([
    ctx.runQuery(internal.settings.forUser, { ownerId }),
    ctx.runQuery(internal.creatorProfile.forUser, { ownerId }),
  ]);
  return { settings: settings as Settings, profile: (profile as Profile | null) ?? null };
}

/**
 * Narration is token-hungry in languages like Arabic, and a truncated response
 * is a corrupted section, so the budget is deliberately generous.
 */
function tokenBudget(targetWords: number): number {
  return Math.min(4000, Math.max(1200, Math.round(targetWords * 8)));
}

function summarise(section: AnyDoc): string {
  const body = section.body.trim().replace(/\s+/g, " ");
  return `${section.heading}: ${body.slice(0, 160)}`;
}

async function writeSections(
  ctx: ActionCtx,
  options: {
    ownerId: Id<"users">;
    projectId: Id<"projects">;
    scriptId: Id<"scripts">;
    sections: AnyDoc[];
    idea: { title: string; angle: string; hook: string } | null;
    onlyPending: boolean;
    runId: Id<"aiRuns">;
    context: Context;
  },
): Promise<{ written: number; failed: number; errors: string[] }> {
  const { context } = options;
  const total = options.sections.length;
  const pending = options.onlyPending
    ? options.sections.filter((section) => section.status !== "written")
    : options.sections;

  if (pending.length === 0) {
    return { written: 0, failed: 0, errors: [] };
  }

  await ctx.runMutation(internal.runs.step, {
    runId: options.runId,
    label: "Writing",
    status: "started",
    detail: `Drafting ${pending.length} of ${total} section(s).`,
  });

  const written: AnyDoc[] = [];
  const errors: string[] = [];

  for (const section of pending) {
    const index = options.sections.findIndex((s) => s._id === section._id);
    const previousSummaries = [...options.sections]
      .slice(0, index)
      .filter((s) => s.body.trim().length > 0)
      .map((s) => summarise(s));

    await ctx.runMutation(internal.scripts.markSectionWriting, {
      sectionId: section._id,
    });

    const result = await ctx.runAction(internal.agent.step.run, {
      taskType: "script_writing",
      messages: buildSectionMessages({
        title: options.idea?.title ?? "Untitled video",
        angle: options.idea?.angle ?? "",
        section: {
          role: section.role,
          heading: section.heading,
          intent: section.intent,
          targetWords: section.targetWords,
        },
        sectionIndex: index,
        totalSections: total,
        previousSummaries,
        profile: context.profile,
      }),
      temperature: 0.75,
      maxTokens: tokenBudget(section.targetWords),
      preference: context.settings.routingPreference,
      preferredModelId: context.settings.scriptModel,
      extraModelIds: context.settings.extraModelIds,
    });

    if (!result.ok) {
      const error = result.error ?? "The model call failed.";
      errors.push(`${section.heading}: ${error}`);
      await ctx.runMutation(internal.scripts.markSectionFailed, {
        sectionId: section._id,
      });
      await ctx.runMutation(internal.runs.step, {
        runId: options.runId,
        label: "Writing",
        status: "failed",
        detail: `${index + 1}/${total} · ${section.heading} — ${error}`.slice(0, 240),
      });
      continue;
    }

    const parsed = parseSectionText(result.text);
    if (!parsed.ok || !parsed.data) {
      const error = parsed.error ?? "The model returned an empty section.";
      errors.push(`${section.heading}: ${error}`);
      await ctx.runMutation(internal.scripts.markSectionFailed, {
        sectionId: section._id,
      });
      await ctx.runMutation(internal.runs.step, {
        runId: options.runId,
        label: "Writing",
        status: "failed",
        detail: `${index + 1}/${total} · ${section.heading} — ${error}`.slice(0, 240),
      });
      continue;
    }

    await ctx.runMutation(internal.scripts.applySectionDraft, {
      sectionId: section._id,
      body: parsed.data.body.trim(),
      notes: parsed.data.notes,
    });

    written.push({ ...section, body: parsed.data.body.trim() });

    await ctx.runMutation(internal.runs.step, {
      runId: options.runId,
      label: "Writing",
      status: "done",
      detail: `${index + 1}/${total} · ${section.heading} — ${countWords(
        parsed.data.body,
      )} words via ${result.model}`,
    });
  }

  return { written: written.length, failed: errors.length, errors };
}

async function verifyScript(
  ctx: ActionCtx,
  options: {
    ownerId: Id<"users">;
    projectId: Id<"projects">;
    scriptId: Id<"scripts">;
    context: Context;
  },
): Promise<VerifyOutcome> {
  const loaded = await ctx.runQuery(internal.scripts.loadForRun, {
    scriptId: options.scriptId,
    ownerId: options.ownerId,
  });

  const runId = await ctx.runMutation(internal.runs.start, {
    ownerId: options.ownerId,
    projectId: options.projectId,
    kind: "script_verification",
    taskType: "verification",
    targetId: options.scriptId,
  });

  // Deterministic first — these findings are facts, not opinions.
  const scan = await callTool("script.qa_scan", {
    sections: loaded.sections.map((section) => ({
      id: section._id,
      role: section.role,
      heading: section.heading,
      body: section.body,
    })),
    prohibited: options.context.profile?.prohibited ?? [],
    pacing: options.context.profile?.pacing,
  });

  if (!scan.ok || !scan.data) {
    const error = scan.error ?? "The QA scan could not run.";
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: "failed",
      detail: error.slice(0, 240),
    });
    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: scan.durationMs,
      candidates: [],
      errorMessage: error,
      targetId: options.scriptId,
    });
    return { ok: false, error };
  }

  const qa = scan.data as QaScan;
  await ctx.runMutation(internal.runs.step, {
    runId,
    label: "Analyzing",
    status: "done",
    detail: `Deterministic scan: ${qa.totals.words} words, ${qa.issues.length} finding(s).`,
  });

  const deterministicIssues = qa.issues.map((issue) => ({
    severity: issue.severity,
    kind: issue.kind,
    message: issue.message,
    sectionId: issue.sectionId,
  }));

  const deterministicScore = Math.max(
    0,
    100 -
      qa.issues.reduce((total, issue) => {
        if (issue.severity === "critical") return total + 15;
        if (issue.severity === "warning") return total + 6;
        return total + 2;
      }, 0),
  );
  const hasCritical = qa.issues.some((issue) => issue.severity === "critical");

  const review = await ctx.runAction(internal.agent.step.run, {
    taskType: "verification",
    messages: buildVerificationMessages({
      title: loaded.script.title,
      sections: loaded.sections.map((section) => ({
        heading: section.heading,
        role: section.role,
        body: section.body,
        words: section.wordCount,
      })),
      deterministicFindings: qa.issues.map(
        (issue) => `${issue.severity} (${issue.kind}): ${issue.message}`,
      ),
      profile: options.context.profile,
    }),
    temperature: 0.2,
    maxTokens: 1400,
    preference: options.context.settings.routingPreference,
    preferredModelId: options.context.settings.verificationModel,
    extraModelIds: options.context.settings.extraModelIds,
  });

  const byHeading = new Map(
    loaded.sections.map((section) => [section.heading.toLowerCase(), section._id]),
  );

  if (!review.ok) {
    // The deterministic scan is still real work — persist it and say plainly
    // that the model review did not run.
    const error = review.error ?? "The model review did not run.";
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: "failed",
      detail: error.slice(0, 240),
    });
    await ctx.runMutation(internal.scripts.applyVerification, {
      scriptId: options.scriptId,
      verification: {
        summary:
          "Only the automatic scan ran because the model review failed. Fix the error and verify again for a full review.",
        score: deterministicScore,
        model: "deterministic scan only",
        checkedAt: Date.now(),
        issues: deterministicIssues,
      },
      status: "draft",
      runId,
    });
    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: "failed",
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: review.latencyMs,
      candidates: review.candidates,
      errorMessage: error,
      targetId: options.scriptId,
    });
    return { ok: false, error, score: deterministicScore, issues: qa.issues.length };
  }

  const parsed = parseModelOutput(review.text, verificationSchema);
  if (!parsed.ok || !parsed.data) {
    const error = parsed.error ?? "The model review was unusable.";
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: "failed",
      detail: error.slice(0, 240),
    });
    await ctx.runMutation(internal.scripts.applyVerification, {
      scriptId: options.scriptId,
      verification: {
        summary:
          "Only the automatic scan ran because the model review returned an unusable response.",
        score: deterministicScore,
        model: "deterministic scan only",
        checkedAt: Date.now(),
        issues: deterministicIssues,
      },
      status: "draft",
      runId,
    });
    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: "failed",
      provider: review.provider,
      model: review.model,
      promptTokens: review.promptTokens,
      completionTokens: review.completionTokens,
      latencyMs: review.latencyMs,
      candidates: review.candidates,
      errorMessage: error,
      targetId: options.scriptId,
    });
    return { ok: false, error, score: deterministicScore, issues: qa.issues.length };
  }

  const modelIssues = parsed.data.issues.map((issue) => ({
    severity: issue.severity,
    kind: issue.kind,
    message: issue.message,
    sectionId: issue.heading
      ? byHeading.get(issue.heading.trim().toLowerCase())
      : undefined,
  }));

  const mergedIssues = [...deterministicIssues, ...modelIssues].slice(0, 60);
  const finalScore = Math.min(parsed.data.score, deterministicScore + 10);
  const status =
    finalScore >= 75 && !hasCritical && qa.totals.words > 0 ? "verified" : "draft";

  await ctx.runMutation(internal.runs.step, {
    runId,
    label: "Verifying",
    status: "done",
    detail: `Score ${finalScore}/100 with ${mergedIssues.length} finding(s) via ${review.model}.`,
  });

  await ctx.runMutation(internal.scripts.applyVerification, {
    scriptId: options.scriptId,
    verification: {
      summary: parsed.data.summary,
      score: finalScore,
      model: review.model,
      checkedAt: Date.now(),
      issues: mergedIssues,
    },
    status,
    runId,
  });

  await ctx.runMutation(internal.runs.finish, {
    runId,
    status: "completed",
    provider: review.provider,
    model: review.model,
    promptTokens: review.promptTokens,
    completionTokens: review.completionTokens,
    latencyMs: review.latencyMs,
    candidates: review.candidates,
    targetId: options.scriptId,
  });

  return { ok: true, score: finalScore, issues: mergedIssues.length };
}

/* ------------------------------- actions ------------------------------- */

export const draftFromIdea = action({
  args: {
    ideaId: v.id("ideas"),
    targetDurationMin: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DraftOutcome> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, error: "You are not signed in." };

    const loaded = await ctx.runQuery(internal.ideas.loadForRun, {
      ideaId: args.ideaId,
      ownerId: userId,
    });
    const refined = loaded.idea.refined;
    if (!refined) {
      return {
        ok: false as const,
        error: "Develop this idea first — the drafting agent needs an angle to work from.",
      };
    }

    const context = await loadContext(ctx, userId);
    const wpm = wordsPerMinute(context.profile?.pacing);
    const targetDurationSec = Math.round(
      (args.targetDurationMin ?? context.profile?.targetLengthMin ?? 8) * 60,
    );

    const outlineRunId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.idea.projectId,
      kind: "script_outline",
      taskType: "script_outline",
    });
    await ctx.runMutation(internal.runs.step, {
      runId: outlineRunId,
      label: "Planning",
      status: "done",
      detail: `Target ${Math.round(
        targetDurationSec / 60,
      )} minute(s) at ${wpm} words/minute.`,
    });

    const outlineResult = await ctx.runAction(internal.agent.step.run, {
      taskType: "script_outline",
      messages: buildOutlineMessages({
        title: refined.title,
        oneLiner: refined.oneLiner,
        angle: refined.angle,
        hook: refined.hook,
        keyPoints: refined.keyPoints,
        targetDurationSec,
        profile: context.profile,
      }),
      temperature: 0.6,
      maxTokens: 1400,
      preference: context.settings.routingPreference,
      preferredModelId: context.settings.scriptModel,
      extraModelIds: context.settings.extraModelIds,
    });

    if (!outlineResult.ok) {
      const error = outlineResult.error ?? "The outline step failed.";
      await ctx.runMutation(internal.runs.step, {
        runId: outlineRunId,
        label: "Analyzing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId: outlineRunId,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: outlineResult.latencyMs,
        candidates: outlineResult.candidates,
        errorMessage: error,
      });
      return { ok: false as const, error };
    }

    const parsedOutline = parseModelOutput(outlineResult.text, scriptOutlineSchema);
    if (!parsedOutline.ok || !parsedOutline.data) {
      const error = parsedOutline.error ?? "The outline was unusable.";
      await ctx.runMutation(internal.runs.step, {
        runId: outlineRunId,
        label: "Analyzing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId: outlineRunId,
        status: "failed",
        provider: outlineResult.provider,
        model: outlineResult.model,
        promptTokens: outlineResult.promptTokens,
        completionTokens: outlineResult.completionTokens,
        latencyMs: outlineResult.latencyMs,
        candidates: outlineResult.candidates,
        errorMessage: error,
      });
      return { ok: false as const, error };
    }

    const validation = await callTool("script.outline_validate", {
      outline: parsedOutline.data,
      targetDurationSec,
      pacing: context.profile?.pacing,
    });
    if (!validation.ok || !validation.data) {
      const error = validation.error ?? "The outline could not be validated.";
      await ctx.runMutation(internal.runs.step, {
        runId: outlineRunId,
        label: "Analyzing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId: outlineRunId,
        status: "failed",
        provider: outlineResult.provider,
        model: outlineResult.model,
        promptTokens: outlineResult.promptTokens,
        completionTokens: outlineResult.completionTokens,
        latencyMs: outlineResult.latencyMs,
        candidates: outlineResult.candidates,
        errorMessage: error,
      });
      return { ok: false as const, error };
    }

    const outline = validation.data as OutlineValidation;
    if (!outline.valid) {
      const error =
        outline.issues.find((issue) => issue.severity === "critical")?.message ??
        "The outline did not contain enough sections to draft a script.";
      await ctx.runMutation(internal.runs.step, {
        runId: outlineRunId,
        label: "Analyzing",
        status: "failed",
        detail: error.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId: outlineRunId,
        status: "failed",
        provider: outlineResult.provider,
        model: outlineResult.model,
        promptTokens: outlineResult.promptTokens,
        completionTokens: outlineResult.completionTokens,
        latencyMs: outlineResult.latencyMs,
        candidates: outlineResult.candidates,
        errorMessage: error,
      });
      return { ok: false as const, error };
    }

    const scriptId = await ctx.runMutation(internal.scripts.startDraft, {
      ownerId: userId,
      projectId: loaded.idea.projectId,
      ideaId: args.ideaId,
      title: refined.title,
      targetDurationSec,
      wordsPerMinute: wpm,
      runId: outlineRunId,
    });

    await ctx.runMutation(internal.scripts.applyOutline, {
      scriptId,
      sections: outline.sections,
      runId: outlineRunId,
    });
    const created = await ctx.runQuery(internal.scripts.loadForRun, {
      scriptId,
      ownerId: userId,
    });

    await ctx.runMutation(internal.runs.step, {
      runId: outlineRunId,
      label: "Verifying",
      status: "done",
      detail: `${outline.sections.length} sections planned for about ${outline.totalTargetWords} words.`,
    });
    await ctx.runMutation(internal.runs.finish, {
      runId: outlineRunId,
      status: "completed",
      provider: outlineResult.provider,
      model: outlineResult.model,
      promptTokens: outlineResult.promptTokens,
      completionTokens: outlineResult.completionTokens,
      latencyMs: outlineResult.latencyMs,
      candidates: outlineResult.candidates,
      targetId: scriptId,
    });

    const writeRunId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.idea.projectId,
      kind: "script_section",
      taskType: "script_writing",
      targetId: scriptId,
    });

    const writeResult = await writeSections(ctx, {
      ownerId: userId,
      projectId: loaded.idea.projectId,
      scriptId,
      sections: created.sections,
      idea: {
        title: refined.title,
        angle: refined.angle,
        hook: refined.hook,
      },
      onlyPending: true,
      runId: writeRunId,
      context,
    });

    await ctx.runMutation(internal.runs.finish, {
      runId: writeRunId,
      status:
        writeResult.failed === 0 && writeResult.written > 0 ? "completed" : "failed",
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      candidates: [],
      errorMessage:
        writeResult.errors.length > 0 ? writeResult.errors.join(" | ").slice(0, 600) : undefined,
      targetId: scriptId,
    });

    if (writeResult.failed > 0) {
      await ctx.runMutation(internal.scripts.failDraft, {
        scriptId,
        runId: writeRunId,
        status: "drafting",
        error: `${writeResult.failed} section(s) failed to draft. Retry to write the remaining sections. ${writeResult.errors
          .slice(0, 2)
          .join(" | ")}`,
      });
    }

    const verification = context.settings.autoVerify
      ? await verifyScript(ctx, {
          ownerId: userId,
          projectId: loaded.idea.projectId,
          scriptId,
          context,
        })
      : null;

    return {
      ok: true as const,
      scriptId,
      sectionsWritten: writeResult.written,
      sectionsFailed: writeResult.failed,
      verification,
      outlineIssues: outline.issues.map((issue) => issue.message),
    };
  },
});

export const writePendingSections = action({
  args: { scriptId: v.id("scripts"), verify: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    sectionsWritten: number;
    sectionsFailed: number;
    verification: VerifyOutcome | null;
    error?: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ok: false as const,
        sectionsWritten: 0,
        sectionsFailed: 0,
        verification: null,
        error: "You are not signed in.",
      };
    }

    const loaded = await ctx.runQuery(internal.scripts.loadForRun, {
      scriptId: args.scriptId,
      ownerId: userId,
    });
    const context = await loadContext(ctx, userId);

    const idea = loaded.script.ideaId
      ? await ctx.runQuery(internal.ideas.loadForRun, {
          ideaId: loaded.script.ideaId,
          ownerId: userId,
        })
      : null;

    const runId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.script.projectId,
      kind: "script_section",
      taskType: "script_writing",
      targetId: args.scriptId,
    });

    const result = await writeSections(ctx, {
      ownerId: userId,
      projectId: loaded.script.projectId,
      scriptId: args.scriptId,
      sections: loaded.sections,
      idea: idea
        ? {
            title: idea.idea.refined?.title ?? loaded.script.title,
            angle: idea.idea.refined?.angle ?? "",
            hook: idea.idea.refined?.hook ?? "",
          }
        : { title: loaded.script.title, angle: "", hook: "" },
      onlyPending: true,
      runId,
      context,
    });

    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: result.failed === 0 ? "completed" : "failed",
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      candidates: [],
      errorMessage:
        result.errors.length > 0 ? result.errors.join(" | ").slice(0, 600) : undefined,
      targetId: args.scriptId,
    });

    if (result.failed > 0) {
      await ctx.runMutation(internal.scripts.failDraft, {
        scriptId: args.scriptId,
        runId,
        status: "drafting",
        error: result.errors.slice(0, 2).join(" | "),
      });
    }

    const verification = args.verify ?? true;
    const verificationResult =
      verification && result.failed === 0
        ? await verifyScript(ctx, {
            ownerId: userId,
            projectId: loaded.script.projectId,
            scriptId: args.scriptId,
            context,
          })
        : null;

    return {
      ok: true as const,
      sectionsWritten: result.written,
      sectionsFailed: result.failed,
      verification: verificationResult,
    };
  },
});

export const rewriteSection = action({
  args: { sectionId: v.id("scriptSections") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; model?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, error: "You are not signed in." };

    const loaded = await ctx.runQuery(internal.scripts.loadSectionForRun, {
      sectionId: args.sectionId,
      ownerId: userId,
    });
    const context = await loadContext(ctx, userId);

    const idea = loaded.script.ideaId
      ? await ctx.runQuery(internal.ideas.loadForRun, {
          ideaId: loaded.script.ideaId,
          ownerId: userId,
        })
      : null;

    const runId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.script.projectId,
      kind: "script_section",
      taskType: "script_writing",
      targetId: loaded.script._id,
    });

    const index = loaded.sections.findIndex((s) => s._id === args.sectionId);
    const previousSummaries = loaded.sections
      .slice(0, index)
      .filter((s) => s.body.trim().length > 0)
      .map((s) => summarise(s));

    await ctx.runMutation(internal.scripts.markSectionWriting, {
      sectionId: args.sectionId,
    });

    const result = await ctx.runAction(internal.agent.step.run, {
      taskType: "script_writing",
      messages: buildSectionMessages({
        title: idea?.idea.refined?.title ?? loaded.script.title,
        angle: idea?.idea.refined?.angle ?? "",
        section: {
          role: loaded.section.role,
          heading: loaded.section.heading,
          intent: loaded.section.intent,
          targetWords: loaded.section.targetWords,
        },
        sectionIndex: index,
        totalSections: loaded.sections.length,
        previousSummaries,
        profile: context.profile,
      }),
      temperature: 0.85,
      maxTokens: tokenBudget(loaded.section.targetWords),
      preference: context.settings.routingPreference,
      preferredModelId: context.settings.scriptModel,
      extraModelIds: context.settings.extraModelIds,
    });

    if (!result.ok) {
      const error = result.error ?? "The model call failed.";
      await ctx.runMutation(internal.scripts.markSectionFailed, {
        sectionId: args.sectionId,
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
        targetId: loaded.script._id,
      });
      return { ok: false as const, error };
    }

    const parsed = parseSectionText(result.text);
    if (!parsed.ok || !parsed.data) {
      const error = parsed.error ?? "The model returned an empty section.";
      await ctx.runMutation(internal.scripts.markSectionFailed, {
        sectionId: args.sectionId,
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
        targetId: loaded.script._id,
      });
      return { ok: false as const, error };
    }

    await ctx.runMutation(internal.scripts.applySectionDraft, {
      sectionId: args.sectionId,
      body: parsed.data.body.trim(),
      notes: parsed.data.notes,
    });
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Writing",
      status: "done",
      detail: `Rewrote ${loaded.section.heading} — ${countWords(
        parsed.data.body,
      )} words via ${result.model}.`,
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
      targetId: loaded.script._id,
    });

    return { ok: true as const, model: result.model };
  },
});

export const verify = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args): Promise<VerifyOutcome> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, error: "You are not signed in." };

    const loaded = await ctx.runQuery(internal.scripts.loadForRun, {
      scriptId: args.scriptId,
      ownerId: userId,
    });
    const context = await loadContext(ctx, userId);
    return await verifyScript(ctx, {
      ownerId: userId,
      projectId: loaded.script.projectId,
      scriptId: args.scriptId,
      context,
    });
  },
});
