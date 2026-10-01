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
import { Input } from "@/components/ui/input";
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
import { useT } from "@/lib/i18n/provider";
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

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
    : fallback;
}

export default function SettingsPage() {
  const t = useT();
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
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [trackingSheetId, setTrackingSheetId] = useState("");
  const [trackingSheetTab, setTrackingSheetTab] = useState("");
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
    setYoutubeChannelId(settings.youtubeChannelId ?? "");
    setTrackingSheetId(settings.trackingSheetId ?? "");
    setTrackingSheetTab(settings.trackingSheetTab ?? "");
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
        youtubeChannelId,
        trackingSheetId,
        trackingSheetTab,
      });
      toast.success(t("Settings saved"), {
        description: t(
          "Routing and verification preferences apply immediately.",
        ),
      });
    } catch (error) {
      toast.error(t("Could not save settings"), {
        description: errorText(error, t("Something went wrong.")),
      });
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
          {t("Configuration")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("Settings")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t(
            "Model routing, verification policy and the exact tools the agent is allowed to use. Provider credentials live only in the platform Keys tab and never reach this page or the browser.",
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="surface-panel flex flex-col gap-5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("Model routing")}
            </h2>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={isSaving || settings === undefined}
              onClick={save}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("Save")}
            </Button>
          </div>

          {settings === undefined ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("Loading settings…")}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("Routing bias")}</Label>
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
                      {t("Balanced — sound output at reasonable cost")}
                    </SelectItem>
                    <SelectItem value="quality">
                      {t("Quality — stronger models, slower and pricier")}
                    </SelectItem>
                    <SelectItem value="speed">
                      {t("Speed — fastest documented models first")}
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
                  <Label>{t(row.label)}</Label>
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
                      <SelectItem value="auto">
                        {t("Auto (capability routed)")}
                      </SelectItem>
                      {catalog.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <bdi>{model.label}</bdi> ·{" "}
                          {t(providerLabel(model.provider))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extra-models">
                  {t("Custom model ids")}
                </Label>
                <Textarea
                  id="extra-models"
                  value={extraModels}
                  rows={3}
                  className="resize-none font-mono text-xs"
                  dir="ltr"
                  placeholder={"my-vllm-endpoint\nllama-3.1-70b"}
                  onChange={(event) => setExtraModels(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "One per line. The agent treats them as OpenAI-compatible endpoints and falls back to {model} if a call fails.",
                    { model: DEFAULT_MODEL_ID },
                  )}
                </p>
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label>{t("Verify automatically after drafting")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "Runs the deterministic QA scan plus a model review pass once every section is written.",
                    )}
                  </p>
                </div>
                <Switch checked={autoVerify} onCheckedChange={setAutoVerify} />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {t("Integrations")}
                  </h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t(
                      "Identifiers this deployment reads at run time. The secrets behind them stay in the Keys tab — these are the public halves.",
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="youtube-channel-id">
                    {t("YouTube channel id or @handle")}
                  </Label>
                  <Input
                    id="youtube-channel-id"
                    value={youtubeChannelId}
                    dir="ltr"
                    maxLength={80}
                    placeholder={t("UC… or @yourhandle")}
                    onChange={(event) =>
                      setYoutubeChannelId(event.target.value)
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "Used by the channel statistics card on Tools. Reading works with an API key; uploading never does.",
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tracking-sheet-id">
                    {t("Tracking spreadsheet id")}
                  </Label>
                  <Input
                    id="tracking-sheet-id"
                    value={trackingSheetId}
                    dir="ltr"
                    maxLength={200}
                    placeholder="1AbC…xyz"
                    onChange={(event) => setTrackingSheetId(event.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "The id from the sheet's URL. Share it with the service account's client_email as Editor, or the write is refused.",
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tracking-sheet-tab">
                    {t("Sheet tab (optional)")}
                  </Label>
                  <Input
                    id="tracking-sheet-tab"
                    value={trackingSheetTab}
                    dir="ltr"
                    maxLength={80}
                    placeholder={t("A1")}
                    onChange={(event) => setTrackingSheetTab(event.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "A named range or A1-style start. Defaults to A1 and writes the header row on the first append.",
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  {t("Routing preview")}
                </h3>
                <ul className="flex flex-col gap-2">
                  {previewRoutes.map(({ task, decision }) => (
                    <li
                      key={task}
                      className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">
                          {t(TASK_PROFILES[task].label)}
                        </span>
                        <StatusPill
                          label={
                            decision.candidates[0]?.label ?? DEFAULT_MODEL_ID
                          }
                          tone="accent"
                        />
                        {decision.source === "user_preference" ? (
                          <StatusPill label={t("Pinned")} tone="info" />
                        ) : null}
                      </span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        {decision.source === "user_preference"
                          ? t(
                              "Pinned {model} for this task, with {fallback} as the fallback.",
                              {
                                model: decision.candidates[0]?.label ?? "",
                                fallback: decision.candidates[1]?.label ?? "",
                              },
                            )
                          : t("Automatically routed to {model}.", {
                              model: decision.candidates[0]?.label ?? "",
                            })}
                      </span>
                      {decision.candidates.length > 1 ? (
                        <span className="text-[11px] text-muted-foreground">
                          {t("Fallback: {model}", {
                            model: decision.candidates[1]?.label ?? "",
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("Supported providers: {providers}. The provider credential is read on the server from the platform integration key; it is never sent to the browser.", {
                  providers: PROVIDERS.map((provider) =>
                    t(provider.label),
                  ).join("، "),
                })}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Activity className="size-4 text-primary" />
              {t("Gateway availability")}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "Asks the AI gateway which models this deployment can reach right now, rather than trusting a static list. {n} of them are catalogued with a curated routing strength.",
                { n: MODELS.length },
              )}
            </p>
            {inventory ? (
              inventory.ok ? (
                <div className="flex flex-col gap-2">
                  <StatusPill
                    label={t("{n} models reachable", { n: inventory.count })}
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
                    toast.error(t("Could not reach the gateway"), {
                      description: result.error,
                    });
                  }
                } catch (error) {
                  toast.error(t("Could not check the gateway"), {
                    description: errorText(error, t("Something went wrong.")),
                  });
                } finally {
                  setIsChecking(false);
                }
              }}
            >
              {isChecking ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("Check gateway")}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "Vision, tool-calling and context-length values in the catalog are conservative planning hints — the gateway does not publish capability descriptors, so they are never presented as verified.",
              )}
            </p>
          </div>

          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Wrench className="size-4 text-primary" />
              {t("Registered tools ({n})", { n: tools.length })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "Only tools that are fully implemented are registered. Each declares a permission level the agent core enforces before running it.",
              )}
            </p>
            <ul className="flex flex-col gap-2">
              {tools.map((tool) => (
                <li
                  key={tool.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-2.5"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="font-mono text-[11px]">
                      {tool.id}
                    </span>
                    <StatusPill label={t(tool.permission)} tone="neutral" />
                    {tool.requiresConfirmation ? (
                      <StatusPill
                        label={t("Needs confirmation")}
                        tone="warning"
                      />
                    ) : (
                      <StatusPill label={t("Auto")} tone="success" />
                    )}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {t(tool.description)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {t(
                "Tools with EXTERNAL_ACTION or DESTRUCTIVE permission require explicit confirmation; none are registered yet, so no external action can run without your approval.",
              )}
            </p>
          </div>

          <div className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("Recent agent runs")}
            </h2>
            {runs === undefined ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("Loading…")}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  "No runs yet. Each model call is recorded with its model, latency and token usage.",
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {runs.map((run) => (
                  <li key={run._id} className="flex flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold tracking-wider uppercase">
                        {t(runKindLabel(run.kind))}
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
