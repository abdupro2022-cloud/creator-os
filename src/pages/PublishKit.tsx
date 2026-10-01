import { LiveRunTrace } from "@/components/app/RunTrace";
import { StatusPill, publishStatusMeta } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useT } from "@/lib/i18n/provider";
import { formatDuration, formatRelativeTime } from "@/lib/script";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Hash,
  ImageIcon,
  ListOrdered,
  Loader2,
  MessageSquareQuote,
  Rocket,
  Scissors,
  Share2,
  Table2,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

/**
 * Publish Kit — the last stage of the pipeline.
 *
 * Chapters and the metadata measurements are computed on the server from the
 * real draft, so every timestamp and every limit warning here is a fact. The
 * copy itself is written by the model with explicit instructions never to
 * invent links, numbers or sources.
 *
 * Nothing on this page uploads anything: it is copy the creator pastes into
 * YouTube themselves.
 */

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 400)
    : fallback;
}

/** Chapters always render as m:ss — `formatDuration` shortens long spans. */
function chapterTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(mins)}:${pad(secs)}`
    : `${mins}:${pad(secs)}`;
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: typeof Rocket;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-panel flex flex-col p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function CopyButton({
  onCopy,
  copied,
  label = "Copy",
}: {
  onCopy: () => void;
  copied: boolean;
  label?: string;
}) {
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={onCopy}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {t(label)}
    </Button>
  );
}

export default function PublishKit() {
  const t = useT();
  const { scriptId: scriptIdParam } = useParams();
  const scriptId = scriptIdParam as Id<"scripts"> | undefined;

  const data = useQuery(
    api.publishing.getForScript,
    scriptId ? { scriptId } : "skip",
  );

  const generate = useAction(api.agent.publish.generate);
  const pushToSheet = useAction(api.sheets.appendPublishKit);
  const tracking = useAction(api.youtube.trackingReadiness);
  const chooseTitle = useMutation(api.publishing.chooseTitle);
  const deletePack = useMutation(api.publishing.deletePack);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    row: number | null;
    sheetUrl: string | null;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<{
    sheetReady: boolean;
    reason?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(t("{what} copied", { what }));
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      toast.error(t("Clipboard is not available in this browser."));
    }
  };

  const handleGenerate = async () => {
    if (!scriptId) return;
    setIsGenerating(true);
    const toastId = toast.loading(
      t("Building the publish kit — chapters, titles, description and Shorts cuts…"),
    );
    try {
      const result = await generate({ scriptId });
      if (!result.ok) {
        toast.error(t("The publish kit could not be built"), {
          id: toastId,
          description: result.error,
        });
        return;
      }
      toast.success(
        t("{titles} titles, {chapters} chapters, {shorts} Shorts cuts", {
          titles: result.titleCount ?? 0,
          chapters: result.chapterCount ?? 0,
          shorts: result.shortCount ?? 0,
        }),
        {
          id: toastId,
          description:
            result.issues && result.issues.length > 0
              ? t(
                  "{n} thing(s) to fix before you publish — see the notes below.",
                  { n: result.issues.length },
                )
              : t("Nothing flagged by the metadata check."),
        },
      );
    } catch (error) {
      toast.error(t("The publish kit could not be built"), {
        id: toastId,
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * One row into the tracking sheet.
   *
   * Deliberately not an upload: the sheet is the creator's own spreadsheet and
   * this writes a copy of the kit into it. Every failure mode (no spreadsheet
   * id, unshared credentials, no kit yet) comes back as a sentence rather than
   * an opaque 403, so it is shown verbatim.
   */
  const handlePush = async () => {
    if (!scriptId) return;
    setIsPushing(true);
    try {
      const result = await pushToSheet({ scriptId });
      if (!result.ok) {
        toast.error(t("Could not push to the sheet"), {
          description: result.error,
        });
        return;
      }
      setPushResult({ row: result.row, sheetUrl: result.sheetUrl });
      toast.success(
        result.row
          ? t("Pushed to row {row}", { row: result.row })
          : t("Pushed to the tracking sheet"),
        { description: result.sheetUrl ?? undefined },
      );
    } catch (error) {
      toast.error(t("Could not push to the sheet"), {
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleDelete = async () => {
    if (!data?.pack) return;
    try {
      await deletePack({ packId: data.pack._id });
      toast.success(t("Publish kit deleted"));
    } catch (error) {
      toast.error(t("Could not delete the kit"), {
        description: errorText(error, t("Something went wrong.")),
      });
    }
  };

  if (data === undefined) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("Loading publish kit…")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface-panel flex flex-col items-start gap-3 p-6">
        <p className="text-sm font-medium">
          {t("This script no longer exists.")}
        </p>
        <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
          <Link to="/dashboard/scripts">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("Back to scripts")}
          </Link>
        </Button>
      </div>
    );
  }

  const { pack, script, writtenCount } = data;
  const meta = pack ? publishStatusMeta(pack.status) : null;
  const isBusy = isGenerating || pack?.status === "generating";

  const chapterBlock = (pack?.chapters ?? [])
    .map((chapter) => `${chapterTime(chapter.atSeconds)} ${chapter.label}`)
    .join("\n");

  const chosenIndex =
    pack && pack.chosenTitleIndex !== undefined
      ? Math.min(pack.chosenTitleIndex, Math.max(0, pack.titles.length - 1))
      : 0;
  const chosenTitle = pack?.titles[chosenIndex]?.text ?? script.title;

  const findings = [
    ...(pack?.titleIssues ?? []).map((issue) => ({ kind: "Title", issue })),
    ...(pack?.metadataIssues ?? []).map((issue) => ({ kind: "Metadata", issue })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------- header ------------------------------- */}
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-2 text-muted-foreground"
          asChild
        >
          <Link to={`/dashboard/scripts/${script._id}`}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("Back to Script Studio")}
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={t("Publish kit")} tone="accent" />
              {meta ? (
                <StatusPill label={t(meta.label)} tone={meta.tone} dot />
              ) : null}
              {pack?.model ? (
                <span dir="ltr" className="text-[11px] text-muted-foreground">
                  {pack.model}
                </span>
              ) : null}
              {pack ? (
                <span className="text-[11px] text-muted-foreground">
                  {t("Updated {when}", { when: formatRelativeTime(pack.updatedAt) })}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {script.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{t("{n} words", { n: script.wordCount })}</span>
              <span>
                {t("{time} narration", {
                  time: formatDuration(script.estSeconds),
                })}
              </span>
              <span>
                {t("target {time}", {
                  time: formatDuration(script.targetDurationSec),
                })}
              </span>
              <span>
                {t("{written}/{total} sections written", {
                  written: writtenCount,
                  total: data.sections.length,
                })}
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={isBusy || writtenCount === 0}
            onClick={handleGenerate}
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {pack?.status === "ready" ? t("Regenerate kit") : t("Build publish kit")}
          </Button>
        </div>
      </div>

      {/* -------------------------- boundary notice --------------------------- */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <Rocket className="size-3.5" />
          {t("No upload — by design")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t(
            "This workspace never connects to your YouTube account. Everything here is copy you paste in yourself, and the chapter timestamps are derived from this draft rather than guessed.",
          )}
        </p>
      </div>

      {isBusy ? (
        <div className="surface-panel border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            {t("Agent working")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "Chapters and the metadata check run first, then the copy is written.",
            )}
          </p>
          {pack ? <LiveRunTrace targetId={pack._id} className="mt-4" /> : null}
        </div>
      ) : null}

      {pack?.errorMessage && !isBusy ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/8 p-3">
          <p className="text-xs font-medium text-destructive">
            {t("The last run did not finish cleanly")}
          </p>
          <p className="mt-1 text-xs leading-relaxed break-words">
            {pack.errorMessage}
          </p>
        </div>
      ) : null}

      {!pack ? (
        <div className="surface-panel flex flex-col items-start gap-3 p-6">
          <p className="text-sm font-medium">{t("No publish kit yet")}</p>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {writtenCount === 0
              ? t(
                  "Draft the script first — the kit is built from the finished narration, so nothing is invented about a video that does not exist yet.",
                )
              : t(
                  "Build the kit to get title options, a description, tags, real chapter markers, a thumbnail brief and the Shorts cuts worth pulling out of this script.",
                )}
          </p>
          {writtenCount === 0 ? (
            <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
              <Link to={`/dashboard/scripts/${script._id}`}>
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t("Open Script Studio")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]"
        >
          {/* ----------------------------- left column ----------------------------- */}
          <div className="flex flex-col gap-6">
            <Panel
              title={t("Title options ({n})", { n: pack.titles.length })}
              icon={Rocket}
              action={
                <CopyButton
                  copied={copiedKey === "title"}
                  onCopy={() => copy("title", chosenTitle, t("Title"))}
                />
              }
            >
              {pack.titles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("No title options were produced. Regenerate the kit.")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pack.titles.map((option, index) => {
                    const isChosen = index === chosenIndex;
                    return (
                      <li key={`${option.text}-${index}`}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await chooseTitle({
                                packId: pack._id,
                                index,
                              });
                            } catch (error) {
                              toast.error(t("Could not save that choice"), {
                                description: errorText(
                                  error,
                                  t("Something went wrong."),
                                ),
                              });
                            }
                          }}
                          className={cn(
                            "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-start transition-colors",
                            isChosen
                              ? "border-primary/50 bg-primary/8"
                              : "border-border bg-muted/30 hover:border-primary/35",
                          )}
                        >
                          <span className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                isChosen
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {isChosen ? <Check className="size-3" /> : null}
                            </span>
                            <span dir="auto" className="text-sm font-medium">
                              {option.text}
                            </span>
                            <span className="ms-auto shrink-0 pt-0.5 text-[10px] text-muted-foreground tabular-nums">
                              {option.text.length}
                            </span>
                          </span>
                          {option.rationale ? (
                            <span
                              dir="auto"
                              className="ps-6 text-xs leading-relaxed text-muted-foreground"
                            >
                              {option.rationale}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title={t("Description")}
              icon={MessageSquareQuote}
              action={
                <div className="flex items-center gap-1">
                  <CopyButton
                    copied={copiedKey === "description"}
                    onCopy={() =>
                      copy("description", pack.description, t("Description"))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    disabled={pack.chapters.length === 0}
                    onClick={() =>
                      copy(
                        "description-chapters",
                        `${pack.description}\n\n${chapterBlock}`,
                        t("Description with chapters"),
                      )
                    }
                  >
                    {copiedKey === "description-chapters" ? (
                      <Check className="size-4" />
                    ) : (
                      <ListOrdered className="size-4" />
                    )}
                    {t("With chapters")}
                  </Button>
                </div>
              }
            >
              <p className="text-xs text-muted-foreground">
                {t(
                  "{n} characters. Written to be pasted as-is — no links or statistics were invented.",
                  { n: pack.description.length },
                )}
              </p>
              <pre
                dir="auto"
                className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap"
              >
                {pack.description || "—"}
              </pre>
            </Panel>

            <Panel
              title={t("Chapters ({n})", { n: pack.chapters.length })}
              icon={ListOrdered}
              action={
                <CopyButton
                  copied={copiedKey === "chapters"}
                  onCopy={() => copy("chapters", chapterBlock, t("Chapters"))}
                />
              }
            >
              {pack.chapters.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "No chapters could be derived — this draft is too short for a chapter list to help.",
                  )}
                </p>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t(
                      "Timestamps are calculated from each section's real narration length, so they line up with the edit.",
                    )}
                  </p>
                  <ol className="flex flex-col gap-1.5">
                    {pack.chapters.map((chapter, index) => (
                      <li
                        key={`${chapter.atSeconds}-${index}`}
                        className="flex items-baseline gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <span className="shrink-0 font-mono text-xs text-primary tabular-nums">
                          {chapterTime(chapter.atSeconds)}
                        </span>
                        <span dir="auto" className="text-sm">
                          {chapter.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Panel>

            <Panel title={t("Tags ({n})", { n: pack.tags.length })} icon={Hash}>
              {pack.tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("No usable tags.")}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {pack.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {t("{n} chars", { n: pack.tags.join(",").length })}
                  </span>
                </div>
              )}
            </Panel>

            <Panel
              title={t("Pinned comment")}
              icon={MessageSquareQuote}
              action={
                <CopyButton
                  copied={copiedKey === "comment"}
                  onCopy={() =>
                    copy(
                      "comment",
                      pack.pinnedComment,
                      t("Pinned comment"),
                    )
                  }
                />
              }
            >
              <p
                dir="auto"
                className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap"
              >
                {pack.pinnedComment || "—"}
              </p>
            </Panel>
          </div>

          {/* ---------------------------- right column ---------------------------- */}
          <div className="flex flex-col gap-6">
            <Panel title={t("Thumbnail brief")} icon={ImageIcon}>
              {pack.thumbnail ? (
                <dl className="flex flex-col gap-2 text-xs">
                  <div className="rounded-lg border border-primary/35 bg-primary/8 p-3">
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {t("Overlay text")}
                    </dt>
                    <dd dir="auto" className="mt-0.5 text-sm font-semibold">
                      {pack.thumbnail.overlayText}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {t("Subject")}
                    </dt>
                    <dd dir="auto" className="mt-0.5 leading-relaxed">
                      {pack.thumbnail.subject}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {t("Composition")}
                    </dt>
                    <dd dir="auto" className="mt-0.5 leading-relaxed">
                      {pack.thumbnail.composition}
                    </dd>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t(
                      "Art direction for a human designer — no image was generated.",
                    )}
                  </p>
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("No thumbnail brief was produced.")}
                </p>
              )}
            </Panel>

            <Panel
              title={t("Shorts cuts ({n})", { n: pack.shorts.length })}
              icon={Scissors}
            >
              {pack.shorts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("No Shorts cuts were proposed.")}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pack.shorts.map((cut, index) => (
                    <li
                      key={`${cut.title}-${index}`}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p dir="auto" className="text-sm font-medium">
                          {cut.title}
                        </p>
                        <button
                          type="button"
                          aria-label={t("Copy this Shorts cut")}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copy(
                              `short-${index}`,
                              [
                                cut.title,
                                "",
                                cut.hook,
                                "",
                                ...cut.beats.map((beat) => `- ${beat}`),
                              ].join("\n"),
                              t("Shorts cut"),
                            )
                          }
                        >
                          {copiedKey === `short-${index}` ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <p
                        dir="auto"
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {cut.hook}
                      </p>
                      {cut.beats.length > 0 ? (
                        <ol className="flex flex-col gap-1">
                          {cut.beats.map((beat, beatIndex) => (
                            <li
                              key={`${beat}-${beatIndex}`}
                              className="flex gap-2 text-xs leading-relaxed"
                            >
                              <span className="text-muted-foreground tabular-nums">
                                {beatIndex + 1}.
                              </span>
                              <span>{beat}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {cut.sourceHeading ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t("From the section “{heading}”", {
                            heading: cut.sourceHeading,
                          })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title={t("Before you publish")}
              icon={AlertTriangle}
              className={
                findings.length > 0 ? "border-warning/35 bg-warning/5" : undefined
              }
            >
              {findings.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "The metadata check measured everything against YouTube's real field limits and found nothing to fix.",
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {findings.map((finding, index) => (
                    <li
                      key={`${finding.kind}-${index}`}
                      className="flex gap-2 text-xs leading-relaxed"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      <span>
                        <span className="font-medium text-foreground">
                          {t(finding.kind)}:
                        </span>{" "}
                        {finding.issue}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Separator />

            <Panel
              title={t("Tracking sheet")}
              icon={Table2}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isPushing || pack.status !== "ready"}
                  onClick={handlePush}
                >
                  {isPushing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                  {isPushing ? t("Pushing…") : t("Push to sheet")}
                </Button>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "Writes one row with the title, description, tags, chapter and Shorts counts. Set the spreadsheet id in Settings first, and share that sheet with the service account's client_email as Editor.",
                  )}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 text-muted-foreground"
                  disabled={isChecking}
                  onClick={async () => {
                    setIsChecking(true);
                    try {
                      setTrackingStatus(await tracking({}));
                    } catch (error) {
                      toast.error(t("Could not check the sheet"), {
                        description: errorText(error, t("Something went wrong.")),
                      });
                    } finally {
                      setIsChecking(false);
                    }
                  }}
                >
                  {isChecking ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  {t("Check setup")}
                </Button>
              </div>
              {trackingStatus ? (
                trackingStatus.sheetReady ? (
                  <p className="rounded-lg border border-success/30 bg-success/8 p-2.5 text-xs leading-relaxed text-success">
                    {t("The tracking sheet is wired up and reachable.")}
                  </p>
                ) : (
                  <p className="rounded-lg border border-warning/35 bg-warning/8 p-2.5 text-xs leading-relaxed text-warning">
                    {trackingStatus.reason}
                  </p>
                )
              ) : null}
              {pack.status !== "ready" ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("Build the kit before pushing it.")}
                </p>
              ) : null}
              {pushResult ? (
                <p className="rounded-lg border border-success/30 bg-success/8 p-2.5 text-xs leading-relaxed text-success">
                  {pushResult.row
                    ? t("Added as row {row}.", { row: pushResult.row })
                    : t("Added to the tracking sheet.")}
                  {pushResult.sheetUrl ? (
                    <a
                      href={pushResult.sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-1.5 underline underline-offset-2"
                    >
                      {t("Open the sheet")}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </Panel>

            <Separator />

            <div className="surface-panel flex flex-col items-start gap-3 p-4">
              <h2 className="text-sm font-semibold tracking-tight">
                {t("Danger zone")}
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  "Deleting the kit leaves the script untouched. You can build a fresh one at any time.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                {t("Delete publish kit")}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
