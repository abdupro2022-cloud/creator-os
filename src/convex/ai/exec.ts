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
 * Direct provider calls, used only as a last resort.
 *
 * The gateway is the primary path because it needs one credential and routes
 * by capability. But the creator may also hold their own keys for DeepSeek,
 * Gemini or OpenRouter, and when the gateway is down or a model id is dead
 * those keys are the difference between a finished draft and a failed run.
 * They are tried after every gateway candidate has failed, never before, so a
 * healthy gateway is not paid for twice.
 */

const DIRECT_PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    queryKey: false,
  },
  gemini: {
    label: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    model: "gemini-2.5-flash",
    queryKey: true,
  },
  openrouter: {
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "anthropic/claude-haiku-4.5",
    queryKey: false,
  },
} as const;

type DirectProviderId = keyof typeof DIRECT_PROVIDERS;

export const directProviders = internalAction({
  args: {},
  handler: async (): Promise<{ id: DirectProviderId; label: string; model: string }[]> => {
    return (Object.keys(DIRECT_PROVIDERS) as DirectProviderId[])
      .filter((id) => Boolean(process.env[DIRECT_PROVIDERS[id].envVar]?.trim()))
      .map((id) => ({
        id,
        label: DIRECT_PROVIDERS[id].label,
        model: DIRECT_PROVIDERS[id].model,
      }));
  },
});

export const completeDirect = internalAction({
  args: {
    provider: v.string(),
    messages: messagesValidator,
    temperature: v.number(),
    maxTokens: v.number(),
  },
  handler: async (_ctx, args) => {
    const startedAt = Date.now();
    const provider = DIRECT_PROVIDERS[args.provider as DirectProviderId];
    if (!provider) {
      return {
        ok: false as const,
        latencyMs: 0,
        error: `Unknown direct provider "${args.provider}".`,
      };
    }
    const key = process.env[provider.envVar]?.trim();
    if (!key) {
      return {
        ok: false as const,
        latencyMs: 0,
        error: `${provider.envVar} is not set on this deployment.`,
      };
    }

    // Gemini speaks a different request shape and returns a different envelope,
    // so it gets its own body rather than being forced through the OpenAI one.
    const isGemini = args.provider === "gemini";
    const url = provider.queryKey
      ? `${provider.url}?key=${encodeURIComponent(key)}`
      : provider.url;
    const body = isGemini
      ? {
          contents: args.messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
          systemInstruction: {
            parts: [
              {
                text:
                  args.messages.find((message) => message.role === "system")
                    ?.content ?? "",
              },
            ],
          },
          generationConfig: {
            temperature: args.temperature,
            maxOutputTokens: Math.max(16, Math.round(args.maxTokens)),
          },
        }
      : {
          model: provider.model,
          messages: args.messages,
          temperature: args.temperature,
          max_tokens: Math.max(16, Math.round(args.maxTokens)),
        };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(isGemini ? {} : { Authorization: `Bearer ${key}` }),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      const raw = await response.text().catch(() => "");
      if (!response.ok) {
        return {
          ok: false as const,
          latencyMs: Date.now() - startedAt,
          error: `${provider.label} answered HTTP ${response.status}: ${explain(raw)}`,
        };
      }

      const payload = JSON.parse(raw) as {
        choices?: { message?: { content?: string } }[];
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const text = isGemini
        ? (payload.candidates?.[0]?.content?.parts ?? [])
            .map((part) => part.text ?? "")
            .join("")
        : (payload.choices?.[0]?.message?.content ?? "");

      if (!text.trim()) {
        return {
          ok: false as const,
          latencyMs: Date.now() - startedAt,
          error: `${provider.label} returned an empty completion.`,
        };
      }

      return {
        ok: true as const,
        text,
        latencyMs: Date.now() - startedAt,
        promptTokens:
          payload.usage?.prompt_tokens ?? payload.usageMetadata?.promptTokenCount ?? 0,
        completionTokens:
          payload.usage?.completion_tokens ??
          payload.usageMetadata?.candidatesTokenCount ??
          0,
      };
    } catch (error) {
      return {
        ok: false as const,
        latencyMs: Date.now() - startedAt,
        error: explain(
          error instanceof Error ? error.message : `${provider.label} failed.`,
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
