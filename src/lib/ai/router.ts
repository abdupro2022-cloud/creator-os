import {
  buildModelList,
  defaultModel,
  resolveModel,
  type AIModel,
  type CapabilityKey,
  type Strength,
} from "./models";

/**
 * Task-aware model routing.
 *
 * A task declares the capabilities it cannot work without, plus the strengths
 * that make a model good at it. Routing is therefore explainable, and the
 * chain always ends with the gateway fallback so an unavailable provider
 * degrades into a real answer instead of a hard failure.
 */

export type TaskType =
  | "idea_development"
  | "script_outline"
  | "script_writing"
  | "verification";

export type RoutingPreference = "balanced" | "quality" | "speed";

interface TaskProfile {
  label: string;
  required: CapabilityKey[];
  strengths: Strength[];
}

export const TASK_PROFILES: Record<TaskType, TaskProfile> = {
  idea_development: {
    label: "Idea development",
    required: ["text", "structuredOutput"],
    strengths: ["reasoning"],
  },
  script_outline: {
    label: "Script outline",
    required: ["text", "structuredOutput"],
    strengths: ["reasoning"],
  },
  script_writing: {
    label: "Script writing",
    required: ["text"],
    strengths: ["writing", "longContext"],
  },
  verification: {
    label: "Verification",
    required: ["text", "structuredOutput"],
    strengths: ["reasoning"],
  },
};

export interface RouteOptions {
  taskType: TaskType;
  preference?: RoutingPreference;
  /** Explicit model the creator pinned in Settings. Tried first. */
  preferredModelId?: string;
  extraModelIds?: string[];
  /** Maximum number of models attempted, including the safe fallback. */
  maxCandidates?: number;
}

export interface RouteDecision {
  taskType: TaskType;
  requiredCapabilities: CapabilityKey[];
  candidates: AIModel[];
  source: "user_preference" | "auto_routed";
  reason: string;
}

function supports(model: AIModel, capabilities: CapabilityKey[]): boolean {
  return capabilities.every((capability) => model.capabilities[capability]);
}

function score(
  model: AIModel,
  strengths: Strength[],
  preference: RoutingPreference,
): number {
  let value = 0;
  for (const strength of model.strengths) {
    if (strengths.includes(strength)) value += 3;
  }
  if (model.verified) value += 2;
  if (preference === "quality") {
    value += model.costTier * 2;
    value += model.speedTier * 0.5;
  } else if (preference === "speed") {
    value += model.speedTier * 2;
    value -= model.costTier;
  } else {
    value += model.costTier;
    value += model.speedTier;
  }
  return value;
}

function dedupe(models: AIModel[]): AIModel[] {
  const seen = new Set<string>();
  const output: AIModel[] = [];
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    output.push(model);
  }
  return output;
}

/**
 * Decide which models to try, in order. The chain always ends with the gateway
 * fallback so a mistyped custom id or an unavailable provider still yields a
 * real result.
 */
export function routeModel(options: RouteOptions): RouteDecision {
  const {
    taskType,
    preference = "balanced",
    preferredModelId,
    extraModelIds = [],
    maxCandidates = 2,
  } = options;

  const profile = TASK_PROFILES[taskType];
  const pool = buildModelList(extraModelIds);
  const eligible = pool.filter((model) => supports(model, profile.required));
  const byScore = (a: AIModel, b: AIModel) =>
    score(b, profile.strengths, preference) - score(a, profile.strengths, preference);

  const fallback = defaultModel();

  if (preferredModelId) {
    const pinned = resolveModel(preferredModelId);
    const rest = eligible.filter((model) => model.id !== pinned.id).sort(byScore);
    const candidates = dedupe([pinned, ...rest, fallback]).slice(
      0,
      Math.max(1, maxCandidates),
    );
    return {
      taskType,
      requiredCapabilities: profile.required,
      candidates,
      source: "user_preference",
      reason: `Pinned "${pinned.label}" for ${profile.label.toLowerCase()}, with ${fallback.label} as the fallback.`,
    };
  }

  const ranked = [...eligible].sort(byScore);
  // Prefer ids that really answered on this deployment; widen only when nothing
  // verified satisfies the task requirements.
  const verified = ranked.filter((model) => model.verified);
  const ordered = verified.length > 0 ? verified : ranked;
  const candidates = dedupe([...ordered, fallback]).slice(
    0,
    Math.max(1, maxCandidates),
  );

  const head = candidates[0] ?? fallback;
  const matched = profile.strengths.filter((strength) =>
    head.strengths.includes(strength),
  );

  return {
    taskType,
    requiredCapabilities: profile.required,
    candidates,
    source: "auto_routed",
    reason: `Auto-routed ${profile.label.toLowerCase()} to "${head.label}"${
      matched.length > 0 ? ` for ${matched.join(" + ")}` : ""
    }; ${preference} bias, ${candidates[1] ? `${candidates[1].label} as fallback` : "no fallback"}.`,
  };
}
