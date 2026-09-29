import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/script";
import { useQuery } from "convex/react";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { StatusPill, runKindLabel, runStatusMeta } from "./StatusPill";

/**
 * Shows what the agent is doing right now using only safe status labels —
 * never private reasoning. Steps, model, latency and token usage all come from
 * the persisted run record.
 */
export interface RunLike {
  status: string;
  kind: string;
  model?: string | null;
  provider?: string | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  errorMessage?: string | null;
  routingReason?: string | null;
  createdAt: number;
  steps: {
    label: string;
    status: string;
    detail?: string | null;
    at: number;
  }[];
  candidates: {
    provider: string;
    model: string;
    ok: boolean;
    latencyMs?: number | null;
    error?: string | null;
  }[];
}

function StepIcon({ status }: { status: string }) {
  if (status === "done") {
    return <CheckCircle2 className="size-3.5 text-success" />;
  }
  if (status === "failed") {
    return <XCircle className="size-3.5 text-destructive" />;
  }
  return <CircleDashed className="size-3.5 text-chart-1" />;
}

export function RunTrace({
  run,
  className,
  showMeta = true,
}: {
  run: RunLike;
  className?: string;
  showMeta?: boolean;
}) {
  const meta = runStatusMeta(run.status);
  const failedCandidates = run.candidates.filter((candidate) => !candidate.ok);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={runKindLabel(run.kind)} tone="neutral" />
        <StatusPill
          label={meta.label}
          tone={meta.tone}
          dot
          className={run.status === "running" ? "animate-pulse" : undefined}
        />
        {run.status === "running" ? (
          <Loader2 className="size-3.5 animate-spin text-chart-1" />
        ) : null}
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(run.createdAt)}
        </span>
      </div>

      {run.steps.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {run.steps.map((step, index) => (
            <li key={`${step.label}-${step.at}-${index}`} className="flex gap-2.5">
              <span className="mt-0.5">
                <StepIcon status={step.status} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium">{step.label}</span>
                {step.detail ? (
                  <span className="text-xs leading-relaxed text-muted-foreground break-words">
                    {step.detail}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">Waiting for the first step…</p>
      )}

      {showMeta ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {run.model ? <span>Model: {run.model}</span> : null}
          {run.latencyMs > 0 ? (
            <span>Latency: {(run.latencyMs / 1000).toFixed(1)}s</span>
          ) : null}
          {run.promptTokens + run.completionTokens > 0 ? (
            <span>
              Tokens: {run.promptTokens + run.completionTokens} in /{" "}
              {run.completionTokens} out
            </span>
          ) : null}
        </div>
      ) : null}

      {failedCandidates.length > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/8 p-2.5">
          <p className="text-xs font-medium text-warning">
            Provider fallback used
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {failedCandidates.map((candidate) => (
              <li
                key={candidate.model}
                className="text-xs text-muted-foreground break-words"
              >
                <span className="font-medium text-foreground">
                  {candidate.model}
                </span>{" "}
                — {candidate.error ?? "unavailable"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {run.errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-2.5">
          <p className="text-xs leading-relaxed text-destructive break-words">
            {run.errorMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function LiveRunTrace({
  targetId,
  className,
}: {
  targetId: string;
  className?: string;
}) {
  const run = useQuery(api.runs.latestForTarget, { targetId });

  if (run === undefined) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="size-3.5 animate-spin" />
        Loading run…
      </div>
    );
  }
  if (run === null) return null;

  return <RunTrace run={run} className={className} />;
}
