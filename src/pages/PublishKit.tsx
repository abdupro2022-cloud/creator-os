import { LiveRunTrace } from "@/components/app/RunTrace";
import { StatusPill, publishStatusMeta } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 400)
    : "Something went wrong.";
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
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={onCopy}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}

export default function PublishKit() {
  const { scriptId: scriptIdParam } = useParams();
  const scriptId = scriptIdParam as Id<"scripts"> | undefined;

  const data = useQuery(
    api.publishing.getForScript,
    scriptId ? { scriptId } : "skip",
  );

  const generate = useAction(api.agent.publish.generate);
  const chooseTitle = useMutation(api.publishing.chooseTitle);
  const deletePack = useMutation(api.publishing.deletePack);

  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`${what} copied`);
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      toast.error("Clipboard is not available in this browser.");
    }
  };

  const handleGenerate = async () => {
    if (!scriptId) return;
    setIsGenerating(true);
    const toastId = toast.loading(
      "Building the publish kit — chapters, titles, description and Shorts cuts…",
    );
    try {
      const result = await generate({ scriptId });
      if (!result.ok) {
        toast.error("The publish kit could not be built", {
          id: toastId,
          description: result.error,
        });
        return;
      }
      toast.success(
        `${result.titleCount ?? 0} titles, ${result.chapterCount ?? 0} chapters, ${result.shortCount ?? 0} Shorts cuts`,
        {
          id: toastId,
          description:
            result.issues && result.issues.length > 0
              ? `${result.issues.length} thing(s) to fix before you publish — see the notes below.`
              : "Nothing flagged by the metadata check.",
        },
      );
    } catch (error) {
      toast.error("The publish kit could not be built", {
        id: toastId,
        description: errorText(error),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!data?.pack) return;
    try {
      await deletePack({ packId: data.pack._id });
      toast.success("Publish kit deleted");
    } catch (error) {
      toast.error("Could not delete the kit", { description: errorText(error) });
    }
  };

  if (data === undefined) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading publish kit…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface-panel flex flex-col items-start gap-3 p-6">
        <p className="text-sm font-medium">This script no longer exists.</p>
        <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
          <Link to="/dashboard/scripts">
            <ArrowLeft className="size-4" />
            Back to scripts
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
            <ArrowLeft className="size-4" />
            Back to Script Studio
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label="Publish kit" tone="accent" />
              {meta ? <StatusPill label={meta.label} tone={meta.tone} dot /> : null}
              {pack?.model ? (
                <span className="text-[11px] text-muted-foreground">
                  {pack.model}
                </span>
              ) : null}
              {pack ? (
                <span className="text-[11px] text-muted-foreground">
                  Updated {formatRelativeTime(pack.updatedAt)}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {script.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{script.wordCount} words</span>
              <span>{formatDuration(script.estSeconds)} narration</span>
              <span>
                target {formatDuration(script.targetDurationSec)}
              </span>
              <span>
                {writtenCount}/{data.sections.length} sections written
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
            {pack?.status === "ready" ? "Regenerate kit" : "Build publish kit"}
          </Button>
        </div>
      </div>

      {/* -------------------------- boundary notice --------------------------- */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <Rocket className="size-3.5" />
          No upload — by design
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          This workspace never connects to your YouTube account. Everything here
          is copy you paste in yourself, and the chapter timestamps are derived
          from this draft rather than guessed.
        </p>
      </div>

      {isBusy ? (
        <div className="surface-panel border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Agent working
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Chapters and the metadata check run first, then the copy is written.
          </p>
          {pack ? <LiveRunTrace targetId={pack._id} className="mt-4" /> : null}
        </div>
      ) : null}

      {pack?.errorMessage && !isBusy ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/8 p-3">
          <p className="text-xs font-medium text-destructive">
            The last run did not finish cleanly
          </p>
          <p className="mt-1 text-xs leading-relaxed break-words">
            {pack.errorMessage}
          </p>
        </div>
      ) : null}

      {!pack ? (
        <div className="surface-panel flex flex-col items-start gap-3 p-6">
          <p className="text-sm font-medium">No publish kit yet</p>
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {writtenCount === 0
              ? "Draft the script first — the kit is built from the finished narration, so nothing is invented about a video that does not exist yet."
              : "Build the kit to get title options, a description, tags, real chapter markers, a thumbnail brief and the Shorts cuts worth pulling out of this script."}
          </p>
          {writtenCount === 0 ? (
            <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
              <Link to={`/dashboard/scripts/${script._id}`}>
                <ArrowLeft className="size-4" />
                Open Script Studio
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
              title={`Title options (${pack.titles.length})`}
              icon={Rocket}
              action={
                <CopyButton
                  copied={copiedKey === "title"}
                  onCopy={() => copy("title", chosenTitle, "Title")}
                />
              }
            >
              {pack.titles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No title options were produced. Regenerate the kit.
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
                              toast.error("Could not save that choice", {
                                description: errorText(error),
                              });
                            }
                          }}
                          className={cn(
                            "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
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
                            <span className="text-sm font-medium">
                              {option.text}
                            </span>
                            <span className="ml-auto shrink-0 pt-0.5 text-[10px] text-muted-foreground tabular-nums">
                              {option.text.length}
                            </span>
                          </span>
                          {option.rationale ? (
                            <span className="pl-6 text-xs leading-relaxed text-muted-foreground">
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
              title="Description"
              icon={MessageSquareQuote}
              action={
                <div className="flex items-center gap-1">
                  <CopyButton
                    copied={copiedKey === "description"}
                    onCopy={() => copy("description", pack.description, "Description")}
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
                        "Description with chapters",
                      )
                    }
                  >
                    {copiedKey === "description-chapters" ? (
                      <Check className="size-4" />
                    ) : (
                      <ListOrdered className="size-4" />
                    )}
                    With chapters
                  </Button>
                </div>
              }
            >
              <p className="text-xs text-muted-foreground">
                {pack.description.length} characters. Written to be pasted as-is —
                no links or statistics were invented.
              </p>
              <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {pack.description || "—"}
              </pre>
            </Panel>

            <Panel
              title={`Chapters (${pack.chapters.length})`}
              icon={ListOrdered}
              action={
                <CopyButton
                  copied={copiedKey === "chapters"}
                  onCopy={() => copy("chapters", chapterBlock, "Chapters")}
                />
              }
            >
              {pack.chapters.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  No chapters could be derived — this draft is too short for a
                  chapter list to help.
                </p>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Timestamps are calculated from each section's real narration
                    length, so they line up with the edit.
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
                        <span className="text-sm">{chapter.label}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Panel>

            <Panel title={`Tags (${pack.tags.length})`} icon={Hash}>
              {pack.tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No usable tags.</p>
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
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {pack.tags.join(",").length} chars
                  </span>
                </div>
              )}
            </Panel>

            <Panel
              title="Pinned comment"
              icon={MessageSquareQuote}
              action={
                <CopyButton
                  copied={copiedKey === "comment"}
                  onCopy={() => copy("comment", pack.pinnedComment, "Pinned comment")}
                />
              }
            >
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {pack.pinnedComment || "—"}
              </p>
            </Panel>
          </div>

          {/* ---------------------------- right column ---------------------------- */}
          <div className="flex flex-col gap-6">
            <Panel title="Thumbnail brief" icon={ImageIcon}>
              {pack.thumbnail ? (
                <dl className="flex flex-col gap-2 text-xs">
                  <div className="rounded-lg border border-primary/35 bg-primary/8 p-3">
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      Overlay text
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold">
                      {pack.thumbnail.overlayText}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      Subject
                    </dt>
                    <dd className="mt-0.5 leading-relaxed">
                      {pack.thumbnail.subject}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      Composition
                    </dt>
                    <dd className="mt-0.5 leading-relaxed">
                      {pack.thumbnail.composition}
                    </dd>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Art direction for a human designer — no image was generated.
                  </p>
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No thumbnail brief was produced.
                </p>
              )}
            </Panel>

            <Panel title={`Shorts cuts (${pack.shorts.length})`} icon={Scissors}>
              {pack.shorts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No Shorts cuts were proposed.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pack.shorts.map((cut, index) => (
                    <li
                      key={`${cut.title}-${index}`}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{cut.title}</p>
                        <button
                          type="button"
                          aria-label="Copy this Shorts cut"
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
                              "Shorts cut",
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
                      <p className="text-xs leading-relaxed text-muted-foreground">
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
                          From the section “{cut.sourceHeading}”
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Before you publish"
              icon={AlertTriangle}
              className={
                findings.length > 0 ? "border-warning/35 bg-warning/5" : undefined
              }
            >
              {findings.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The metadata check measured everything against YouTube's real
                  field limits and found nothing to fix.
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
                          {finding.kind}:
                        </span>{" "}
                        {finding.issue}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Separator />

            <div className="surface-panel flex flex-col items-start gap-3 p-4">
              <h2 className="text-sm font-semibold tracking-tight">
                Danger zone
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Deleting the kit leaves the script untouched. You can build a
                fresh one at any time.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Delete publish kit
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
