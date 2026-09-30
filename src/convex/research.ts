"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { z } from "zod";
import { buildResearchMessages } from "../lib/ai/prompts";
import { parseModelOutput } from "../lib/ai/schemas";
import { callTool, type CitationCheck } from "../lib/tools/registry";

/**
 * Research — the stage that used to be a placeholder.
 *
 * Material only enters the product through a real HTTP call to a vendor the
 * creator has a key for: Tavily for search, Supadata for a video transcript,
 * Firecrawl for a page. Nothing is summarised from memory — if a key is
 * missing the request fails loudly instead of producing an unsourced brief.
 *
 * The three providers are deliberately kept apart from the model gateway: a
 * search key and a language-model key are different products, and only the
 * latter is needed for the writing that follows.
 */

const TAVILY_URL = "https://api.tavily.com/search";
const SUPADATA_URL = "https://api.supadata.ai/v1/transcript";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

/** Never let one vendor stall the whole request. */
const TIMEOUT_MS = 25_000;

const MAX_SNIPPET = 600;
const MAX_SOURCES = 8;
const MAX_TRANSCRIPT_CHARS = 24_000;

/**
 * A research brief written only from fetched material.
 *
 * `findings` must end with the citation numbers they came from; the
 * deterministic citation checker rejects the whole brief when a number has no
 * source behind it.
 */
const researchBriefSchema = z.object({
  summary: z.string().min(20),
  findings: z.array(z.string().min(1)).min(1).max(10),
  gaps: z.array(z.string()).default([]),
});

export interface FetchedSource {
  title: string;
  url: string;
  snippet: string;
}

function trim(text: string, limit: number): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

function requireKey(name: string, tool: string): string {
  const value = process.env[name];
  const key = value?.trim();
  if (!key) {
    throw new Error(
      `${name} is not set on this deployment, so ${tool} cannot run. Add it in the project's Keys tab.`,
    );
  }
  return key;
}

function vendorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      detail?: string;
      message?: string;
    };
    const message =
      typeof parsed.error === "string"
        ? parsed.error
        : (parsed.error?.message ?? parsed.detail ?? parsed.message);
    if (message) return message.slice(0, 240);
  } catch {
    // Not JSON.
  }
  if (status === 401 || status === 403) return "The vendor rejected the key.";
  if (status === 429) return "Rate limited or out of credits.";
  return `The vendor answered with HTTP ${status}.`;
}

async function readResponse(response: Response): Promise<string> {
  return await response.text().catch(() => "");
}

/** Tavily: a real web search. The URLs below are the vendor's, not ours. */
async function searchWeb(query: string): Promise<FetchedSource[]> {
  const key = requireKey("TAVILY_API_KEY", "web search");
  const response = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: MAX_SOURCES,
      search_depth: "advanced",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await readResponse(response);
  if (!response.ok) {
    throw new Error(`Tavily search failed: ${vendorMessage(response.status, body)}`);
  }

  const parsed = JSON.parse(body) as {
    results?: { title?: string; url?: string; content?: string }[];
  };
  const sources: FetchedSource[] = [];
  for (const result of parsed.results ?? []) {
    if (!result.url) continue;
    sources.push({
      title: trim(result.title ?? result.url, 160),
      url: result.url,
      snippet: trim(result.content ?? "", MAX_SNIPPET),
    });
    if (sources.length >= MAX_SOURCES) break;
  }
  if (sources.length === 0) {
    throw new Error("Tavily returned no results for that query.");
  }
  return sources;
}

