import { StatusPill, type PillTone } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Tools & connections.
 *
 * Every secret lives in the platform environment (the Keys tab) — this codebase
 * never stores a key and the browser never sees one. What this page does is
 * report whether a key is present, and for the vendors with a cheap
 * authenticated endpoint, prove that the key actually works.
 *
 * Nothing here is wired into the pipeline yet. The list is the honest starting
 * point: a key that is "present" has not yet been shown to be useful.
 */

/** Mirrors the server contract; declared here so nothing server-only is
 *  pulled into the browser bundle. */
interface Connection {
  id: string;
  label: string;
  purpose: string;
  envVar: string;
  how: string;
  testable: boolean;
  oauth: boolean;
  configured: boolean;
  hint: string | null;
}

interface StatusPayload {
  ok: boolean;
  connections: Connection[];
  configured: number;
  total: number;
  error?: string;
}

interface TestState {
  status: number | null;
  ok: boolean;
  detail: string;
  testing: boolean;
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
    : "Something went wrong.";
}

export default function Tools() {
  const fetchStatus = useAction(api.integrations.status);
  const test = useAction(api.integrations.test);

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, TestState>>({});
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * Key status lives in the deployment environment, so it is fetched on demand
   * rather than watched: keys are added outside the app, in the Keys tab.
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchStatus({}));
    } catch (error) {
      setStatus({
        ok: false,
        connections: [],
        configured: 0,
        total: 0,
        error: errorText(error),
      });
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyEnvVar = async (envVar: string) => {
    try {
      await navigator.clipboard.writeText(envVar);
      setCopied(envVar);
      toast.success(`${envVar} copied — paste it in the Keys tab`);
      window.setTimeout(
        () => setCopied((current) => (current === envVar ? null : current)),
        1500,
      );
    } catch {
      toast.error("Clipboard is not available in this browser.");
    }
  };

  const runTest = async (id: string, label: string) => {
    setResults((current) => ({
      ...current,
      [id]: { status: null, ok: false, detail: "", testing: true },
    }));
    try {
      const result = await test({ id });
      setResults((current) => ({
        ...current,
        [id]: {
          status: result.status,
          ok: result.ok,
          detail: result.detail,
          testing: false,
        },
      }));
      toast[result.ok ? "success" : "error"](
        result.ok ? `${label} responded` : `${label} did not pass`,
        { description: result.detail },
      );
    } catch (error) {
      setResults((current) => ({
        ...current,
        [id]: {
          status: null,
          ok: false,
          detail: errorText(error),
          testing: false,
        },
      }));
      toast.error(`${label} test failed`, { description: errorText(error) });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking your connections…
      </div>
    );
  }

  if (!status || !status.ok) {
    return (
      <div className="surface-panel flex flex-col items-start gap-3 p-6">
        <p className="text-sm font-medium">Connections unavailable</p>
        <p className="text-xs text-muted-foreground">
          {status?.error ?? "Sign in again and reload."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  const missing = status.connections.filter((tool) => !tool.configured);
  const ready = status.connections.filter((tool) => tool.configured);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Tools" tone="accent" />
            <StatusPill
              label={`${status.configured} of ${status.total} keys present`}
              tone={status.configured === status.total ? "success" : "warning"}
              dot
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tools &amp; connections
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Keys are stored in this project's environment, never in the code
            and never in your browser. This page only tells you whether a key is
            present, and — for most of them — whether the vendor actually
            accepts it.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <ShieldCheck className="size-3.5" />
          How to add a key
        </p>
        <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>Copy the variable name shown under the tool you want.</li>
          <li>
            Open this project's <span className="text-foreground">Keys</span> tab
            and add it as a new key with exactly that name.
          </li>
          <li>Come back here and press “Test” — it calls the real API.</li>
        </ol>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-xl border border-warning/35 bg-warning/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" />
            {missing.length} key(s) not added yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {missing.map((tool) => tool.envVar).join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {status.connections.map((tool) => {
          const result = results[tool.id];
          const tone: PillTone = tool.configured
            ? result?.testing
              ? "info"
              : result
                ? result.ok
                  ? "success"
                  : "danger"
                : "success"
            : "neutral";

          return (
            <section
              key={tool.id}
              className={cn(
                "surface-panel flex flex-col gap-3 p-4 sm:p-5",
                tool.configured ? "border-border" : "border-dashed",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Plug className="size-4 text-primary" />
                      {tool.label}
                    </h2>
                    {tool.oauth ? (
                      <StatusPill label="Service account" tone="info" />
                    ) : null}
                    <StatusPill
                      label={tool.configured ? "Key present" : "No key"}
                      tone={tool.configured ? "success" : "neutral"}
                      dot
                    />
                    {tool.configured && result && !result.testing ? (
                      <StatusPill
                        label={result.ok ? "Test passed" : "Test failed"}
                        tone={tone}
                      />
                    ) : null}
                  </div>
                  <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                    {tool.purpose}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!tool.configured || result?.testing === true}
                  onClick={() => runTest(tool.id, tool.label)}
                >
                  {result?.testing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {result?.testing ? "Testing" : "Test"}
                </Button>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Variable
                  </span>
                  <code className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs">
                    {tool.envVar}
                  </code>
                  {tool.hint ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {tool.hint}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-muted-foreground"
                    onClick={() => copyEnvVar(tool.envVar)}
                  >
                    {copied === tool.envVar ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copy
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {tool.how}
                </p>
                {!tool.testable && tool.configured ? (
                  <p className="text-[11px] text-muted-foreground">
                    No cheap test endpoint for this one, so “Test” only confirms
                    the key is present.
                  </p>
                ) : null}
                {result ? (
                  <p
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-relaxed",
                      result.testing
                        ? "border-border bg-muted/30 text-muted-foreground"
                        : result.ok
                          ? "border-success/30 bg-success/8 text-success"
                          : "border-destructive/30 bg-destructive/8 text-destructive",
                    )}
                  >
                    {result.testing ? (
                      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                    ) : result.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <span>
                      {result.detail}
                      {result.status ? ` (HTTP ${result.status})` : ""}
                    </span>
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {ready.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A key being present is not the same as a tool being in use. These are
          not connected to the pipeline yet — each one still needs the feature
          that calls it.
        </p>
      ) : null}
    </div>
  );
}
