import { Button } from "@/components/ui/button";
import { StatusPill, sectionStatusMeta } from "@/components/app/StatusPill";
import { useI18n } from "@/lib/i18n/provider";
import { countWords, estimateSeconds, sectionRoleLabel } from "@/lib/script";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  StickyNote,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SectionPatch {
  heading?: string;
  body?: string;
  notes?: string;
}

/**
 * One section of the script. Editing saves itself after a short pause, and the
 * live word count is computed locally from the text you can see — the same
 * helper the backend uses, so the numbers always match.
 */
export function SectionEditor({
  section,
  index,
  total,
  wordsPerMinute,
  isRewriting,
  onSave,
  onRewrite,
  onMove,
  onDelete,
}: {
  section: Doc<"scriptSections">;
  index: number;
  total: number;
  wordsPerMinute: number;
  isRewriting: boolean;
  onSave: (patch: SectionPatch) => Promise<void>;
  onRewrite: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const [body, setBody] = useState(section.body);
  const [heading, setHeading] = useState(section.heading);
  const [notes, setNotes] = useState(section.notes ?? "");
  const [showNotes, setShowNotes] = useState(Boolean(section.notes));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const lastSynced = useRef(section.updatedAt);

  useEffect(() => {
    if (section.updatedAt !== lastSynced.current) {
      lastSynced.current = section.updatedAt;
      setBody(section.body);
      setHeading(section.heading);
      setNotes(section.notes ?? "");
    }
  }, [section.updatedAt, section.body, section.heading, section.notes]);

  useEffect(() => {
    if (body === section.body) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        await onSave({ body });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [body, section.body, onSave]);

  const { t } = useI18n();
  const words = countWords(body);
  const status = sectionStatusMeta(section.status);

  return (
    <div className="surface-panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t(sectionRoleLabel(section.role))}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {index + 1}/{total}
        </span>
        <StatusPill {...status} dot />
        <span className="text-[11px] text-muted-foreground">
          {t("{n} words", { n: words })} ·{" "}
          {estimateSeconds(words, wordsPerMinute)}s
          {section.targetWords > 0
            ? ` · ${t("target")} ${section.targetWords}w`
            : ""}
        </span>

        <span className="ms-auto flex items-center gap-1">
          {saveState === "saving" ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {t("Saving")}
            </span>
          ) : saveState === "saved" ? (
            <span className="text-[11px] text-success">{t("Saved")}</span>
          ) : saveState === "error" ? (
            <span className="text-[11px] text-destructive">{t("Not saved")}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("Rewrite this section with AI")}
            disabled={isRewriting}
            onClick={onRewrite}
          >
            {isRewriting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("Move section up")}
            disabled={index === 0}
            onClick={() => onMove("up")}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("Move section down")}
            disabled={index === total - 1}
            onClick={() => onMove("down")}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("Delete section")}
            className="text-destructive hover:text-destructive"
            disabled={total <= 1}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>

      <input
        value={heading}
        onChange={(event) => setHeading(event.target.value)}
        onBlur={async () => {
          if (heading.trim() === section.heading) return;
          if (heading.trim().length === 0) {
            setHeading(section.heading);
            return;
          }
          await onSave({ heading: heading.trim() });
        }}
        maxLength={160}
        aria-label={t("Section heading")}
        className="w-full rounded-md bg-transparent px-1 py-1 text-sm font-semibold tracking-tight outline-none focus:bg-muted/40"
      />

      {section.intent ? (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          {t("Goal")}: {section.intent}
        </p>
      ) : null}

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={Math.min(18, Math.max(5, Math.ceil(body.length / 90)))}
        placeholder={t("Write this section the way you would say it out loud…")}
        className={cn(
          "w-full resize-y rounded-lg border border-border/70 bg-background/50 p-3 text-sm leading-relaxed outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[2px]",
        )}
      />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowNotes((current) => !current)}
          className="flex w-fit items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <StickyNote className="size-3.5" />
          {t(showNotes ? "Hide production note" : "Production note")}
        </button>
        {showNotes ? (
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={async () => {
              if (notes === (section.notes ?? "")) return;
              await onSave({ notes });
            }}
            rows={2}
            placeholder={t("Notes for the edit, b-roll, on-screen text…")}
            className="w-full resize-none rounded-lg border border-dashed border-border/70 bg-transparent p-2.5 text-xs leading-relaxed outline-none focus-visible:border-ring"
          />
        ) : null}
      </div>

      {section.role === "hook" && words > 80 ? (
        <p className="text-[11px] text-warning">
          {t("This hook is {n} words — the opening usually lands better under 45.", {
            n: words,
          })}
        </p>
      ) : null}
    </div>
  );
}
