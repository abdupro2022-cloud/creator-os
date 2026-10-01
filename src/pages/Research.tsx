import { LiveRunTrace } from "@/components/app/RunTrace";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n/provider";
import { formatRelativeTime } from "@/lib/script";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Play,
  ScanSearch,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Research — the stage that gathers material from outside the model.
 *
 * Nothing here is written from memory: `research.gatherSources` makes a real
 * HTTP call to one of three vendors (Tavily search, Supadata transcript,
 * Firecrawl page) and only then asks the model to write a brief. A citation the
 * fetched sources cannot back fails the deterministic checker and the whole
 * brief is discarded, so what is on this page either has a URL behind it or is
 * not here.
 */

type Kind = "web" | "transcript" | "page";

const KINDS: { id: Kind; label: string; placeholder: string; hint: string }[] = [
  {
    id: "web",
    label: "Web search",
    placeholder: "How much does a 10-minute video earn in 2026?",
    hint: "Searched through Tavily. Needs TAVILY_API_KEY.",
  },
  {
    id: "transcript",
    label: "Video transcript",
    placeholder: "https://www.youtube.com/watch?v=…",
    hint: "Fetched through Supadata. Needs SUPADATA_API_KEY.",
  },
  {
    id: "page",
    label: "Page",
    placeholder: "https://example.com/report",
    hint: "Rendered to markdown through Firecrawl. Needs FIRECRAWL_API_KEY.",
  },
];

const KIND_BADGE: Record<Kind, string> = {
  web: "Web search",
  transcript: "Transcript",
  page: "Page",
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
    : fallback;
}

export default function Research() {
  const { t } = useI18n();

  const notes = useQuery(api.researchStore.recent, { limit: 20 });
  const ideas = useQuery(api.ideas.list, {});
  const gather = useAction(api.research.gatherSources);

  const [kind, setKind] = useState<Kind>("web");
  const [input, setInput] = useState("");
  const [ideaId, setIdeaId] = useState<string>("");
  const [isGathering, setIsGathering] = useState(false);

  const active = KINDS.find((item) => item.id === kind) ?? KINDS[0];

  const submit = async () => {
    const value = input.trim();
    if (value.length < 3) {
      toast.error(t("Enter at least 3 characters."));
      return;
    }
    if (kind !== "web" && !/^https?:\/\//i.test(value)) {
      toast.error(t("That must be a full http(s) URL."));
      return;
    }

    setIsGathering(true);
    try {
      const result = await gather({
        kind,
        input: value,
        ...(ideaId ? { ideaId: ideaId as Id<"ideas"> } : {}),
      });
      if (!result.ok) {
        toast.error(t("Research could not be gathered"), {
          description: result.error,
        });
        return;
      }
      toast.success(
        t("Brief saved from {n} fetched source(s)", {
          n: result.sourceCount ?? 0,
        }),
        {
          description: result.model
            ? `${t("Model")}: ${result.model}`
            : undefined,
        },
      );
      setInput("");
    } catch (error) {
      toast.error(t("Research could not be gathered"), {
        description: errorText(error, t("Something went wrong.")),
      });
    } finally {
      setIsGathering(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Gathered material")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("Research")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {t(
              "Fetches real material, then writes a brief from it. Every claim keeps the citation it came from, and a citation with no fetched source behind it discards the whole brief.",
            )}
          </p>
        </div>
        <StatusPill
          label={t("Requires a research key")}
          tone={
            notes && notes.length > 0 ? "success" : "warning"
          }
          dot
        />
      </header>

      {/* ------------------------------ gather ------------------------------ */}
      <section className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ScanSearch className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            {t("Gather new material")}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("Source")}
            </label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as Kind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {t(item.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {kind === "web" ? t("Question or topic") : t("URL")}
            </label>
            <textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              dir={kind === "web" ? "auto" : "ltr"}
              placeholder={t(active.placeholder)}
              className="w-full resize-none rounded-lg border border-border/70 bg-background/50 p-3 text-sm leading-relaxed outline-none focus-visible:border-ring"
            />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(active.hint)}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("File under an idea (optional)")}
            </label>
            <Select value={ideaId} onValueChange={setIdeaId}>
              <SelectTrigger>
                <SelectValue placeholder={t("General research")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("General research")}</SelectItem>
                {(ideas ?? []).map((idea) => (
                  <SelectItem key={idea._id} value={idea._id}>
                    {idea.rawInput.slice(0, 70)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            className="gap-2"
            disabled={isGathering}
            onClick={submit}
          >
            {isGathering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {isGathering ? t("Gathering…") : t("Gather sources")}
          </Button>
        </div>

        {ideaId ? (
          <LiveRunTrace targetId={ideaId} className="pt-1" />
        ) : null}
      </section>

      {/* ------------------------------- briefs ------------------------------ */}
      {notes === undefined ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("Loading briefs…")}
        </div>
      ) : notes.length === 0 ? (
        <div className="surface-panel flex flex-col items-start gap-2 p-6">
          <FileText className="size-5 text-primary" />
          <p className="text-sm font-medium">{t("No briefs yet")}</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t(
              "Gather a source above. A brief only appears once the vendor returned real material and every citation in it passed the source check.",
            )}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {notes.map((note, index) => (
            <motion.li
              key={note._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(index * 0.03, 0.2),
              }}
              className="surface-panel flex flex-col gap-3 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={KIND_BADGE[note.kind] ?? note.kind}
                  tone="info"
                />
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(note.createdAt)}
                </span>
                {note.model ? (
                  <span dir="ltr" className="text-[11px] text-muted-foreground">
                    {note.model}
                  </span>
                ) : null}
              </div>

              <p
                dir="auto"
                className="text-sm leading-relaxed font-medium break-words"
              >
                {note.input}
              </p>

              <p dir="auto" className="text-sm leading-relaxed text-muted-foreground">
                {note.summary}
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("Findings")}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {note.findings.map((finding, findingIndex) => (
                    <li
                      key={`${finding.slice(0, 24)}-${findingIndex}`}
                      className="flex gap-2 text-xs leading-relaxed"
                    >
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span dir="auto" className="break-words">
                        {finding}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("Sources ({n})", { n: note.sources.length })}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {note.sources.map((source) => (
                    <li key={source.url} className="flex gap-2 text-xs">
                      <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-start gap-1 text-primary underline-offset-2 hover:underline"
                      >
                        <span dir="auto" className="truncate">
                          {source.title}
                        </span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {note.gaps.length > 0 ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-warning uppercase">
                    <AlertTriangle className="size-3.5" />
                    {t("What this does not answer")}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {note.gaps.map((gap, gapIndex) => (
                      <li
                        key={`${gap.slice(0, 24)}-${gapIndex}`}
                        dir="auto"
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
