import { RunTrace } from "@/components/app/RunTrace";
import {
  StatusPill,
  runKindLabel,
  runStatusMeta,
} from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_MODEL_ID,
  MODELS,
  PROVIDERS,
  buildModelList,
  providerLabel,
} from "@/lib/ai/models";
import { TASK_PROFILES, routeModel, type TaskType } from "@/lib/ai/router";
import { listTools } from "@/lib/tools/registry";
import { formatRelativeTime } from "@/lib/script";
import { useAction, useMutation, useQuery } from "convex/react";
import { Activity, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TASKS: TaskType[] = [
  "idea_development",
  "script_outline",
  "script_writing",
  "verification",
];

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
    : "Something went wrong.";
}

export default function SettingsPage() {
  const settings = useQuery(api.settings.get, {});
  const runs = useQuery(api.runs.list, { limit: 12 });
  const updateSettings = useMutation(api.settings.update);

  const [preference, setPreference] = useState<"balanced" | "quality" | "speed">(
    "balanced",
  );
  const [ideaModel, setIdeaModel] = useState("");
  const [scriptModel, setScriptModel] = useState("");
  const [verificationModel, setVerificationModel] = useState("");
  const [extraModels, setExtraModels] = useState("");
  const [autoVerify, setAutoVerify] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inventory, setInventory] = useState<{
    ok: boolean;
    count: number;
    providers: { provider: string; count: number }[];
    error?: string;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const checkInventory = useAction(api.ai.exec.inventory);

  useEffect(() => {
    if (!settings) return;
    setPreference(settings.routingPreference);
    setIdeaModel(settings.ideaModel ?? "");
    setScriptModel(settings.scriptModel ?? "");
    setVerificationModel(settings.verificationModel ?? "");
    setExtraModels(settings.extraModelIds.join("\n"));
    setAutoVerify(settings.autoVerify);
  }, [settings]);

  const catalog = buildModelList(settings?.extraModelIds ?? []);
  const tools = listTools();

  const save = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        ideaModel,
        scriptModel,
        verificationModel,
        routingPreference: preference,
        extraModelIds: extraModels
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean),
        autoVerify,
      });
      toast.success("Settings saved", {
        description: "Routing and verification preferences apply immediately.",
      });
    } catch (error) {
      toast.error("Could not save settings", { description: errorText(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const previewRoutes = TASKS.map((task) => {
    const pinned =
      task === "idea_development"
        ? ideaModel
        : task === "verification"
          ? verificationModel
          : scriptModel;
    return {
      task,
      decision: routeModel({
        taskType: task,
        preference,
        preferredModelId: pinned || undefined,
        extraModelIds: settings?.extraModelIds ?? [],
      }),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Configuration
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Model routing, verification policy and the exact tools the agent is
          allowed to use. Provider credentials live only in the platform Keys
          tab and never reach this page or the browser.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="surface-panel flex flex-col gap-5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Model routing
            </h2>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={isSaving || settings === undefined}
              onClick={save}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>

          {settings === undefined ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Routing bias</Label>
                <Select
                  value={preference}
                  onValueChange={(value) =>
                    setPreference(value as typeof preference)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">
                      Balanced — sound output at reasonable cost
                    </SelectItem>
                    <SelectItem value="quality">
                      Quality — stronger models, slower and pricier
                    </SelectItem>
                    <SelectItem value="speed">
                      Speed — fastest documented models first
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(
                [
                  {
                    key: "idea_development" as const,
                    label: "Idea development",
                    value: ideaModel,
                    setValue: setIdeaModel,
                  },
                  {
                    key: "script_outline" as const,
                    label: "Outline + section writing",
                    value: scriptModel,
                    setValue: setScriptModel,
                  },
                  {
                    key: "verification" as const,
                    label: "Verification",
                    value: verificationModel,
                    setValue: setVerificationModel,
                  },
                ]
              ).map((row) => (
                <div key={row.key} className="flex flex-col gap-1.5">
                  <Label>{row.label}</Label>
                  <Select
                    value={row.value || "auto"}
                    onValueChange={(value) =>
                      row.setValue(value === "auto" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (capability routed)</SelectItem>
                      {catalog.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label} · {providerLabel(model.provider)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extra-models">Custom model ids</Label>
                <Textarea
                  id="extra-models"
                  value={extraModels}
                  rows={3}
                  className="resize-none font-mono text-xs"
                  placeholder={"my-vllm-endpoint\nllama-3.1-70b"}
                  onChange={(event) => setExtraModels(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  One per line. The agent treats them as OpenAI-compatible
                  endpoints and falls back to {DEFAULT_MODEL_ID} if a call fails.
                </p>
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label>Verify automatically after drafting</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Runs the deterministic QA scan plus a model review pass once
                    every section is written.
                  </p>
                </div>
                <Switch checked={autoVerify} onCheckedChange={setAutoVerify} />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  Routing preview
                </h3>
                <ul className="flex flex-col gap-2">
                  {previewRoutes.map(({ task, decision }) => (
                    <li
                      key={task}
                      className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          {TASK_PROFILES[task].label}
                        </span>
                        <StatusPill
                          label={
                            decision.candidates[0]?.label ?? DEFAULT_MODEL_ID
                          }
                          tone="accent"
                        />
                        {decision.source === "user_preference" ? (
                          <StatusPill label="Pinned" tone="info" />
                        ) : null}
                      </span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        {decision.reason}
                      </span>
                      {decision.candidates.length > 1 ? (
                        <span className="text-[11px] text-muted-foreground">
                          Fallback: {decision.candidates[1]?.label}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Supported providers:{" "}
                {PROVIDERS.map((provider) => provider.label).join(", ")}. The
                provider credential is read on the server from the platform
                integration key; it is never sent to the browser.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Activity className="size-4 text-primary" />
              Gateway availability
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Asks the AI gateway which models this deployment can reach right
              now, rather than trusting a static list. {MODELS.length} of them are
              catalogued with a curated routing strength.
            </p>
            {inventory ? (
              inventory.ok ? (
                <div className="flex flex-col gap-2">
                  <StatusPill
                    label={`${inventory.count} models reachable`}
                    tone="success"
                    dot
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {inventory.providers
                      .slice(0, 8)
                      .map((entry) => `${entry.provider} (${entry.count})`)
                      .join(" · ")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-destructive break-words">
                  {inventory.error}
                </p>
              )
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2"
              disabled={isChecking}
              onClick={async () => {
                setIsChecking(true);
                try {
                  const result = await checkInventory({});
                  setInventory(result);
                  if (!result.ok) {
                    toast.error("Could not reach the gateway", {
                      description: result.error,
                    });
                  }
                } catch (error) {
                  toast.error("Could not check the gateway", {
                    description: errorText(error),
                  });
                } finally {
                  setIsChecking(false);
                }
              }}
            >
              {isChecking ? <Loader2 className="size-4 animate-spin" /> : null}
              Check gateway
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Vision, tool-calling and context-length values in the catalog are
              conservative planning hints — the gateway does not publish
              capability descriptors, so they are never presented as verified.
            </p>
          </div>

          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Wrench className="size-4 text-primary" />
              Registered tools ({tools.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Only tools that are fully implemented are registered. Each declares
              a permission level the agent core enforces before running it.
            </p>
            <ul className="flex flex-col gap-2">
              {tools.map((tool) => (
                <li
                  key={tool.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-2.5"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]">{tool.id}</span>
                    <StatusPill label={tool.permission} tone="neutral" />
                    {tool.requiresConfirmation ? (
                      <StatusPill label="Needs confirmation" tone="warning" />
                    ) : (
                      <StatusPill label="Auto" tone="success" />
                    )}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {tool.description}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Tools with EXTERNAL_ACTION or DESTRUCTIVE permission require
              explicit confirmation; none are registered yet, so no external
              action can run without your approval.
            </p>
          </div>

          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent agent runs
            </h2>
            {runs === undefined ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No runs yet. Each model call is recorded with its model, latency
                and token usage.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {runs.map((run) => (
                  <li key={run._id} className="flex flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold tracking-wider uppercase">
                        {runKindLabel(run.kind)}
                      </span>
                      <StatusPill {...runStatusMeta(run.status)} />
                      <span>{formatRelativeTime(run.createdAt)}</span>
                    </span>
                    <RunTrace run={run} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
