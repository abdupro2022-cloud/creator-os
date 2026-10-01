import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LiveRunTrace } from "@/components/app/RunTrace";
import {
  StatusPill,
  ideaStatusMeta,
  knowledgeMeta,
} from "@/components/app/StatusPill";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useIdeaWorkflow } from "@/hooks/use-idea-workflow";
import { useI18n } from "@/lib/i18n/provider";
import { formatRelativeTime } from "@/lib/script";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
      aria-label={t("Copy {label}", { label })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(t("{label} copied", { label }));
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(t("Clipboard is not available in this browser."));
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function Field({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  const { t } = useI18n();
  if (!value.trim()) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t(label)}
        </span>
        {copy ? <CopyButton value={value} label={label} /> : null}
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function IdeaDialog({
  ideaId,
  open,
  onOpenChange,
}: {
  ideaId: Id<"ideas"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useQuery(api.ideas.get, ideaId ? { ideaId } : "skip");
  const updateRaw = useMutation(api.ideas.updateRaw);
  const workflow = useIdeaWorkflow();
  const [isEditing, setIsEditing] = useState(false);
  const [draftRaw, setDraftRaw] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useI18n();

  const idea = data?.idea ?? null;
  const refined = idea?.refined ?? null;
  const busy = ideaId ? workflow.isBusyWith(ideaId) : null;

  const startEditing = () => {
    setDraftRaw(idea?.rawInput ?? "");
    setIsEditing(true);
  };

  const saveRaw = async () => {
    if (!ideaId) return;
    setIsSaving(true);
    try {
      await updateRaw({ ideaId, rawInput: draftRaw });
      setIsEditing(false);
      toast.success(t("Idea updated"), {
        description: t(
          "The previous development was cleared so it cannot go stale.",
        ),
      });
    } catch (error) {
      toast.error(t("Could not update the idea"), {
        description:
          error instanceof Error
            ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
            : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            {idea ? (
              <StatusPill {...ideaStatusMeta(idea.status)} dot />
            ) : null}
            {data?.project ? (
              <StatusPill label={data.project.name} tone="neutral" />
            ) : null}
            {idea ? (
              <span className="text-xs text-muted-foreground">
                {t("Updated {when}", {
                  when: formatRelativeTime(idea.updatedAt),
                })}
              </span>
            ) : null}
          </div>
          <DialogTitle className="text-lg leading-snug tracking-tight">
            {refined?.title ?? t("Raw idea")}
          </DialogTitle>
          <DialogDescription>
            {t(
              refined
                ? "Review the angle before drafting. Every key point is labelled, and anything that needs a real source is listed separately."
                : "This idea has not been developed yet. The agent will turn it into an angle, a hook and labelled key points.",
            )}
          </DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("Loading idea…")}
          </div>
        ) : data === null || !idea ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("This idea no longer exists.")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {idea.errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3">
                <p className="text-xs font-medium text-destructive">
                  {t("Last run failed")}
                </p>
                <p className="mt-1 text-xs leading-relaxed break-words">
                  {idea.errorMessage}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("Your spark")}
                </span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("Cancel editing")}
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={isSaving}
                      onClick={saveRaw}
                    >
                      {isSaving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      {t("Save")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Edit the raw idea")}
                    onClick={startEditing}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
              {isEditing ? (
                <>
                  <Textarea
                    value={draftRaw}
                    onChange={(event) => setDraftRaw(event.target.value)}
                    rows={3}
                    className="mt-2 resize-none bg-background/70 text-sm"
                    disabled={isSaving}
                  />
                  <p className="mt-1 text-[11px] text-warning">
                    {t("Saving resets the development — re-develop afterwards.")}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {idea.rawInput}
                </p>
              )}
            </div>

            {refined ? (
              <>
                <Field label="One line" value={refined.oneLiner} />
                <Field label="Angle" value={refined.angle} />
                <Field label="Hook (first 15 seconds)" value={refined.hook} copy />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Audience" value={refined.audience} />
                  <Field
                    label="Format"
                    value={
                      refined.format === "long_form"
                        ? t("Long form")
                        : refined.format === "short"
                          ? t("Short")
                          : t("Long form + short")
                    }
                  />
                </div>
                {refined.whyNow ? (
                  <Field label="Why now" value={refined.whyNow} />
                ) : null}

                <Separator />

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {t("Key points")}
                  </span>
                  <ul className="flex flex-col gap-2">
                    {refined.keyPoints.map((point, index) => (
                      <li
                        key={`${point.text.slice(0, 24)}-${index}`}
                        className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5"
                      >
                        <StatusPill {...knowledgeMeta(point.kind)} className="self-start" />
                        <span className="text-sm leading-relaxed">
                          {point.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {refined.riskNotes.length > 0 ? (
                  <div className="rounded-lg border border-warning/35 bg-warning/8 p-3">
                    <p className="text-xs font-medium text-warning">
                      {t("Needs a real source before publishing")}
                    </p>
                    <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-4">
                      {refined.riskNotes.map((note, index) => (
                        <li key={`${note.slice(0, 24)}-${index}`} className="text-xs leading-relaxed">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {refined.openQuestions.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("Check before filming")}
                    </span>
                    <ul className="flex list-disc flex-col gap-1 ps-4">
                      {refined.openQuestions.map((question, index) => (
                        <li key={`${question.slice(0, 24)}-${index}`} className="text-xs leading-relaxed">
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="text-[11px] text-muted-foreground">
                  {t("Developed with {model} · {when}", {
                    model: refined.model,
                    when: formatRelativeTime(refined.generatedAt),
                  })}
                </p>
              </>
            ) : null}

            {data.linkedScripts.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("Scripts from this idea")}
                </span>
                {data.linkedScripts.map((script) => (
                  <Link
                    key={script._id}
                    to={`/dashboard/scripts/${script._id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent/60"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{script.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("{n} words", { n: script.wordCount })}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t("Agent activity")}
              </span>
              <LiveRunTrace targetId={ideaId ?? ""} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {t("Delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Delete this idea?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    "The raw spark and its developed angle are removed permanently. Scripts already drafted from it are kept.",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!ideaId) return;
                    const removed = await workflow.remove(ideaId);
                    if (removed) onOpenChange(false);
                  }}
                >
                  {t("Delete idea")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!ideaId || workflow.isBusy}
              onClick={() => ideaId && void workflow.develop(ideaId)}
            >
              {busy === "developing" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {t(refined ? "Re-develop" : "Develop with AI")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!ideaId || !refined || workflow.isBusy}
              onClick={() => ideaId && void workflow.draftScript(ideaId)}
            >
              {busy === "drafting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {t("Draft script")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
