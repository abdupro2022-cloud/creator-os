/**
 * Provider + model registry.
 *
 * Pure data, safe to import from both the Convex backend and the browser.
 * Credentials never live here: the backend only receives a model id and resolves
 * it through the platform AI gateway, so keys never reach the client.
 *
 * Every id below was called through this deployment's gateway (see
 * `ai/exec:listModels` for the live inventory, 390 models). Two things to keep
 * straight:
 *   - `verified` means "this id really answered a completion request here".
 *     It is not permanent: a provider can start failing behind the same id, and
 *     the gpt-5.4 family did exactly that. Anything marked `verified: false` is
 *     excluded from routing so a dead id can never be chosen or used as the
 *     fallback.
 *   - `strengths` is this product's curated routing policy, not provider
 *     metadata. The gateway does not publish capability descriptors.
 */

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "moonshotai"
  | "minimax"
  | "zai"
  | "openai_compatible";

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
}

export const PROVIDERS: ProviderDescriptor[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google Gemini" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "moonshotai", label: "Moonshot / Kimi" },
  { id: "minimax", label: "MiniMax" },
  { id: "zai", label: "Z.ai / GLM" },
  { id: "openai_compatible", label: "OpenAI-compatible" },
];

export type CapabilityKey =
  | "text"
  | "vision"
  | "reasoning"
  | "toolCalling"
  | "structuredOutput"
  | "streaming";

/** Planning hints used to pick a model for a task. */
export type Strength = "reasoning" | "writing" | "speed" | "cost" | "longContext";

export interface ModelCapabilities extends Record<CapabilityKey, boolean> {
  /** Conservative planning budget, not a provider-published figure. */
  contextLength: number;
}

export interface AIModel {
  /** Model id as accepted by the provider gateway. */
  id: string;
  label: string;
  provider: ProviderId;
  capabilities: ModelCapabilities;
  strengths: Strength[];
  /** 1 = cheapest, 3 = premium. */
  costTier: 1 | 2 | 3;
  /** 1 = slowest, 3 = fastest. */
  speedTier: 1 | 2 | 3;
  /** The id answered a real completion request on this deployment. */
  verified: boolean;
  notes?: string;
}

function caps(
  contextLength: number,
  overrides: Partial<Omit<ModelCapabilities, "contextLength">> = {},
): ModelCapabilities {
  return {
    contextLength,
    text: true,
    vision: false,
    reasoning: false,
    toolCalling: true,
    structuredOutput: true,
    streaming: true,
    ...overrides,
  };
}

/**
 * Fallback used when a pinned or custom model cannot answer.
 *
 * This must be an id that is known to work right now: it is the last link in
 * every routing chain, so a dead id here turns a recoverable provider hiccup
 * into a hard failure. It was `openai/gpt-5.4-mini` until that family stopped
 * answering (see the note on it below).
 */
export const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5";

const GPT_54_NOTE =
  'Broken through this gateway: every request (including a trivial prompt) fails with "Invalid JSON response". Kept in the catalog only so the failure is visible in Settings — never routed to.';

export const MODELS: AIModel[] = [
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    provider: "openai",
    capabilities: caps(200_000, { reasoning: true, vision: true, structuredOutput: false }),
    strengths: ["reasoning"],
    costTier: 3,
    speedTier: 2,
    verified: false,
    notes: GPT_54_NOTE,
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 mini",
    provider: "openai",
    capabilities: caps(200_000, { reasoning: true, vision: true, structuredOutput: false }),
    strengths: ["reasoning", "cost", "speed"],
    costTier: 2,
    speedTier: 3,
    verified: false,
    notes: GPT_54_NOTE,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    capabilities: caps(128_000, { vision: true }),
    strengths: ["cost", "speed"],
    costTier: 1,
    speedTier: 3,
    verified: true,
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    provider: "anthropic",
    capabilities: caps(200_000, { reasoning: true, vision: true }),
    strengths: ["writing", "reasoning"],
    costTier: 3,
    speedTier: 2,
    verified: true,
    notes: "Structured long-form narration is its strongest suit.",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    capabilities: caps(200_000, { vision: true }),
    strengths: ["writing", "cost", "speed"],
    costTier: 1,
    speedTier: 3,
    verified: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    capabilities: caps(1_000_000, { reasoning: true, vision: true }),
    strengths: ["reasoning", "longContext"],
    costTier: 2,
    speedTier: 2,
    verified: true,
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
    capabilities: caps(1_000_000, { vision: true }),
    strengths: ["speed", "longContext", "cost"],
    costTier: 1,
    speedTier: 3,
    verified: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "google",
    capabilities: caps(1_000_000),
    strengths: ["cost", "speed"],
    costTier: 1,
    speedTier: 3,
    verified: true,
  },
  {
    id: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    provider: "deepseek",
    capabilities: caps(64_000),
    strengths: ["cost", "reasoning"],
    costTier: 1,
    speedTier: 2,
    verified: true,
  },
  {
    id: "moonshotai/kimi-k2.5",
    label: "Kimi K2.5",
    provider: "moonshotai",
    capabilities: caps(128_000),
    strengths: ["cost", "longContext"],
    costTier: 1,
    speedTier: 2,
    verified: true,
  },
  {
    id: "minimax/minimax-m2.5",
    label: "MiniMax M2.5",
    provider: "minimax",
    capabilities: caps(128_000),
    strengths: ["cost", "speed"],
    costTier: 1,
    speedTier: 2,
    verified: true,
  },
  {
    id: "zai/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    provider: "zai",
    capabilities: caps(128_000),
    strengths: ["cost", "speed"],
    costTier: 1,
    speedTier: 3,
    verified: true,
  },
];

export function providerLabel(id: string): string {
  return PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

export function findModel(id: string | undefined | null): AIModel | undefined {
  if (!id) return undefined;
  return MODELS.find((model) => model.id === id);
}

export function defaultModel(): AIModel {
  return findModel(DEFAULT_MODEL_ID) ?? MODELS[0];
}

/** Resolve a model, synthesising an entry for user-supplied custom ids. */
export function resolveModel(id: string): AIModel {
  const known = findModel(id);
  if (known) return known;
  const [maybeProvider, ...rest] = id.split("/");
  const provider = PROVIDERS.some((entry) => entry.id === maybeProvider)
    ? (maybeProvider as ProviderId)
    : "openai_compatible";
  return {
    id,
    label: rest.length > 0 ? rest.join("/") : id,
    provider,
    capabilities: caps(32_000),
    strengths: [],
    costTier: 2,
    speedTier: 2,
    verified: false,
    notes: "Custom model id — capability hints are unknown.",
  };
}

/** Catalog plus any custom ids the creator added in Settings. */
export function buildModelList(extraModelIds: string[] = []): AIModel[] {
  const seen = new Set(MODELS.map((model) => model.id));
  const extras = extraModelIds
    .filter((id) => id.trim().length > 0 && !seen.has(id.trim()))
    .map((id) => resolveModel(id.trim()));
  return [...MODELS, ...extras];
}
