import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const routingPreferenceValidator = v.union(
  v.literal("balanced"),
  v.literal("quality"),
  v.literal("speed"),
);

export interface EffectiveSettings {
  ideaModel?: string;
  scriptModel?: string;
  verificationModel?: string;
  routingPreference: "balanced" | "quality" | "speed";
  extraModelIds: string[];
  autoVerify: boolean;
  youtubeChannelId?: string;
  trackingSheetId?: string;
  trackingSheetTab?: string;
}

/** Read settings for any owner id — used by the agent core and by queries. */
async function readSettings(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<EffectiveSettings> {
  const doc = await ctx.db
    .query("settings")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .first();
  return {
    ideaModel: doc?.ideaModel || undefined,
    scriptModel: doc?.scriptModel || undefined,
    verificationModel: doc?.verificationModel || undefined,
    routingPreference: doc?.routingPreference ?? "balanced",
    extraModelIds: doc?.extraModelIds ?? [],
    autoVerify: doc?.autoVerify ?? true,
    youtubeChannelId: doc?.youtubeChannelId || undefined,
    trackingSheetId: doc?.trackingSheetId || undefined,
    trackingSheetTab: doc?.trackingSheetTab || undefined,
  };
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await readSettings(ctx, userId);
  },
});

export const forUser = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => readSettings(ctx, args.ownerId),
});

export const update = mutation({
  args: {
    ideaModel: v.optional(v.string()),
    scriptModel: v.optional(v.string()),
    verificationModel: v.optional(v.string()),
    routingPreference: v.optional(routingPreferenceValidator),
    extraModelIds: v.optional(v.array(v.string())),
    autoVerify: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const modelKeys = [
      "ideaModel",
      "scriptModel",
      "verificationModel",
    ] as const;
    for (const key of modelKeys) {
      const value = args[key];
      if (value === undefined) continue;
      const trimmed = value.trim();
      patch[key] = trimmed.length > 0 ? trimmed : undefined;
    }
    if (args.routingPreference !== undefined) {
      patch.routingPreference = args.routingPreference;
    }
    if (args.extraModelIds !== undefined) {
      patch.extraModelIds = args.extraModelIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .slice(0, 20);
    }
    if (args.autoVerify !== undefined) patch.autoVerify = args.autoVerify;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("settings", {
      ownerId: userId,
      ideaModel: args.ideaModel?.trim() || undefined,
      scriptModel: args.scriptModel?.trim() || undefined,
      verificationModel: args.verificationModel?.trim() || undefined,
      routingPreference: args.routingPreference ?? "balanced",
      extraModelIds: args.extraModelIds ?? [],
      autoVerify: args.autoVerify ?? true,
      updatedAt: Date.now(),
    });
  },
});
