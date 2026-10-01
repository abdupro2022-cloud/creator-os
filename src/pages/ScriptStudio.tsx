import { LiveRunTrace } from "@/components/app/RunTrace";
import { SectionEditor, type SectionPatch } from "@/components/app/SectionEditor";
import {
  StatusPill,
  knowledgeMeta,
  scriptStatusMeta,
  severityMeta,
} from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n/provider";
import {
  SECTION_ROLE_ORDER,
  formatDuration,
  formatRelativeTime,
  sectionRoleLabel,
} from "@/lib/script";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  History,
  Loader2,
  Plus,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 400)
    : fallback;
}

export default function ScriptStudio() {
  const { scriptId: scriptIdParam } = useParams();
  const scriptId = scriptIdParam as Id<"scripts"> | undefined;
  const data = useQuery(
    api.scripts.get,
    scriptId ? { scriptId } : "skip",
  );
  const navigate = useNavigate();

  const updateSection = useMutation(api.scripts.updateSection);
  const updateScript = useMutation(api.scripts.updateScript);
  const addSection = useMutation(api.scripts.addSection);
  const removeSection = useMutation(api.scripts.removeSection);
  const moveSection = useMutation(api.scripts.moveSection);
  const deleteScript = useMutation(api.scripts.deleteScript);
  const saveRevision = useMutation(api.scripts.saveRevision);
  const restoreRevision = useMutation(api.scripts.restoreRevision);
  const deleteRevision = useMutation(api.scripts.deleteRevision);

  const draftSections = useAction(api.agent.scripts.writePendingSections);
  const rewriteSection = useAction(api.agent.scripts.rewriteSection);
  const verifyScript = useAction(api.agent.scripts.verify);

  const [isDrafting, setIsDrafting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rewritingId, setRewritingId] = useState<Id<"scriptSections"> | null>(null);
  const [newRole, setNewRole] = useState<string>("body");
  const [newHeading, setNewHeading] = useState("");
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const script = data?.script ?? null;
  const sections = data?.sections ?? [];
  const pending = sections.filter((section) => section.status !== "written");

  const handleSave = useCallback(
    async (sectionId: Id<"scriptSections">, patch: SectionPatch) => {
      try {
        await updateSection({ sectionId, ...patch });
      } catch (error) {
        toast.error(t("Could not save the section"), {
          description: errorText(error, t("Something went wrong.")),
        });
        throw error;
      }
    },
    [updateSection, t],
  );

  const handleDraftMissing = async () => {
    if (!scriptId) return;
    setIsDrafting(true);
    const toastId = toast.loading(
      t("Drafting the remaining sections — watch them fill in live…"),
    );
    try {
      const result = await draftSections({ scriptId, verify: true });
      if (!result.ok) {
        toast.error(t("Drafting failed"), {
          id: toastId,
          description: result.error,
        });
        return;
      }
      toast.success(t("Wrote {n} section(s)", { n: result.sectionsWritten }), {
        id: toastId,
        description:
          result.sectionsFailed > 0
            ? t("{n} section(s) still failed — retry or write them yourself.", {
                n: result.sectionsFailed,
              })
            : result.verification?.ok
              ? t("Verification score {score}/100.", {
                  score: result.verification.score,
                })
              : t("Verification did not complete."),
      });
    } catch (error) {
      toast.error(t("Drafting failed"), {
        id: toastId,
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleVerify = async () => {
    if (!scriptId) return;
    setIsVerifying(true);
    const toastId = toast.loading(t("Verifying — scanning then reviewing…"));
    try {
      const result = await verifyScript({ scriptId });
      if (result.ok) {
        toast.success(
          t("Verification complete — {score}/100", { score: result.score }),
          {
            id: toastId,
            description: t("{n} finding(s) recorded.", { n: result.issues ?? 0 }),
          },
        );
      } else {
        toast.error(t("Verification did not complete"), {
          id: toastId,
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(t("Verification failed"), {
        id: toastId,
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRewrite = async (sectionId: Id<"scriptSections">) => {
    setRewritingId(sectionId);
    const toastId = toast.loading(t("Rewriting this section…"));
    try {
      const result = await rewriteSection({ sectionId });
      if (result.ok) {
        toast.success(t("Rewritten with {model}", { model: result.model }), {
          id: toastId,
        });
      } else {
        toast.error(t("Rewrite failed"), {
          id: toastId,
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(t("Rewrite failed"), {
        id: toastId,
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setRewritingId(null);
    }
  };

  if (data === undefined) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("Loading script…")}
      </div>
    );
  }

  if (!script || !data) {
    return (
      <div className="surface-panel flex flex-col items-start gap-3 p-6 text-start">
        <p className="text-sm font-medium">{t("This script no longer exists.")}</p>
        <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
          <Link to="/dashboard/scripts">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("Back to scripts")}
          </Link>
        </Button>
      </div>
    );
  }

  const fullText = sections
    .map((section) => `## ${section.heading}\n\n${section.body}`)
    .join("\n\n");
  const sectionTitle = (id?: string) =>
    sections.find((section) => section._id === id)?.heading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-2 text-muted-foreground"
          asChild
        >
          <Link to="/dashboard/scripts">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("All scripts")}
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill {...scriptStatusMeta(script.status)} dot />
              {data.project ? (
                <StatusPill label={data.project.name} tone="neutral" />
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {t("Updated {when}", {
                  when: formatRelativeTime(script.updatedAt),
                })}
              </span>
            </div>
            <input
              defaultValue={script.title}
              onBlur={async (event) => {
                const value = event.target.value.trim();
                if (value.length < 2 || value === script.title) return;
                try {
                  await updateScript({ scriptId: script._id, title: value });
                  toast.success(t("Title updated"));
                } catch (error) {
                  toast.error(t("Could not update the title"), {
                    description: errorText(error, t("Something went wrong.")),
                  });
                }
              }}
              maxLength={160}
              aria-label={t("Script title")}
              className="w-full rounded-md bg-transparent text-2xl font-bold tracking-tight outline-none focus:bg-muted/40 sm:text-3xl"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{t("{n} words", { n: script.wordCount })}</span>
              <span>
                {formatDuration(script.estSeconds)} {t("narration")}
              </span>
              <span>
                {t("{n} words/min", { n: script.wordsPerMinute })} ·{" "}
                {t("target")} {formatDuration(script.targetDurationSec)}
              </span>
              <span>
                {sections.filter((s) => s.status === "written").length}/
                {sections.length} {t("sections written")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={String(Math.round(script.targetDurationSec / 60))}
              onValueChange={async (value) => {
                try {
                  await updateScript({
                    scriptId: script._id,
                    targetDurationSec: Number(value) * 60,
                  });
                  toast.success(t("Target set to {n} minutes", { n: value }));
                } catch (error) {
                  toast.error(t("Could not update the target"), {
                    description: errorText(error, t("Something went wrong.")),
                  });
                }
              }}
            >
              <SelectTrigger size="sm" className="w-36" aria-label={t("Target length")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 8, 12, 15, 20].map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {t("{n} min target", { n: minutes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isVerifying || pending.length === sections.length}
              onClick={handleVerify}
            >
              {isVerifying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {t("Verify")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={isDrafting || pending.length === 0}
              onClick={handleDraftMissing}
            >
              {isDrafting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {pending.length === sections.length
                ? t("Draft sections")
                : t("Draft {n} missing", { n: pending.length })}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={sections.filter((s) => s.status === "written").length === 0}
              asChild
            >
              <Link to={`/dashboard/scripts/${script._id}/publish`}>
                <Rocket className="size-4" />
                {t("Publish kit")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {script.errorMessage ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/8 p-3">
          <p className="text-xs font-medium text-destructive">
            {t("The last run did not finish cleanly")}
          </p>
          <p className="mt-1 text-xs leading-relaxed break-words">
            {script.errorMessage}
          </p>
        </div>
      ) : null}

      {script.status === "drafting" || isDrafting ? (
        <div className="surface-panel border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            {t("Agent working")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "Sections appear as they are written. You can keep editing finished sections while this runs.",
            )}
          </p>
          <div className="mt-3">
            <LiveRunTrace targetId={script._id} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("Sections ({n})", { n: sections.length })}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `# ${script.title}\n\n${fullText}`,
                  );
                  setCopied(true);
                  toast.success(t("Full script copied"));
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  toast.error("Clipboard is not available in this browser.");
                }
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t("Copy script")}
            </Button>
          </div>

          <ul className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <motion.li
                key={section._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SectionEditor
                  section={section}
                  index={index}
                  total={sections.length}
                  wordsPerMinute={script.wordsPerMinute}
                  isRewriting={rewritingId === section._id}
                  onSave={(patch) => handleSave(section._id, patch)}
                  onRewrite={() => void handleRewrite(section._id)}
                  onMove={async (direction) => {
                    try {
                      await moveSection({ sectionId: section._id, direction });
                    } catch (error) {
                      toast.error(t("Could not reorder sections"), {
                        description: errorText(error, t("Something went wrong.")),
                      });
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await removeSection({ sectionId: section._id });
                      toast.success(t("Section removed"));
                    } catch (error) {
                      toast.error(t("Could not remove the section"), {
                        description: errorText(error, t("Something went wrong.")),
                      });
                    }
                  }}
                />
              </motion.li>
            ))}
          </ul>

          <div className="surface-panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger size="sm" className="w-full sm:w-40" aria-label={t("New section role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTION_ROLE_ORDER.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(sectionRoleLabel(role))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newHeading}
              onChange={(event) => setNewHeading(event.target.value)}
              placeholder={t("New section heading")}
              maxLength={160}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={newHeading.trim().length === 0}
              onClick={async () => {
                try {
                  await addSection({
                    scriptId: script._id,
                    role: newRole as (typeof SECTION_ROLE_ORDER)[number],
                    heading: newHeading.trim(),
                  });
                  setNewHeading("");
                  toast.success(t("Section added"));
                } catch (error) {
                  toast.error(t("Could not add the section"), {
                    description: errorText(error, t("Something went wrong.")),
                  });
                }
              }}
            >
              <Plus className="size-4" />
              {t("Add")}
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {/* Idea context */}
          <div className="surface-panel flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("Where this came from")}
            </h2>
            {data.idea ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span dir="auto">{data.idea.rawInput}</span>
                </p>
                {data.idea.refined ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("Angle")}
                      </span>
                      <p dir="auto" className="text-xs leading-relaxed">
                        {data.idea.refined.angle}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Hook
                        <button
                          type="button"
                          aria-label={t("Copy hook")}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                data.idea?.refined?.hook ?? "",
                              );
                              toast.success(t("Hook copied"));
                            } catch {
                              toast.error(t("Clipboard unavailable."));
                            }
                          }}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Clipboard className="size-3" />
                        </button>
                      </span>
                      <p className="text-xs leading-relaxed">
                        {data.idea.refined.hook}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.idea.refined.keyPoints.slice(0, 4).map((point, index) => (
                        <StatusPill
                          key={`${point.text.slice(0, 16)}-${index}`}
                          {...knowledgeMeta(point.kind)}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit gap-1.5"
                      asChild
                    >
                      <Link to="/dashboard/ideas">
                        {t("Open the idea")}
                      </Link>
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "This script was started manually, so there is no source idea attached. Metrics and revisions still work.",
                )}
              </p>
            )}
          </div>

          {/* Verification */}
          <div className="surface-panel flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                {t("Verification")}
              </h2>
              {script.verification ? (
                <span className="text-sm font-semibold">
                  {script.verification.score}
                  <span className="text-xs text-muted-foreground">/100</span>
                </span>
              ) : null}
            </div>
            {script.verification ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {script.verification.summary}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  <span dir="ltr">{script.verification.model}</span> ·{" "}
                  {formatRelativeTime(script.verification.checkedAt)}
                </span>
                {script.verification.issues.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {script.verification.issues.slice(0, 12).map((issue, index) => (
                      <li
                        key={`${issue.kind}-${index}`}
                        className="flex flex-col gap-1 rounded-lg border border-border/60 p-2"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusPill {...severityMeta(issue.severity)} />
                          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            {issue.kind.replace(/_/g, " ")}
                          </span>
                        </span>
                        <span className="text-xs leading-relaxed">
                          {issue.message}
                        </span>
                        {sectionTitle(issue.sectionId) ? (
                          <span className="text-[10px] text-muted-foreground">
                            {t("Section")}: {sectionTitle(issue.sectionId)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-success">
                    {t("No findings — nothing was flagged.")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Not verified yet. Verification runs a deterministic scan (structure, prohibited style, unsourced evidence claims) and then a model review pass.",
                )}
              </p>
            )}
          </div>

          {/* Revisions */}
          <div className="surface-panel flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                <History className="size-4 text-muted-foreground" />
                {t("Revisions")}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await saveRevision({
                      scriptId: script._id,
                      reason: t("Manual save from Script Studio"),
                    });
                    toast.success(t("Revision saved"));
                  } catch (error) {
                    toast.error(t("Could not save a revision"), {
                      description: errorText(error, t("Something went wrong.")),
                    });
                  }
                }}
              >
                {t("Save revision")}
              </Button>
            </div>
            {data.revisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  "No revisions yet. Snapshots let you roll a draft back after a rewrite.",
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.revisions.map((revision) => (
                  <li
                    key={revision._id}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{revision.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {t("{n} words", { n: revision.wordCount })}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {revision.reason} · {formatRelativeTime(revision.createdAt)}
                    </span>
                    <span className="mt-1 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[11px]"
                        onClick={async () => {
                          try {
                            await restoreRevision({ revisionId: revision._id });
                            toast.success(t("Revision restored"));
                          } catch (error) {
                            toast.error(t("Could not restore the revision"), {
                              description: errorText(error, t("Something went wrong.")),
                            });
                          }
                        }}
                      >
                        <RotateCcw className="size-3" />
                        {t("Restore")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-[11px] text-destructive hover:text-destructive"
                        onClick={async () => {
                          try {
                            await deleteRevision({ revisionId: revision._id });
                            toast.success(t("Revision deleted"));
                          } catch (error) {
                            toast.error(t("Could not delete the revision"), {
                              description: errorText(error, t("Something went wrong.")),
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-3" />
                        {t("Delete")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface-panel flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("Danger zone")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("Deleting removes the script, its sections and all revisions.")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2 text-destructive hover:text-destructive"
              onClick={async () => {
                try {
                  await deleteScript({ scriptId: script._id });
                  toast.success(t("Script deleted"));
                  navigate("/dashboard/scripts");
                } catch (error) {
                  toast.error(t("Could not delete the script"), {
                    description: errorText(error, t("Something went wrong.")),
                  });
                }
              }}
            >
              <Trash2 className="size-4" />
              {t("Delete script")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
