import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { ideaStatusValidator, refinedIdeaValidator } from "./schema";
import type { Id } from "./_generated/dataModel";

/**
 * Ideas are the entry point of the pipeline. A raw spark is captured instantly
 * and then developed by the agent into a real angle — never the other way
 * around, so nothing is lost if a model call fails.
 */

const MAX_RAW = 4000;

/** Every owner gets one project so capture never blocks on setup. */
async function defaultProjectId(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Id<"projects">> {
  const existing = await ctx.db
    .query("projects")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .order("asc")
    .first();
  if (existing) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("projects", {
    ownerId: userId,
    name: "My channel",
    description:
      "Default workspace created automatically so ideas always have a home.",
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}

export const capture = mutation({
  args: {
    rawInput: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const raw = args.rawInput.trim();
    if (raw.length < 8) {
      throw new Error("Describe the idea in at least a few words.");
    }
    if (raw.length > MAX_RAW) {
      throw new Error(`Keep the idea under ${MAX_RAW} characters.`);
    }

    let projectId = args.projectId;
    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.ownerId !== userId) {
        throw new Error("Project not found");
      }
    } else {
      projectId = await defaultProjectId(ctx, userId);
    }

    const now = Date.now();
    const ideaId = await ctx.db.insert("ideas", {
      ownerId: userId,
      projectId,
      rawInput: raw,
      status: "captured",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(projectId, { updatedAt: now });
    return ideaId;
  },
});

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(ideaStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const base = args.projectId
      ? ctx.db
          .query("ideas")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
      : ctx.db
          .query("ideas")
          .withIndex("by_owner_created", (q) => q.eq("ownerId", userId));

    const ideas = await base.order("desc").take(100);
    const filtered = args.status
      ? ideas.filter((idea) => idea.status === args.status)
      : ideas;

    return await Promise.all(
      filtered.map(async (idea) => {
        const project = await ctx.db.get(idea.projectId);
        return {
          ...idea,
          projectName: project?.name ?? "Unknown project",
        };
      }),
    );
  },
});

export const get = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.ownerId !== userId) return null;
    const project = await ctx.db.get(idea.projectId);
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) => q.eq("projectId", idea.projectId))
      .collect();
    return {
      idea,
      project: project
        ? { _id: project._id, name: project.name, niche: project.niche }
        : null,
      linkedScripts: scripts
        .filter((script) => script.ideaId === idea._id)
        .map((script) => ({
          _id: script._id,
          title: script.title,
          status: script.status,
          wordCount: script.wordCount,
          estSeconds: script.estSeconds,
        })),
    };
  },
});

/** Editing the spark resets the development so no stale angle survives. */
export const updateRaw = mutation({
  args: { ideaId: v.id("ideas"), rawInput: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.ownerId !== userId) throw new Error("Idea not found");

    const raw = args.rawInput.trim();
    if (raw.length < 8) throw new Error("Describe the idea in at least a few words.");
    if (raw.length > MAX_RAW) {
      throw new Error(`Keep the idea under ${MAX_RAW} characters.`);
    }

    await ctx.db.patch(args.ideaId, {
      rawInput: raw,
      refined: undefined,
      status: "captured",
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
    return args.ideaId;
  },
});

export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.ownerId !== userId) throw new Error("Idea not found");
    await ctx.db.delete(args.ideaId);
    return true;
  },
});

/* ----------------------- agent core entry points ----------------------- */

export const loadForRun = internalQuery({
  args: { ideaId: v.id("ideas"), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.ownerId !== args.ownerId) {
      throw new Error("Idea not found");
    }
    const project = await ctx.db.get(idea.projectId);
    if (!project) throw new Error("The project for this idea no longer exists.");
    return { idea, project };
  },
});

export const markDeveloping = internalMutation({
  args: { ideaId: v.id("ideas"), runId: v.id("aiRuns") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      status: "developing",
      lastRunId: args.runId,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const applyRefined = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    runId: v.id("aiRuns"),
    refined: refinedIdeaValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      refined: args.refined,
      status: "developed",
      lastRunId: args.runId,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    runId: v.optional(v.id("aiRuns")),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) return;
    await ctx.db.patch(args.ideaId, {
      status: "failed",
      lastRunId: args.runId ?? idea.lastRunId,
      errorMessage: args.error.slice(0, 600),
      updatedAt: Date.now(),
    });
  },
});
