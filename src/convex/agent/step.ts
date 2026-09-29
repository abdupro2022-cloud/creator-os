import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { routeModel } from "../../lib/ai/router";

/**
 * Agent core — one routed model step.
 *
 * Routing decides which models may answer (by task type, required capability,
 * cost/speed bias and the creator's pinned model), then the candidates are
 * tried in order so an unavailable provider degrades into a real answer from
 * the fallback instead of a hard failure.
 *
 * Every attempt is reported back so the caller can persist an honest log.
 */

interface StepAttempt {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface StepOutcome {
  ok: boolean;
  text: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  candidates: StepAttempt[];
  routingReason: string;
  error?: string;
}

interface ExecOutcome {
  ok: boolean;
  text?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}

const messagesValidator = v.array(
  v.object({
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
    ),
    content: v.string(),
  }),
);

const taskTypeValidator = v.union(
  v.literal("idea_development"),
  v.literal("script_outline"),
  v.literal("script_writing"),
  v.literal("verification"),
  v.literal("publish_pack"),
);

const preferenceValidator = v.union(
  v.literal("balanced"),
  v.literal("quality"),
  v.literal("speed"),
);

export const run = internalAction({
  args: {
    taskType: taskTypeValidator,
    messages: messagesValidator,
    temperature: v.number(),
    maxTokens: v.number(),
    preference: v.optional(preferenceValidator),
    preferredModelId: v.optional(v.string()),
    extraModelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<StepOutcome> => {
    const startedAt = Date.now();
    const decision = routeModel({
      taskType: args.taskType,
      preference: args.preference,
      preferredModelId: args.preferredModelId,
      extraModelIds: args.extraModelIds ?? [],
      maxCandidates: 2,
    });

    const attempts: StepAttempt[] = [];
    let lastError = "No model candidate was available for this task.";

    for (const candidate of decision.candidates) {
      const attempt: ExecOutcome = await ctx.runAction(
        internal.ai.exec.complete,
        {
          model: candidate.id,
          messages: args.messages,
          temperature: args.temperature,
          maxTokens: args.maxTokens,
        },
      );

      if (attempt.ok && attempt.text) {
        attempts.push({
          provider: candidate.provider,
          model: candidate.id,
          ok: true,
          latencyMs: attempt.latencyMs,
        });
        return {
          ok: true,
          text: attempt.text,
          provider: candidate.provider,
          model: candidate.id,
          promptTokens: attempt.promptTokens ?? 0,
          completionTokens: attempt.completionTokens ?? 0,
          latencyMs: Date.now() - startedAt,
          candidates: attempts,
          routingReason: decision.reason,
        };
      }

      lastError = attempt.error ?? "The provider returned an unusable response.";
      attempts.push({
        provider: candidate.provider,
        model: candidate.id,
        ok: false,
        latencyMs: attempt.latencyMs,
        error: lastError,
      });
    }

    return {
      ok: false,
      text: "",
      provider: "",
      model: "",
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - startedAt,
      candidates: attempts,
      routingReason: decision.reason,
      error: lastError,
    };
  },
});
