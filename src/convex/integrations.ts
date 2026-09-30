"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * External tool connections.
 *
 * Secrets live in the platform's environment (the Keys tab), never in this
 * codebase and never in the browser. What this module does is report whether a
 * key is *present*, and — where the vendor has a cheap authenticated endpoint —
 * prove that it actually works. A key is never echoed back, not even fully: the
 * most this returns is the last four characters, so the creator can tell two
 * keys apart without the value ever reaching the page.
 */

interface ToolSpec {
  id: string;
  label: string;
  purpose: string;
  envVar: string;
  /** How the creator supplies it. */
  how: string;
  /** True when `test` really calls the vendor. */
  testable: boolean;
  /** True when this needs a service account or OAuth, not a bare key. */
  oauth: boolean;
}

const CATALOG: ToolSpec[] = [
  {
    id: "youtube",
    label: "YouTube Data API v3",
    purpose:
      "Channel analytics, competitor channels, and uploading a finished video.",
    envVar: "YOUTUBE_API_KEY",
    how: "Enable the YouTube Data API v3 in a Google Cloud project, then paste an API key.",
    testable: true,
    oauth: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    purpose: "A second model provider, independent of the platform gateway.",
    envVar: "DEEPSEEK_API_KEY",
    how: "Paste the key from the DeepSeek platform.",
    testable: true,
    oauth: false,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    purpose: "A second model provider, with very large context for long scripts.",
    envVar: "GEMINI_API_KEY",
    how: "Paste an API key from Google AI Studio.",
    testable: true,
    oauth: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    purpose: "One key that reaches many model providers at once.",
    envVar: "OPENROUTER_API_KEY",
    how: "Paste the key from openrouter.ai.",
    testable: true,
    oauth: false,
  },
  {
    id: "tavily",
    label: "Tavily",
    purpose: "Web search, so research answers can be sourced instead of guessed.",
    envVar: "TAVILY_API_KEY",
    how: "Paste the key from the Tavily dashboard.",
    testable: true,
    oauth: false,
  },
  {
    id: "supadata",
    label: "Supadata",
    purpose:
      "Turn a YouTube URL into a transcript, so a reference video becomes usable input.",
    envVar: "SUPADATA_API_KEY",
    how: "Paste the key from supadata.ai.",
    testable: false,
    oauth: false,
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    purpose:
      "Read a web page as clean markdown, including pages that need JavaScript to render.",
    envVar: "FIRECRAWL_API_KEY",
    how: "Paste the key from firecrawl.dev.",
    testable: false,
    oauth: false,
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    purpose:
      "Push a publish kit into a tracking sheet — title, publish date, status.",
    envVar: "GOOGLE_SHEETS_CREDENTIALS",
    how: "Not a simple key: create a Google Cloud service account and paste its JSON credentials.",
    testable: false,
    oauth: true,
  },
];

export interface Connection {
  id: string;
  label: string;
  purpose: string;
  envVar: string;
  how: string;
  testable: boolean;
  oauth: boolean;
  configured: boolean;
  /** Last four characters only, so two keys can be told apart. */
  hint: string | null;
}

export interface StatusResult {
  ok: boolean;
  connections: Connection[];
  configured: number;
  total: number;
  error?: string;
}

export interface TestResult {
  ok: boolean;
  id: string;
  label: string;
  tested: boolean;
  status: number | null;
  detail: string;
}

const TIMEOUT_MS = 10_000;

/** Never return the key itself — only enough of the tail to identify it. */
function hintFor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 8) return null;
  return `••••${trimmed.slice(-4)}`;
}

function findSpec(id: string): ToolSpec | undefined {
  return CATALOG.find((tool) => tool.id === id);
}

function readKey(spec: ToolSpec): string | null {
  const value = process.env[spec.envVar];
  return value && value.trim().length > 0 ? value.trim() : null;
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: string }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text().catch(() => "");
  return { status: response.status, body };
}

/** Pull the most useful line out of a vendor's error payload. */
function explain(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
      detail?: string;
    };
    const message =
      typeof parsed.error === "string"
        ? parsed.error
        : (parsed.error?.message ?? parsed.message ?? parsed.detail);
    if (message) return message.slice(0, 200);
  } catch {
    // Not JSON — fall through to the status line.
  }
  if (status === 401 || status === 403) return "The vendor rejected the key.";
  if (status === 429) return "Rate limited or quota exhausted.";
  return `The vendor answered with HTTP ${status}.`;
}

