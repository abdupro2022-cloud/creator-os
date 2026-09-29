import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { StyleProfileInput } from "../lib/ai/prompts";

export const pacingValidator = v.union(
  v.literal("slow"),
  v.literal("medium"),
  v.literal("fast"),
);

export interface ProfileDefaults {
  displayName?: string;
  language: string;
  dialect: string;
  tone: string[];
  pacing: "slow" | "medium" | "fast";
  storytelling: string[];
  audience: string;
  targetLengthMin: number;
  hookStyles: string[];
  prohibited: string[];
  notes?: string;
}

/**
 * One creator identity per account. This profile is injected into every model
 * call, which is what makes outputs sound like the creator instead of a
 * generic assistant.
 */
async function readProfile(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<ProfileDefaults | null> {
  const doc = await ctx.db
    .query("creatorProfiles")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!doc) return null;
  return {
    displayName: doc.displayName,
    language: doc.language,
    dialect: doc.dialect,
    tone: doc.tone,
    pacing: doc.pacing,
    storytelling: doc.storytelling,
    audience: doc.audience,
    targetLengthMin: doc.targetLengthMin,
    hookStyles: doc.hookStyles,
    prohibited: doc.prohibited,
    notes: doc.notes,
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await readProfile(ctx, userId);
  },
});

export const forUser = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args): Promise<StyleProfileInput | null> => {
    const profile = await readProfile(ctx, args.ownerId);
    if (!profile) return null;
    return profile;
  },
});

export const upsert = mutation({
  args: {
    displayName: v.optional(v.string()),
    language: v.string(),
    dialect: v.string(),
    tone: v.array(v.string()),
    pacing: pacingValidator,
    storytelling: v.array(v.string()),
    audience: v.string(),
    targetLengthMin: v.number(),
    hookStyles: v.array(v.string()),
    prohibited: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const clean = (values: string[]) =>
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, 24);

    const payload = {
      ownerId: userId,
      displayName: args.displayName?.trim() || undefined,
      language: args.language.trim() || "Arabic",
      dialect: args.dialect.trim(),
      tone: clean(args.tone),
      pacing: args.pacing,
      storytelling: clean(args.storytelling),
      audience: args.audience.trim(),
      targetLengthMin: Math.min(180, Math.max(1, Math.round(args.targetLengthMin))),
      hookStyles: clean(args.hookStyles),
      prohibited: clean(args.prohibited),
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    };

    const existing = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("creatorProfiles", payload);
  },
});
