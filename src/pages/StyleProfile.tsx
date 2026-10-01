import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { styleBlock } from "@/lib/ai/prompts";
import { useT } from "@/lib/i18n/provider";
import { profileCompleteness } from "@/lib/profile";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface FormState {
  displayName: string;
  language: string;
  dialect: string;
  tone: string;
  pacing: "slow" | "medium" | "fast";
  storytelling: string;
  audience: string;
  targetLengthMin: number;
  hookStyles: string;
  prohibited: string;
  notes: string;
}

const DEFAULTS: FormState = {
  displayName: "",
  language: "Arabic",
  dialect: "Egyptian Arabic",
  tone: "",
  pacing: "medium",
  storytelling: "",
  audience: "",
  targetLengthMin: 8,
  hookStyles: "",
  prohibited: "",
  notes: "",
};

function toList(value: string): string[] {
  return value
    .split(/[,،\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * The style profile is injected into every prompt, so this page shows the
 * creator exactly what the model receives — no hidden magic, no guessing.
 */
export default function StyleProfile() {
  const t = useT();
  const profile = useQuery(api.creatorProfile.get, {});
  const upsert = useMutation(api.creatorProfile.upsert);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.displayName ?? "",
      language: profile.language,
      dialect: profile.dialect,
      tone: profile.tone.join(", "),
      pacing: profile.pacing,
      storytelling: profile.storytelling.join(", "),
      audience: profile.audience,
      targetLengthMin: profile.targetLengthMin,
      hookStyles: profile.hookStyles.join(", "),
      prohibited: profile.prohibited.join(", "),
      notes: profile.notes ?? "",
    });
  }, [profile]);

  const completeness = profileCompleteness(
    profile
      ? {
          ...profile,
          tone: profile.tone,
          storytelling: profile.storytelling,
          hookStyles: profile.hookStyles,
          prohibited: profile.prohibited,
        }
      : null,
  );

  const save = async () => {
    setIsSaving(true);
    try {
      await upsert({
        displayName: form.displayName,
        language: form.language,
        dialect: form.dialect,
        tone: toList(form.tone),
        pacing: form.pacing,
        storytelling: toList(form.storytelling),
        audience: form.audience,
        targetLengthMin: form.targetLengthMin,
        hookStyles: toList(form.hookStyles),
        prohibited: toList(form.prohibited),
        notes: form.notes,
      });
      toast.success(t("Style profile saved"), {
        description: t("Every future idea and script will use it."),
      });
    } catch (error) {
      toast.error(t("Could not save the profile"), {
        description:
          error instanceof Error
            ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
            : t("Something went wrong."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const preview = styleBlock({
    displayName: form.displayName || undefined,
    language: form.language || "Arabic",
    dialect: form.dialect,
    tone: toList(form.tone),
    pacing: form.pacing,
    storytelling: toList(form.storytelling),
    audience: form.audience,
    targetLengthMin: form.targetLengthMin,
    hookStyles: toList(form.hookStyles),
    prohibited: toList(form.prohibited),
    notes: form.notes || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Creator identity")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("Style Profile")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t(
            "This is the difference between a generic assistant and a writer that sounds like you. It is attached to every idea development, script section and verification call.",
          )}
        </p>
      </header>

      <div className="surface-panel flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {t("Profile completeness — {filled}/{total}", {
              filled: completeness.filled,
              total: completeness.total,
            })}
          </span>
          <span className="text-sm font-semibold">
            {completeness.percent}%
          </span>
        </div>
        <Progress value={completeness.percent} className="h-1.5" />
        {completeness.missing.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("Still missing: {fields}", {
              fields: completeness.missing.map((item) => t(item)).join("، "),
            })}
          </p>
        ) : (
          <p className="text-xs text-success">
            {t("Complete. The agent has everything it needs to match your voice.")}
          </p>
        )}
      </div>

      {profile === undefined ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("Loading profile…")}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="surface-panel flex flex-col gap-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">{t("Creator name")}</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  placeholder={t("How you refer to yourself")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="language">{t("Language")}</Label>
                <Input
                  id="language"
                  value={form.language}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      language: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dialect">{t("Dialect")}</Label>
                <Input
                  id="dialect"
                  value={form.dialect}
                  placeholder={t("Egyptian Arabic, Gulf, MSA…")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dialect: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("Pacing")}</Label>
                <Select
                  value={form.pacing}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      pacing: value as FormState["pacing"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">
                      {t("Slow — 130 words/min")}
                    </SelectItem>
                    <SelectItem value="medium">
                      {t("Medium — 150 words/min")}
                    </SelectItem>
                    <SelectItem value="fast">
                      {t("Fast — 175 words/min")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetLength">
                  {t("Target video length (minutes)")}
                </Label>
                <Input
                  id="targetLength"
                  type="number"
                  min={1}
                  max={180}
                  value={form.targetLengthMin}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      targetLengthMin: Number(event.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audience">{t("Audience")}</Label>
                <Input
                  id="audience"
                  value={form.audience}
                  placeholder={t("Who is this for?")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audience: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tone">{t("Tone")}</Label>
                <Textarea
                  id="tone"
                  value={form.tone}
                  rows={2}
                  className="resize-none"
                  placeholder={t("direct, warm, factual, humour with restraint")}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tone: event.target.value }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("Separate with commas or new lines.")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="storytelling">{t("Storytelling style")}</Label>
                <Textarea
                  id="storytelling"
                  value={form.storytelling}
                  rows={2}
                  className="resize-none"
                  placeholder={t("problem → proof → payoff, personal anecdote first")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      storytelling: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hookStyles">{t("Preferred hooks")}</Label>
                <Textarea
                  id="hookStyles"
                  value={form.hookStyles}
                  rows={2}
                  className="resize-none"
                  placeholder={t("bold claim, contradiction, question the audience asks")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      hookStyles: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prohibited">{t("Prohibited styles")}</Label>
                <Textarea
                  id="prohibited"
                  value={form.prohibited}
                  rows={2}
                  className="resize-none"
                  placeholder={t("clickbait, overhyped promises, corporate jargon")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      prohibited: event.target.value,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "The verification scan flags any of these when it finds them in a draft.",
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">{t("Anything else")}</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  rows={2}
                  className="resize-none"
                  placeholder={t("Words you never use, recurring segments, sponsor rules…")}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              type="button"
              className="w-fit gap-2"
              disabled={isSaving}
              onClick={save}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("Save profile")}
            </Button>
          </div>

          <div className="surface-panel flex h-fit flex-col gap-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("What the model actually receives")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "Exact text appended to the system prompt. Secret keys never appear here — they stay on the server.",
              )}
            </p>
            <pre
              dir="auto"
              className="max-h-96 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap"
            >
              {preview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
