import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  sectionRoleValidator,
  scriptStatusValidator,
  verificationValidator,
} from "./schema";
import { countWords, estimateSeconds } from "../lib/script";

/**
 * Script Studio persistence.
 *
 * Word counts and duration estimates are always recomputed from the real text
 * with the same deterministic helpers the UI uses — a model never provides
 * metrics.
 */

type Ctx = MutationCtx;

async function recalcScript(ctx: Ctx, scriptId: Id<"scripts">) {
  const script = await ctx.db.get(scriptId);
  if (!script) return;
  const sections = await ctx.db
    .query("scriptSections")
    .withIndex("by_script", (q) => q.eq("scriptId", scriptId))
    .collect();

  const wordCount = sections.reduce((sum, section) => sum + section.wordCount, 0);
  const estSeconds = sections.reduce((sum, section) => sum + section.estSeconds, 0);
  const allWritten =
    sections.length > 0 && sections.every((section) => section.status === "written");

  const patch: Record<string, unknown> = {
    wordCount,
    estSeconds,
    updatedAt: Date.now(),
  };
  if (script.status === "drafting" && allWritten) patch.status = "draft";

  await ctx.db.patch(scriptId, patch);
}

async function reindex(ctx: Ctx, scriptId: Id<"scripts">) {
  const sections = await ctx.db
    .query("scriptSections")
    .withIndex("by_script", (q) => q.eq("scriptId", scriptId))
    .collect();
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].order !== index) {
      await ctx.db.patch(sorted[index]._id, { order: index });
    }
  }
}

function metricsFor(body: string, wpm: number) {
  const words = countWords(body);
  return { wordCount: words, estSeconds: estimateSeconds(words, wpm) };
}

interface SectionSnapshot {
  role: string;
  heading: string;
  intent?: string;
  body: string;
  notes?: string;
  targetWords: number;
}

function snapshotOf(sections: Doc<"scriptSections">[]): string {
  const payload: SectionSnapshot[] = sections.map((section) => ({
    role: section.role,
    heading: section.heading,
    intent: section.intent,
    body: section.body,
    notes: section.notes,
    targetWords: section.targetWords,
  }));
  return JSON.stringify({ sections: payload });
}

function parseSnapshot(raw: string): SectionSnapshot[] | null {
  try {
    const parsed = JSON.parse(raw) as { sections?: SectionSnapshot[] };
    if (!parsed || !Array.isArray(parsed.sections)) return null;
    return parsed.sections.filter((section) => typeof section?.heading === "string");
  } catch {
    return null;
  }
}

const MAX_TITLE = 160;

async function requireOwnedScript(
  ctx: Ctx,
  scriptId: Id<"scripts">,
  userId: Id<"users">,
): Promise<Doc<"scripts">> {
  const script = await ctx.db.get(scriptId);
  if (!script || script.ownerId !== userId) throw new Error("Script not found");
  return script;
}

/* -------------------------------- queries -------------------------------- */

export const list = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const scripts = args.projectId
      ? await ctx.db
          .query("scripts")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
          .order("desc")
          .take(60)
      : await ctx.db
          .query("scripts")
          .withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
          .order("desc")
          .take(60);

    return await Promise.all(
      scripts.map(async (script) => {
        const project = await ctx.db.get(script.projectId);
        const sections = await ctx.db
          .query("scriptSections")
          .withIndex("by_script", (q) => q.eq("scriptId", script._id))
          .collect();
        return {
          ...script,
          projectName: project?.name ?? "Unknown project",
          sectionCount: sections.length,
          writtenCount: sections.filter((s) => s.status === "written").length,
        };
      }),
    );
  },
});

export const get = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const script = await ctx.db.get(args.scriptId);
    if (!script || script.ownerId !== userId) return null;

    const [sections, revisions, project, idea] = await Promise.all([
      ctx.db
        .query("scriptSections")
        .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
        .collect(),
      ctx.db
        .query("scriptRevisions")
        .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
        .order("desc")
        .take(20),
      ctx.db.get(script.projectId),
      script.ideaId ? ctx.db.get(script.ideaId) : Promise.resolve(null),
    ]);

    return {
      script,
      sections: sections.sort((a, b) => a.order - b.order),
      revisions: revisions.map((revision) => ({
        _id: revision._id,
        label: revision.label,
        reason: revision.reason,
        wordCount: revision.wordCount,
        createdAt: revision.createdAt,
      })),
      project: project ? { _id: project._id, name: project.name } : null,
      idea: idea
        ? { _id: idea._id, rawInput: idea.rawInput, refined: idea.refined ?? null }
        : null,
    };
  },
});