/** Supadata: the spoken transcript of one video, so a reference becomes input. */
async function fetchTranscript(url: string): Promise<FetchedSource[]> {
  const key = requireKey("SUPADATA_API_KEY", "video transcripts");
  const response = await fetch(SUPADATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({ url, text_only: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await readResponse(response);
  if (!response.ok) {
    throw new Error(
      `Supadata transcript failed: ${vendorMessage(response.status, body)}`,
    );
  }

  const parsed = JSON.parse(body) as {
    title?: string;
    text?: string;
    transcript?: string;
    error?: string;
  };
  const text = parsed.text ?? parsed.transcript ?? "";
  if (!text.trim()) {
    throw new Error(
      parsed.error?.slice(0, 200) ??
        "Supadata returned an empty transcript for that video.",
    );
  }

  return [
    {
      title: trim(parsed.title ?? "Video transcript", 160),
      url,
      snippet: trim(text, MAX_TRANSCRIPT_CHARS),
    },
  ];
}

/** Firecrawl: one page rendered to markdown, JavaScript included. */
async function readPage(url: string): Promise<FetchedSource[]> {
  const key = requireKey("FIRECRAWL_API_KEY", "page reading");
  const response = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await readResponse(response);
  if (!response.ok) {
    throw new Error(`Firecrawl failed: ${vendorMessage(response.status, body)}`);
  }

  const parsed = JSON.parse(body) as {
    success?: boolean;
    data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
    error?: string;
  };
  const markdown = parsed.data?.markdown ?? "";
  if (!markdown.trim()) {
    throw new Error(
      parsed.error?.slice(0, 200) ?? "Firecrawl returned no readable text.",
    );
  }

  return [
    {
      title: trim(
        parsed.data?.metadata?.title ?? parsed.data?.metadata?.sourceURL ?? url,
        160,
      ),
      url: parsed.data?.metadata?.sourceURL ?? url,
      snippet: trim(markdown, MAX_SNIPPET),
    },
  ];
}

async function gather(
  kind: "web" | "transcript" | "page",
  input: string,
): Promise<FetchedSource[]> {
  if (kind === "web") return await searchWeb(input);
  if (kind === "transcript") return await fetchTranscript(input);
  return await readPage(input);
}

const KIND_HINT: Record<"web" | "transcript" | "page", string> = {
  web: "a question or topic to search the web for",
  transcript: "the full YouTube URL of a reference video",
  page: "the URL of a page to read",
};

export interface ResearchOutcome {
  ok: boolean;
  noteId?: string;
  sourceCount?: number;
  dangling?: number;
  model?: string;
  error?: string;
}

/* --------------------------------- gather -------------------------------- */

export const gatherSources = action({
  args: {
    kind: v.union(v.literal("web"), v.literal("transcript"), v.literal("page")),
    input: v.string(),
    ideaId: v.optional(v.id("ideas")),
  },
  handler: async (ctx, args): Promise<ResearchOutcome> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, error: "You are not signed in." };

    const input = args.input.trim();
    if (input.length < 3) {
      return { ok: false, error: `Enter ${KIND_HINT[args.kind]}.` };
    }
    if (args.kind !== "web" && !/^https?:\/\//i.test(input)) {
      return { ok: false, error: "That must be a full http(s) URL." };
    }

    // The idea, when given, is the only place a note may be filed.
    const linked = args.ideaId
      ? await ctx.runQuery(internal.researchStore.ideaProject, {
          ideaId: args.ideaId,
          ownerId: userId,
        })
      : null;
    if (args.ideaId && !linked) {
      return { ok: false, error: "That idea no longer exists." };
    }
    const projectId: Id<"projects"> =
      linked?.projectId ??
      (await ctx.runMutation(internal.researchStore.defaultProject, {
        ownerId: userId,
      }));

    const runId = await ctx.runMutation(internal.runs.start, {
      ownerId: userId,
      projectId,
      kind: "research",
      taskType: "research",
      targetId: args.ideaId,
    });
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Planning",
      status: "done",
      detail: `Fetching real material for: ${input.slice(0, 120)}`,
    });

    let sources: FetchedSource[];
    try {
      sources = await gather(args.kind, input);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The provider call failed.";
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Analyzing",
        status: "failed",
        detail: message.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        candidates: [],
        errorMessage: message,
        targetId: args.ideaId,
      });
      return { ok: false, error: message };
    }

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Analyzing",
      status: "done",
      detail: `${sources.length} source(s) fetched with real URLs.`,
    });

    const [settings, profile] = await Promise.all([
      ctx.runQuery(internal.settings.forUser, { ownerId: userId }),
      ctx.runQuery(internal.creatorProfile.forUser, { ownerId: userId }),
    ]);

    const result = await ctx.runAction(internal.agent.step.run, {
      taskType: "idea_development",
      messages: buildResearchMessages({
        query: input,
        kind: args.kind,
        sources,
        profile,
      }),
      temperature: 0.3,
      maxTokens: 1600,
      preference: settings.routingPreference,
      preferredModelId: settings.ideaModel,
      extraModelIds: settings.extraModelIds,
    });

    if (!result.ok) {
      const message = result.error ?? "The model call failed.";
      await ctx.runMutation(internal.runs.step, {
        runId,
        label: "Verifying",
        status: "failed",
        detail: message.slice(0, 240),
      });
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: message,
        targetId: args.ideaId,
      });
      return { ok: false, error: message };
    }

    const parsed = parseModelOutput(result.text, researchBriefSchema);
    if (!parsed.ok || !parsed.data) {
      const message = parsed.error ?? "The model returned an unusable brief.";
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: message,
        targetId: args.ideaId,
      });
      return { ok: false, error: message };
    }

    // The deterministic half: a citation with no source behind it is a defect,
    // so it is measured here rather than trusted.
    const check: CitationCheck = (
      await callTool("research.citation_check", {
        summary: parsed.data.summary,
        sources: sources.map((source) => ({
          title: source.title,
          url: source.url,
        })),
      })
    ).data as CitationCheck;

    const dangling = check?.dangling ?? [];
    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Verifying",
      status: dangling.length > 0 ? "failed" : "done",
      detail:
        dangling.length > 0
          ? `${dangling.length} citation(s) had no source: [${dangling.join("], [")}].`
          : `${check?.cited.length ?? 0} citation(s) checked against ${sources.length} real source(s).`,
    });

    if (dangling.length > 0) {
      const message = `The model cited [${dangling.join("], [")}], which no fetched source backs. The brief was not saved.`;
      await ctx.runMutation(internal.runs.finish, {
        runId,
        status: "failed",
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        candidates: result.candidates,
        errorMessage: message,
        targetId: args.ideaId,
      });
      return { ok: false, error: message };
    }

    const noteId = await ctx.runMutation(internal.researchStore.saveNote, {
      ownerId: userId,
      projectId,
      ideaId: args.ideaId,
      kind: args.kind,
      input,
      summary: parsed.data.summary,
      findings: parsed.data.findings,
      sources,
      gaps: parsed.data.gaps,
      model: result.model,
      runId,
    });

    await ctx.runMutation(internal.runs.step, {
      runId,
      label: "Saving",
      status: "done",
      detail: `Brief saved with ${sources.length} openable source(s).`,
    });
    await ctx.runMutation(internal.runs.finish, {
      runId,
      status: "completed",
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: result.latencyMs,
      candidates: result.candidates,
      targetId: args.ideaId,
    });

    return {
      ok: true,
      noteId,
      sourceCount: sources.length,
      dangling: 0,
      model: result.model,
    };
  },
});
