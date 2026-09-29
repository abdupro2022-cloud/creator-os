import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  chapterValidator,
  publishStatusValidator,
  shortCutValidator,
  thumbnailBriefValidator,
  titleOptionValidator,
} from "./schema";

/**
 * Publish kit persistence.
 *
 * One pack per script. Chapters always arrive from the deterministic chapter
 * planner and never from a model, so a timestamp stored here is arithmetic on
 * the real section durations rather than a number someone guessed.
 *
 * Nothing in this file uploads anything: the kit is copy the creator takes to
 * YouTube themselves.
 */

/* -------------------------------- queries -------------------------------- */

export const getForScript = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const script = await ctx.db.get(args.scriptId);
    if (!script || script.ownerId !== userId) return null;

    const [pack, sections] = await Promise.all([
      ctx.db
        .query("publishPacks")
        .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
        .first(),
      ctx.db
        .query("scriptSections")
        .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
        .collect(),
    ]);

    return {
      pack: pack ?? null,
      script: {
        _id: script._id,
        title: script.title,
        status: script.status,
        wordCount: script.wordCount,
        estSeconds: script.estSeconds,
        targetDurationSec: script.targetDurationSec,
        updatedAt: script.updatedAt,
      },
      sections: sections
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          _id: section._id,
          heading: section.heading,
          role: section.role,
          status: section.status,
          wordCount: section.wordCount,
          estSeconds: section.estSeconds,
        })),
      writtenCount: sections.filter((section) => section.status === "written").length,
    };
  },
});

/* ------------------------------- mutations ------------------------------- */

export const chooseTitle = mutation({
  args: { packId: v.id("publishPacks"), index: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pack = await ctx.db.get(args.packId);
    if (!pack || pack.ownerId !== userId) throw new Error("Publish kit not found");

    const index = Math.round(args.index);
    if (!Number.isFinite(index) || index < 0 || index >= pack.titles.length) {
      throw new Error("That title option does not exist.");
    }

    await ctx.db.patch(args.packId, {
      chosenTitleIndex: index,
      updatedAt: Date.now(),
    });
    return args.packId;
  },
});

export const deletePack = mutation({
  args: { packId: v.id("publishPacks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pack = await ctx.db.get(args.packId);
    if (!pack || pack.ownerId !== userId) throw new Error("Publish kit not found");
    await ctx.db.delete(args.packId);
    return true;
  },
});

/* ------------------------- agent core entry points ------------------------- */

export const loadForScript = internalQuery({
  args: { scriptId: v.id("scripts"), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script || script.ownerId !== args.ownerId) {
      throw new Error("Script not found");
    }
    const sections = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    return { script, sections: sections.sort((a, b) => a.order - b.order) };
  },
});

/**
 * Create the pack for a script, or reset an existing one to `generating` so a
 * rerun replaces the previous kit instead of stacking duplicates.
 */
export const startPack = internalMutation({
  args: {
    ownerId: v.id("users"),
    scriptId: v.id("scripts"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("publishPacks")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "generating",
        errorMessage: undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("publishPacks", {
      ownerId: args.ownerId,
      scriptId: args.scriptId,
      projectId: args.projectId,
      status: "generating",
      titles: [],
      description: "",
      tags: [],
      chapters: [],
      pinnedComment: "",
      shorts: [],
      titleIssues: [],
      metadataIssues: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const applyPack = internalMutation({
  args: {
    packId: v.id("publishPacks"),
    titles: v.array(titleOptionValidator),
    description: v.string(),
    tags: v.array(v.string()),
    chapters: v.array(chapterValidator),
    pinnedComment: v.string(),
    thumbnail: v.optional(thumbnailBriefValidator),
    shorts: v.array(shortCutValidator),
    titleIssues: v.array(v.string()),
    metadataIssues: v.array(v.string()),
    model: v.string(),
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    const pack = await ctx.db.get(args.packId);
    if (!pack) throw new Error("Publish kit not found");

    const chosen =
      pack.chosenTitleIndex !== undefined &&
      pack.chosenTitleIndex < args.titles.length
        ? pack.chosenTitleIndex
        : 0;

    await ctx.db.patch(args.packId, {
      status: "ready",
      titles: args.titles.slice(0, 6),
      chosenTitleIndex: chosen,
      description: args.description,
      tags: args.tags.slice(0, 40),
      chapters: args.chapters.slice(0, 60),
      pinnedComment: args.pinnedComment,
      thumbnail: args.thumbnail,
      shorts: args.shorts.slice(0, 8),
      titleIssues: args.titleIssues.slice(0, 20),
      metadataIssues: args.metadataIssues.slice(0, 20),
      model: args.model,
      lastRunId: args.runId,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
    return args.packId;
  },
});

export const failPack = internalMutation({
  args: {
    packId: v.id("publishPacks"),
    runId: v.optional(v.id("aiRuns")),
    error: v.string(),
    status: v.optional(publishStatusValidator),
  },
  handler: async (ctx, args) => {
    const pack = await ctx.db.get(args.packId);
    if (!pack) return;
    await ctx.db.patch(args.packId, {
      status: args.status ?? "failed",
      lastRunId: args.runId ?? pack.lastRunId,
      errorMessage: args.error.slice(0, 600),
      updatedAt: Date.now(),
    });
  },
});
