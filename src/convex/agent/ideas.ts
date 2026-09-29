"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { buildIdeaMessages } from "../../lib/ai/prompts";
import { ideaDevelopmentSchema, parseModelOutput } from "../../lib/ai/schemas";

/**
 * Agent core — idea development.
 *
 * Flow: load context -> route a model -> run it -> validate the JSON against a
 * schema -> persist. Every step is recorded on the run so the UI can show
 * "Planning / Analyzing / Saving" without ever exposing private reasoning.
 */
export const develop = action({
  args: { ideaId: v.id("ideas") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; model: string; provider: string; runId: string }
    | { ok: false; error: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, error: "You are not signed in." };

    const loaded = await ctx.runQuery(internal.ideas.loadForRun, {
      ideaId: args.ideaId,
      ownerId: userId,
    });
    const [settings, profile] = await Promise.all([
      ctx.runQuery(internal.settings.forUser, { ownerId: userId }),
      ctx.runQuery(internal.creatorProfile.forUser, { ownerId: userId }),
    ]);

    const runId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId: loaded.idea.projectId,
      kind: "idea_development",
      taskType: "idea_development",
      targetId: args.ideaId,
      routingReason: undefined,
    });
    await ctx.runMutation(internal.ideas.markDeveloping, {
      ideaId: args.ideaId,
      runId,
    });
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Planning",
      status: "done",
      detail: profile
        ? `Context loaded with your ${profile.language} style profile.`
        : "Context loaded. No creator style profile set yet.",
    });

    const result = await ctx.runAction(internal.agent.step.run, {
      taskType: "idea_development",
      messages: buildIdeaMessages({
        rawInput: loaded.idea.rawInput,
        projectName: loaded.project.name,
        niche: loaded.project.niche,
        profile,
      }),
      temperature: 0.7,
      maxTokens: 1800,
      preference: settings.routingPreference,
      preferredModelId: settings.ideaModel,
      extraModelIds: settings.extraModelIds,
    });

    if (!result.ok) {
      const failure = result.error ?? "The model call failed without an error message.";
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Analyzing",
        status: "failed",
        detail: failure.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: failure,
        targetId: args.ideaId,
      });
      await ctx.runMutation(internal.ideas.markFailed, {
        ideaId: args.ideaId,
        runId,
        error: failure,
      });
      return { ok: false, error: failure };
    }

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Analyzing",
      status: "done",
      detail: `${result.model} answered in ${(result.latencyMs / 1000).toFixed(1)}s.`,
    });

    const parsed = parseModelOutput(result.text, ideaDevelopmentSchema);
    if (!parsed.ok || !parsed.data) {
      const error = parsed.error ?? "The model returned an unusable response.";
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
        targetId: args.ideaId,
      });
      await ctx.runMutation(internal.ideas.markFailed, {
        ideaId: args.ideaId,
        runId,
        error,
      });
      return { ok: false, error };
    }

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: "done",
      detail: `${parsed.data.keyPoints.length} key points labelled, ${parsed.data.riskNotes.length} flagged for sourcing.`,
    });
    await ctx.runMutation(internal.ideas.applyRefined, {
      ideaId: args.ideaId,
      runId,
      refined: {
        ...parsed.data,
        model: result.model,
        generatedAt: Date.now(),
      },
    });
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Saving",
      status: "done",
      detail: "Development saved to this project.",
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
      targetId: args.ideaId,
    });

    return {
      ok: true,
      model: result.model,
      provider: result.provider,
      runId,
    };
  },
});