/**
 * A real request to each vendor, chosen to be as cheap as they allow. This is
 * the difference between "a key is present" and "the key works".
 */
async function callVendor(
  spec: ToolSpec,
  key: string,
): Promise<{ status: number; body: string; detail: string }> {
  switch (spec.id) {
    case "deepseek": {
      const result = await fetchJson("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        ...result,
        detail:
          result.status === 200
            ? "Key accepted — the provider answered a model list."
            : explain(result.status, result.body),
      };
    }
    case "gemini": {
      const result = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        { headers: {} },
      );
      return {
        ...result,
        detail:
          result.status === 200
            ? "Key accepted — the model list is readable."
            : explain(result.status, result.body),
      };
    }
    case "openrouter": {
      const result = await fetchJson("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        ...result,
        detail:
          result.status === 200
            ? "Key accepted — the model catalog is readable."
            : explain(result.status, result.body),
      };
    }
    case "tavily": {
      // One result, cheapest paid query the API allows.
      const result = await fetchJson("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query: "youtube data api v3",
          max_results: 1,
        }),
      });
      return {
        ...result,
        detail:
          result.status === 200
            ? "Key accepted — a one-result search returned."
            : explain(result.status, result.body),
      };
    }
    case "youtube": {
      // A single most-popular video: the cheapest authenticated read available.
      const result = await fetchJson(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=1&key=${encodeURIComponent(key)}`,
        { headers: {} },
      );
      return {
        ...result,
        detail:
          result.status === 200
            ? "Key accepted — the API returned a video."
            : explain(result.status, result.body),
      };
    }
    default:
      return {
        status: 0,
        body: "",
        detail: "No test endpoint is implemented for this tool yet.",
      };
  }
}

/** Which catalogued tools have a key in the deployment environment. */
export const status = action({
  args: {},
  handler: async (ctx): Promise<StatusResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ok: false,
        connections: [],
        configured: 0,
        total: CATALOG.length,
        error: "You are not signed in.",
      };
    }

    const connections = CATALOG.map((spec) => {
      const key = readKey(spec);
      return {
        id: spec.id,
        label: spec.label,
        purpose: spec.purpose,
        envVar: spec.envVar,
        how: spec.how,
        testable: spec.testable,
        oauth: spec.oauth,
        configured: key !== null,
        hint: hintFor(key ?? undefined),
      } satisfies Connection;
    });

    return {
      ok: true,
      connections,
      configured: connections.filter((item) => item.configured).length,
      total: connections.length,
    };
  },
});

/** Prove that one key really works, rather than merely being present. */
export const test = action({
  args: { id: v.string() },
  handler: async (ctx, args): Promise<TestResult> => {
    const userId = await getAuthUserId(ctx);
    const spec = findSpec(args.id);
    if (!userId || !spec) {
      return {
        ok: false,
        id: args.id,
        label: spec?.label ?? args.id,
        tested: false,
        status: null,
        detail: userId ? "Unknown tool." : "You are not signed in.",
      };
    }

    const key = readKey(spec);
    if (!key) {
      return {
        ok: false,
        id: spec.id,
        label: spec.label,
        tested: false,
        status: null,
        detail: `No key found. Add ${spec.envVar} in the Keys tab.`,
      };
    }

    if (!spec.testable) {
      return {
        ok: true,
        id: spec.id,
        label: spec.label,
        tested: false,
        status: null,
        detail:
          "The key is present. This tool has no cheap test endpoint yet, so nothing was called — testing it for real happens the first time you use it.",
      };
    }

    try {
      const result = await callVendor(spec, key);
      return {
        ok: result.status === 200,
        id: spec.id,
        label: spec.label,
        tested: true,
        status: result.status,
        detail: result.detail,
      };
    } catch (error) {
      return {
        ok: false,
        id: spec.id,
        label: spec.label,
        tested: true,
        status: null,
        detail:
          error instanceof Error && error.name === "TimeoutError"
            ? `The vendor did not answer within ${TIMEOUT_MS / 1000}s.`
            : error instanceof Error
              ? error.message.slice(0, 200)
              : "The request could not be completed.",
      };
    }
  },
});
