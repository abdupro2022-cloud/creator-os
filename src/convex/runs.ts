import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import {
  runCandidateValidator,
  runKindValidator,
  runStatusValidator,
  runStepLabelValidator,
} from "./schema";

const stepStatusValidator = v.union(
  v.literal("started"),
  v.literal("done"),
  v.literal("failed"),
);

/**
 * Every model call is recorded here: which model answered, how long it took,
 * how many tokens it used and the safe progress labels the UI may display.
 * Private reasoning is never stored.
 */

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("aiRuns")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(Math.min(args.limit ?? 8, 30));
  },
});

export const latestForTarget = query({
  args: { targetId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("aiRuns")
      .withIndex("by_target", (q) =>
        q.eq("ownerId", userId).eq("targetId", args.targetId),
      )
      .order("desc")
      .first();
  },
});

export const start = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    kind: runKindValidator,
    taskType: v.string(),
    targetId: v.optional(v.string()),
    routingReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiRuns", {
      ownerId: args.ownerId,
      projectId: args.projectId,
      kind: args.kind,
      status: "running",
      taskType: args.taskType,
      steps: [],
      candidates: [],
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      routingReason: args.routingReason,
      targetId: args.targetId,
      createdAt: now,
    });
  },
});

export const step = internalMutation({
  args: {
    runId: v.id("aiRuns"),
    label: runStepLabelValidator,
    status: stepStatusValidator,
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    const next = [
      ...run.steps,
      {
        label: args.label,
        status: args.status,
        detail: args.detail,
        at: Date.now(),
      },
    ];
    await ctx.db.patch(args.runId, { steps: next.slice(-40) });
  },
});

export const finish = internalMutation({
  args: {
    runId: v.id("aiRuns"),
    status: runStatusValidator,
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    latencyMs: v.number(),
    candidates: v.array(runCandidateValidator),
    errorMessage: v.optional(v.string()),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    await ctx.db.patch(args.runId, {
      status: args.status,
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      latencyMs: args.latencyMs,
      candidates: args.candidates,
      errorMessage: args.errorMessage,
      targetId: args.targetId ?? run.targetId,
      finishedAt: Date.now(),
    });
  },
});
