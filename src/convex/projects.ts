import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Projects are the context boundary: ideas, scripts and runs always belong to
 * exactly one project so unrelated work is never mixed together.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(50);

    return await Promise.all(
      projects.map(async (project) => {
        const ideas = await ctx.db
          .query("ideas")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const scripts = await ctx.db
          .query("scripts")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        return {
          ...project,
          ideaCount: ideas.length,
          scriptCount: scripts.length,
          developedCount: ideas.filter((idea) => idea.status === "developed")
            .length,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    niche: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("Give the project a name with at least 2 characters.");
    }
    if (name.length > 80) {
      throw new Error("Project names are limited to 80 characters.");
    }

    const now = Date.now();
    return await ctx.db.insert("projects", {
      ownerId: userId,
      name,
      description: args.description?.trim() || undefined,
      niche: args.niche?.trim() || undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    niche: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error("Project not found");
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2) throw new Error("Project name is too short.");
      patch.name = name.slice(0, 80);
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.niche !== undefined) {
      patch.niche = args.niche.trim() || undefined;
    }
    if (args.archived !== undefined) patch.archived = args.archived;

    await ctx.db.patch(args.projectId, patch);
    return args.projectId;
  },
});

/** Deletes a project together with everything that belongs to it. */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error("Project not found");
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const idea of ideas) await ctx.db.delete(idea._id);

    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const script of scripts) {
      const sections = await ctx.db
        .query("scriptSections")
        .withIndex("by_script", (q) => q.eq("scriptId", script._id))
        .collect();
      for (const section of sections) await ctx.db.delete(section._id);
      const revisions = await ctx.db
        .query("scriptRevisions")
        .withIndex("by_script", (q) => q.eq("scriptId", script._id))
        .collect();
      for (const revision of revisions) await ctx.db.delete(revision._id);
      await ctx.db.delete(script._id);
    }

    await ctx.db.delete(args.projectId);
    return { removedIdeas: ideas.length, removedScripts: scripts.length };
  },
});
