import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n/provider";
import { useMutation } from "convex/react";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface ProjectOption {
  _id: Id<"projects">;
  name: string;
  niche?: string | null;
}

/**
 * Capture is the first real step of the pipeline, so it is always one input
 * away. The idea is persisted before any model runs, so nothing is lost when a
 * provider call fails.
 */
export function IdeaCapture({
  projects,
  defaultProjectId,
  onCaptured,
  compact = false,
}: {
  projects: ProjectOption[];
  defaultProjectId?: Id<"projects"> | null;
  onCaptured?: (ideaId: Id<"ideas">) => void;
  compact?: boolean;
}) {
  const capture = useMutation(api.ideas.capture);
  const [rawInput, setRawInput] = useState("");
  const [projectId, setProjectId] = useState<string>(
    defaultProjectId ?? projects[0]?._id ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const submit = async () => {
    setError(null);
    const value = rawInput.trim();
    if (value.length < 8) {
      setError(t("Describe the idea in at least a few words."));
      return;
    }
    setIsSaving(true);
    try {
      const ideaId = await capture({
        rawInput: value,
        projectId: projectId
          ? (projectId as Id<"projects">)
          : undefined,
      });
      setRawInput("");
      toast.success(t("Idea captured"), {
        description: t("Develop it to get an angle, hook and key points."),
      });
      onCaptured?.(ideaId);
    } catch (caught) {
      const detail =
        caught instanceof Error
          ? caught.message.replace(/^Server Error\s*/i, "").slice(0, 300)
          : t("Could not save the idea.");
      setError(detail);
      toast.error(t("Could not capture the idea"), { description: detail });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="surface-panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">
          {t("Capture a raw idea")}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "A topic, a question, a half-formed thought — write it the way you would say it out loud.",
        )}
      </p>

      <Textarea
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        rows={compact ? 2 : 3}
        maxLength={4000}
        placeholder={t('مثال: ليش أغلب القنوات تموت بعد أول 10 فيديوهات؟')}
        className="mt-3 resize-none bg-background/60 text-sm"
        disabled={isSaving}
      />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {projects.length > 0 ? (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger
                size="sm"
                className="w-full min-w-40 sm:w-auto"
                aria-label={t("Project")}
              >
                <SelectValue placeholder={t("Project")} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("A default project will be created automatically.")}
            </span>
          )}
          <span
            dir="ltr"
            className="hidden text-[11px] text-muted-foreground sm:inline"
          >
            {rawInput.trim().length}/4000
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={submit}
          disabled={isSaving || rawInput.trim().length < 8}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {t("Capture idea")}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