/* ------------------------------- mutations ------------------------------- */

export const createManual = mutation({
  args: {
    title: v.string(),
    projectId: v.optional(v.id("projects")),
    ideaId: v.optional(v.id("ideas")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const title = args.title.trim();
    if (title.length < 2) throw new Error("Give the script a title.");
    if (title.length > MAX_TITLE) {
      throw new Error(`Titles are limited to ${MAX_TITLE} characters.`);
    }

    let projectId = args.projectId;
    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.ownerId !== userId) throw new Error("Project not found");
    } else {
      const owned = await ctx.db
        .query("projects")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .order("asc")
        .first();
      projectId =
        owned?._id ??
        (await ctx.db.insert("projects", {
          ownerId: userId,
          name: "My channel",
          archived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
    }

    const profile = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    const wpm = profile?.pacing === "slow" ? 130 : profile?.pacing === "fast" ? 175 : 150;
    const now = Date.now();

    const scriptId = await ctx.db.insert("scripts", {
      ownerId: userId,
      projectId,
      ideaId: args.ideaId,
      title,
      status: "draft",
      targetDurationSec: (profile?.targetLengthMin ?? 8) * 60,
      wordsPerMinute: wpm,
      wordCount: 0,
      estSeconds: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("scriptSections", {
      ownerId: userId,
      scriptId,
      projectId,
      order: 0,
      role: "hook",
      heading: "Hook",
      body: "",
      status: "queued",
      targetWords: 45,
      wordCount: 0,
      estSeconds: 0,
      updatedAt: now,
    });

    return scriptId;
  },
});

export const updateScript = mutation({
  args: {
    scriptId: v.id("scripts"),
    title: v.optional(v.string()),
    targetDurationSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireOwnedScript(ctx, args.scriptId, userId);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (title.length < 2) throw new Error("Title is too short.");
      patch.title = title.slice(0, MAX_TITLE);
    }
    if (args.targetDurationSec !== undefined) {
      patch.targetDurationSec = Math.min(7200, Math.max(15, Math.round(args.targetDurationSec)));
    }
    await ctx.db.patch(args.scriptId, patch);
    return args.scriptId;
  },
});

export const updateSection = mutation({
  args: {
    sectionId: v.id("scriptSections"),
    heading: v.optional(v.string()),
    body: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const section = await ctx.db.get(args.sectionId);
    if (!section || section.ownerId !== userId) throw new Error("Section not found");
    const script = await ctx.db.get(section.scriptId);
    if (!script) throw new Error("Script not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.heading !== undefined) {
      const heading = args.heading.trim();
      if (heading.length === 0) throw new Error("A section needs a heading.");
      patch.heading = heading.slice(0, 160);
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    let body = section.body;
    if (args.body !== undefined) {
      if (args.body.length > 40_000) throw new Error("That section is too long to save.");
      body = args.body;
      patch.body = args.body;
      Object.assign(patch, metricsFor(body, script.wordsPerMinute));
      if (args.body.trim().length > 0 && section.status !== "written") {
        patch.status = "written";
      }
    }

    await ctx.db.patch(args.sectionId, patch);
    await recalcScript(ctx, section.scriptId);
    return args.sectionId;
  },
});

export const addSection = mutation({
  args: {
    scriptId: v.id("scripts"),
    role: sectionRoleValidator,
    heading: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const script = await requireOwnedScript(ctx, args.scriptId, userId);

    const sections = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    if (sections.length >= 40) throw new Error("This script already has 40 sections.");

    const heading = args.heading.trim();
    if (heading.length === 0) throw new Error("A section needs a heading.");

    const sectionId = await ctx.db.insert("scriptSections", {
      ownerId: userId,
      scriptId: args.scriptId,
      projectId: script.projectId,
      order: sections.length,
      role: args.role,
      heading: heading.slice(0, 160),
      body: "",
      status: "queued",
      targetWords: 120,
      wordCount: 0,
      estSeconds: 0,
      updatedAt: Date.now(),
    });
    await recalcScript(ctx, args.scriptId);
    return sectionId;
  },
});

export const removeSection = mutation({
  args: { sectionId: v.id("scriptSections") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const section = await ctx.db.get(args.sectionId);
    if (!section || section.ownerId !== userId) throw new Error("Section not found");

    const remaining = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", section.scriptId))
      .collect();
    if (remaining.length <= 1) {
      throw new Error("A script needs at least one section.");
    }

    await ctx.db.delete(args.sectionId);
    await reindex(ctx, section.scriptId);
    await recalcScript(ctx, section.scriptId);
    return true;
  },
});

export const moveSection = mutation({
  args: {
    sectionId: v.id("scriptSections"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const section = await ctx.db.get(args.sectionId);
    if (!section || section.ownerId !== userId) throw new Error("Section not found");

    const sections = (
      await ctx.db
        .query("scriptSections")
        .withIndex("by_script", (q) => q.eq("scriptId", section.scriptId))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const index = sections.findIndex((s) => s._id === args.sectionId);
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return false;

    const swapped = [...sections];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    for (let i = 0; i < swapped.length; i += 1) {
      if (swapped[i].order !== i) await ctx.db.patch(swapped[i]._id, { order: i });
    }
    return true;
  },
});

export const deleteScript = mutation({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireOwnedScript(ctx, args.scriptId, userId);

    const sections = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    for (const section of sections) await ctx.db.delete(section._id);

    const revisions = await ctx.db
      .query("scriptRevisions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    for (const revision of revisions) await ctx.db.delete(revision._id);

    await ctx.db.delete(args.scriptId);
    return true;
  },
});

export const saveRevision = mutation({
  args: {
    scriptId: v.id("scripts"),
    label: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireOwnedScript(ctx, args.scriptId, userId);

    const sections = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    const revisions = await ctx.db
      .query("scriptRevisions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    if (revisions.length >= 25) {
      throw new Error("Revision limit reached (25). Delete an old revision first.");
    }

    return await ctx.db.insert("scriptRevisions", {
      ownerId: userId,
      scriptId: args.scriptId,
      label: args.label?.trim().slice(0, 60) || `v${revisions.length + 1}`,
      reason: args.reason?.trim().slice(0, 200) || "Manual save",
      snapshot: snapshotOf(sections),
      wordCount: sections.reduce((sum, section) => sum + section.wordCount, 0),
      createdAt: Date.now(),
    });
  },
});

export const restoreRevision = mutation({
  args: { revisionId: v.id("scriptRevisions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const revision = await ctx.db.get(args.revisionId);
    if (!revision || revision.ownerId !== userId) throw new Error("Revision not found");
    const script = await requireOwnedScript(ctx, revision.scriptId, userId);

    const snapshot = parseSnapshot(revision.snapshot);
    if (!snapshot || snapshot.length === 0) {
      throw new Error("That revision cannot be read.");
    }

    const existing = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", revision.scriptId))
      .collect();
    for (const section of existing) await ctx.db.delete(section._id);

    const now = Date.now();
    for (let index = 0; index < snapshot.length; index += 1) {
      const entry = snapshot[index];
      const role = (
        ["hook", "intro", "body", "cta", "outro"].includes(entry.role)
          ? entry.role
          : "body"
      ) as Doc<"scriptSections">["role"];
      const metrics = metricsFor(entry.body ?? "", script.wordsPerMinute);
      await ctx.db.insert("scriptSections", {
        ownerId: userId,
        scriptId: revision.scriptId,
        projectId: script.projectId,
        order: index,
        role,
        heading: entry.heading.slice(0, 160),
        intent: entry.intent?.slice(0, 400),
        body: entry.body ?? "",
        notes: entry.notes,
        status: (entry.body ?? "").trim().length > 0 ? "written" : "queued",
        targetWords: Math.max(30, Math.round(entry.targetWords ?? 120)),
        wordCount: metrics.wordCount,
        estSeconds: metrics.estSeconds,
        updatedAt: now,
      });
    }

    await recalcScript(ctx, revision.scriptId);
    return revision.scriptId;
  },
});

export const deleteRevision = mutation({
  args: { revisionId: v.id("scriptRevisions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const revision = await ctx.db.get(args.revisionId);
    if (!revision || revision.ownerId !== userId) throw new Error("Revision not found");
    await ctx.db.delete(args.revisionId);
    return true;
  },
});

/* ----------------------- agent core entry points ----------------------- */

export const loadForRun = internalQuery({
  args: { scriptId: v.id("scripts"), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script || script.ownerId !== args.ownerId) throw new Error("Script not found");
    const sections = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    return { script, sections: sections.sort((a, b) => a.order - b.order) };
  },
});

export const loadSectionForRun = internalQuery({
  args: { sectionId: v.id("scriptSections"), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section || section.ownerId !== args.ownerId) {
      throw new Error("Section not found");
    }
    const script = await ctx.db.get(section.scriptId);
    if (!script) throw new Error("Script not found");
    const siblings = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", section.scriptId))
      .collect();
    return {
      section,
      script,
      sections: siblings.sort((a, b) => a.order - b.order),
    };
  },
});

export const startDraft = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    ideaId: v.optional(v.id("ideas")),
    title: v.string(),
    targetDurationSec: v.number(),
    wordsPerMinute: v.number(),
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("scripts", {
      ownerId: args.ownerId,
      projectId: args.projectId,
      ideaId: args.ideaId,
      title: args.title.slice(0, MAX_TITLE),
      status: "drafting",
      targetDurationSec: args.targetDurationSec,
      wordsPerMinute: args.wordsPerMinute,
      wordCount: 0,
      estSeconds: 0,
      lastRunId: args.runId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const applyOutline = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    sections: v.array(
      v.object({
        role: sectionRoleValidator,
        heading: v.string(),
        intent: v.optional(v.string()),
        targetWords: v.number(),
      }),
    ),
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script) throw new Error("Script not found");

    const existing = await ctx.db
      .query("scriptSections")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();
    for (const section of existing) await ctx.db.delete(section._id);

    const now = Date.now();
    const createdIds: Id<"scriptSections">[] = [];
    for (let index = 0; index < args.sections.length; index += 1) {
      const section = args.sections[index];
      createdIds.push(
        await ctx.db.insert("scriptSections", {
          ownerId: script.ownerId,
          scriptId: args.scriptId,
          projectId: script.projectId,
          order: index,
          role: section.role,
          heading: section.heading.slice(0, 160),
          intent: section.intent?.slice(0, 400),
          body: "",
          status: "queued",
          targetWords: Math.max(30, Math.round(section.targetWords)),
          wordCount: 0,
          estSeconds: 0,
          updatedAt: now,
        }),
      );
    }

    await ctx.db.patch(args.scriptId, {
      status: "drafting",
      lastRunId: args.runId,
      errorMessage: undefined,
      verification: undefined,
      updatedAt: now,
    });
    await recalcScript(ctx, args.scriptId);
    return createdIds;
  },
});

export const markSectionWriting = internalMutation({
  args: { sectionId: v.id("scriptSections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sectionId, { status: "writing", updatedAt: Date.now() });
  },
});

export const applySectionDraft = internalMutation({
  args: {
    sectionId: v.id("scriptSections"),
    body: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    const script = await ctx.db.get(section.scriptId);
    if (!script) throw new Error("Script not found");

    const metrics = metricsFor(args.body, script.wordsPerMinute);
    await ctx.db.patch(args.sectionId, {
      body: args.body,
      notes: args.notes?.slice(0, 800) || section.notes,
      status: "written",
      wordCount: metrics.wordCount,
      estSeconds: metrics.estSeconds,
      updatedAt: Date.now(),
    });
    await recalcScript(ctx, section.scriptId);
  },
});

export const markSectionFailed = internalMutation({
  args: { sectionId: v.id("scriptSections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sectionId, { status: "failed", updatedAt: Date.now() });
  },
});

export const applyVerification = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    verification: verificationValidator,
    status: scriptStatusValidator,
    runId: v.id("aiRuns"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scriptId, {
      verification: args.verification,
      status: args.status,
      lastRunId: args.runId,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const failDraft = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    runId: v.optional(v.id("aiRuns")),
    error: v.string(),
    status: v.optional(scriptStatusValidator),
  },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script) return;
    await ctx.db.patch(args.scriptId, {
      status: args.status ?? "failed",
      lastRunId: args.runId ?? script.lastRunId,
      errorMessage: args.error.slice(0, 600),
      updatedAt: Date.now(),
    });
  },
});
