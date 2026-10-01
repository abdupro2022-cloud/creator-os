import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/**
 * Research persistence.
 *
 * Kept apart from `research.ts` on purpose: the gathering action needs the Node
 * runtime to read keys from the environment, and a Node module may only define
 * actions, so the reads and writes live here.
 */

/* -------------------------------- queries -------------------------------- */

export const forIdea = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const notes = await ctx.db
      .query("researchNotes")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .order("desc")
      .take(10);
    return notes.filter((note) => note.ownerId === userId);
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("researchNotes")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(Math.min(args.limit ?? 10, 30));
  },
});

/* --------------------------- agent core entry --------------------------- */

export const ideaProject = internalQuery({
  args: { ideaId: v.id("ideas"), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.ownerId !== args.ownerId) return null;
    return { projectId: idea.projectId };
  },
});

export const defaultProject = internalMutation({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("asc")
      .first();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("projects", {
      ownerId: args.ownerId,
      name: "My channel",
      description: "Default workspace created automatically.",
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveNote = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    ideaId: v.optional(v.id("ideas")),
    kind: v.union(v.literal("web"), v.literal("transcript"), v.literal("page")),
    input: v.string(),
    summary: v.string(),
    findings: v.array(v.string()),
    sources: v.array(
      v.object({ title: v.string(), url: v.string(), snippet: v.string() }),
    ),
    gaps: v.array(v.string()),
    model: v.string(),
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("researchNotes", {
      ownerId: args.ownerId,
      projectId: args.projectId,
      ideaId: args.ideaId,
      kind: args.kind,
      input: args.input,
      summary: args.summary,
      findings: args.findings.slice(0, 10),
      sources: args.sources.slice(0, 12),
      // Gaps are part of the brief: an unanswered question is a result.
      gaps: args.gaps.slice(0, 10),
      model: args.model,
      lastRunId: args.runId,
      createdAt: Date.now(),
    });
  },
});
