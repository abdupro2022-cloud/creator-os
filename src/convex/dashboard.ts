import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { profileCompleteness } from "../lib/profile";

/**
 * One reactive query behind the Command Center so the first screen the creator
 * sees is a truthful snapshot of their real workspace — no fake metrics.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [projects, ideas, scripts, packs, runs, profileDoc, researchNotes] =
      await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(20),
      ctx.db
        .query("ideas")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(60),
      ctx.db
        .query("scripts")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(60),
      ctx.db
        .query("publishPacks")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(60),
      ctx.db
        .query("aiRuns")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(6),
      ctx.db
        .query("creatorProfiles")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .first(),
      ctx.db
        .query("researchNotes")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
        .order("desc")
        .take(60),
    ]);

    const ideaStatus = (status: string) =>
      ideas.filter((idea) => idea.status === status).length;
    const scriptStatus = (status: string) =>
      scripts.filter((script) => script.status === status).length;

    const projectNames = new Map(
      projects.map((project) => [project._id as string, project.name]),
    );

    const recentIdeas = await Promise.all(
      ideas.slice(0, 4).map(async (idea) => ({
        _id: idea._id,
        rawInput: idea.rawInput,
        status: idea.status,
        title: idea.refined?.title ?? null,
        angle: idea.refined?.angle ?? null,
        projectName: projectNames.get(idea.projectId) ?? "Unknown project",
        updatedAt: idea.updatedAt,
        errorMessage: idea.errorMessage ?? null,
      })),
    );

    const recentScripts = await Promise.all(
      scripts.slice(0, 4).map(async (script) => {
        const sections = await ctx.db
          .query("scriptSections")
          .withIndex("by_script", (q) => q.eq("scriptId", script._id))
          .collect();
        return {
          _id: script._id,
          title: script.title,
          status: script.status,
          wordCount: script.wordCount,
          estSeconds: script.estSeconds,
          targetDurationSec: script.targetDurationSec,
          updatedAt: script.updatedAt,
          sectionCount: sections.length,
          writtenCount: sections.filter((s) => s.status === "written").length,
          projectName: projectNames.get(script.projectId) ?? "Unknown project",
        };
      }),
    );

    const profile = profileDoc
      ? {
          language: profileDoc.language,
          dialect: profileDoc.dialect,
          tone: profileDoc.tone,
          pacing: profileDoc.pacing,
          storytelling: profileDoc.storytelling,
          audience: profileDoc.audience,
          targetLengthMin: profileDoc.targetLengthMin,
          hookStyles: profileDoc.hookStyles,
          prohibited: profileDoc.prohibited,
        }
      : null;

    const inFlightRuns = runs.filter((run) => run.status === "running").length;

    return {
      projects: projects.map((project) => ({
        _id: project._id,
        name: project.name,
        niche: project.niche ?? null,
        updatedAt: project.updatedAt,
      })),
      activeProjectId: projects[0]?._id ?? null,
      pipeline: {
        ideas: ideas.length,
        developed: ideaStatus("developed"),
        developing: ideaStatus("developing"),
        captured: ideaStatus("captured"),
        failedIdeas: ideaStatus("failed"),
        /** Sourced briefs — one per gather that passed the citation check. */
        research: researchNotes.length,
        scripts: scripts.length,
        drafting: scriptStatus("drafting"),
        drafts: scriptStatus("draft"),
        verified: scriptStatus("verified"),
        failedScripts: scriptStatus("failed"),
        /** One publish kit covers Shorts, SEO and publish at once. */
        kits: packs.length,
        kitsReady: packs.filter((pack) => pack.status === "ready").length,
        kitsFailed: packs.filter((pack) => pack.status === "failed").length,
      },
      recentIdeas,
      recentScripts,
      recentRuns: runs.map((run) => ({
        _id: run._id,
        kind: run.kind,
        status: run.status,
        model: run.model ?? null,
        provider: run.provider ?? null,
        latencyMs: run.latencyMs,
        promptTokens: run.promptTokens,
        completionTokens: run.completionTokens,
        errorMessage: run.errorMessage ?? null,
        createdAt: run.createdAt,
        steps: run.steps,
        candidates: run.candidates,
      })),
      inFlightRuns,
      profile: profile
        ? { ...profile, completeness: profileCompleteness(profile) }
        : null,
    };
  },
});
