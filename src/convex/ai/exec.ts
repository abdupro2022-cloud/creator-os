"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { vly } from "../../lib/vly-integrations";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * The only place in the codebase that talks to an AI provider.
 *
 * It runs in the Convex Node runtime, so the provider credential
 * (VLY_INTEGRATION_KEY) is never bundled into the browser. Everything above this
 * layer only deals in provider-agnostic model ids.
 */

const GATEWAY_BASE_URL = "https://integrations.vly.ai/v1/llm";

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

function explain(raw: string): string {
  if (/401|403|unauthor|invalid api key|authentication/i.test(raw)) {
    return `${raw} — the AI gateway rejected the credential. Check that the platform AI integration is provisioned for this project (VLY_INTEGRATION_KEY).`;
  }
  if (/not found/i.test(raw)) {
    return `${raw} — pick a different model in Settings.`;
  }
  if (/timeout|timed out|ETIMEDOUT|fetch failed/i.test(raw)) {
    return `${raw} — the AI gateway was unreachable or too slow. Retry, or switch to a faster model in Settings.`;
  }
  return raw;
}

export const complete = internalAction({
  args: {
    model: v.string(),
    messages: messagesValidator,
    temperature: v.number(),
    maxTokens: v.number(),
  },
  handler: async (_ctx, args) => {
    const startedAt = Date.now();

    if (!process.env.VLY_INTEGRATION_KEY) {
      return {
        ok: false as const,
        latencyMs: 0,
        error:
          "VLY_INTEGRATION_KEY is not set on the Convex deployment, so no AI provider can be reached. Add the platform integration key in the Keys tab.",
      };
    }

    try {
      const result = await vly.ai.completion({
        model: args.model,
        messages: args.messages,
        temperature: args.temperature,
        maxTokens: Math.max(16, Math.round(args.maxTokens)),
      });

      const latencyMs = Date.now() - startedAt;

      if (!result.success || !result.data) {
        return {
          ok: false as const,
          latencyMs,
          error: explain(result.error ?? "The AI gateway returned an empty response."),
        };
      }

      const text = result.data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) {
        return {
          ok: false as const,
          latencyMs,
          error: "The model returned an empty completion.",
        };
      }

      return {
        ok: true as const,
        text,
        latencyMs,
        promptTokens: result.data.usage?.promptTokens ?? 0,
        completionTokens: result.data.usage?.completionTokens ?? 0,
      };
    } catch (error) {
      return {
        ok: false as const,
        latencyMs: Date.now() - startedAt,
        error: explain(
          error instanceof Error ? error.message : "Unknown provider error.",
        ),
      };
    }
  },
});

/**
 * Ask the gateway which models it can actually serve, so Settings shows real
 * availability instead of a hard-coded wish list.
 */
export const listModels = internalAction({
  args: {},
  handler: async () => {
    const token = process.env.VLY_INTEGRATION_KEY;
    if (!token) {
      return {
        ok: false as const,
        models: [] as string[],
        error: "VLY_INTEGRATION_KEY is not set on this deployment.",
      };
    }
    try {
      const response = await fetch(`${GATEWAY_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return {
          ok: false as const,
          models: [] as string[],
          error: `The gateway responded ${response.status} to a model list request.`,
        };
      }
      const payload = (await response.json()) as {
        data?: { id?: string }[];
        models?: { id?: string }[];
      };
      const raw = payload.data ?? payload.models ?? [];
      const models = raw
        .map((entry) => entry?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .sort();
      return { ok: true as const, models, error: undefined };
    } catch (error) {
      return {
        ok: false as const,
        models: [] as string[],
        error:
          error instanceof Error
            ? `Could not reach the gateway: ${error.message}`
            : "Could not reach the gateway.",
      };
    }
  },
});

interface InventoryResult {
  ok: boolean;
  count: number;
  providers: { provider: string; count: number }[];
  error?: string;
}

/**
 * Signed-in wrapper so Settings can show which models this deployment can
 * actually reach instead of trusting a static list.
 */
export const inventory = action({
  args: {},
  handler: async (ctx): Promise<InventoryResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, count: 0, providers: [], error: "You are not signed in." };
    }
    const result = await ctx.runAction(internal.ai.exec.listModels, {});
    if (!result.ok) {
      return { ok: false, count: 0, providers: [], error: result.error };
    }
    const counts = new Map<string, number>();
    for (const id of result.models) {
      const provider = id.includes("/") ? id.split("/")[0] : "unqualified";
      counts.set(provider, (counts.get(provider) ?? 0) + 1);
    }
    return {
      ok: true,
      count: result.models.length,
      providers: [...counts.entries()]
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});
