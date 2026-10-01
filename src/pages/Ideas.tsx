import { IdeaCapture } from "@/components/app/IdeaCapture";
import { IdeaDialog } from "@/components/app/IdeaDialog";
import { StatusPill, ideaStatusMeta } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useIdeaWorkflow } from "@/hooks/use-idea-workflow";
import { useI18n } from "@/lib/i18n/provider";
import { formatRelativeTime } from "@/lib/script";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { FileText, Loader2, Lightbulb, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type Filter = "all" | "captured" | "developed" | "failed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "captured", label: "Waiting" },
  { id: "developed", label: "Developed" },
  { id: "failed", label: "Failed" },
];

export default function Ideas() {
  const ideas = useQuery(api.ideas.list, {});
  const projects = useQuery(api.projects.list, {});
  const workflow = useIdeaWorkflow();
  const [filter, setFilter] = useState<Filter>("all");
  const [openIdeaId, setOpenIdeaId] = useState<Id<"ideas"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useI18n();

  const filtered = useMemo(() => {
    if (!ideas) return [];
    if (filter === "all") return ideas;
    if (filter === "captured") {
      return ideas.filter(
        (idea) => idea.status === "captured" || idea.status === "developing",
      );
    }
    return ideas.filter((idea) => idea.status === filter);
  }, [ideas, filter]);

  const openIdea = (ideaId: Id<"ideas">) => {
    setOpenIdeaId(ideaId);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Step 1 · Idea")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Ideas")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t(
            "Raw sparks in, developed angles out. Nothing reaches a script until you have reviewed the angle and the points that still need a real source.",
          )}
        </p>
      </header>

      <IdeaCapture
        projects={projects ?? []}
        defaultProjectId={(projects ?? [])[0]?._id ?? null}
      />

      <div className="flex flex-col gap-4">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            {FILTERS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {ideas === undefined ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("Loading ideas…")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-panel flex flex-col items-start gap-2 p-6 text-start">
            <Lightbulb className="size-5 text-primary" />
            <p className="text-sm font-medium">
              {t(
                filter === "all" ? "No ideas yet" : "No ideas with this status",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "Write a topic, a question or a problem your audience has. The agent handles the structure.",
              )}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((idea, index) => (
              <motion.li
                key={idea._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
                className="surface-panel flex flex-col gap-3 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill {...ideaStatusMeta(idea.status)} dot />
                  <StatusPill label={idea.projectName} tone="neutral" />
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(idea.updatedAt)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openIdea(idea._id)}
                  className="flex flex-col gap-1 text-start"
                >
                  {idea.refined ? (
                    <>
                      <span className="text-sm font-semibold tracking-tight">
                        {idea.refined.title}
                      </span>
                      <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {idea.refined.angle}
                      </span>
                    </>
                  ) : (
                    <span className="line-clamp-3 text-sm leading-relaxed">
                      {idea.rawInput}
                    </span>
                  )}
                </button>

                {idea.errorMessage ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/8 p-2 text-[11px] break-words">
                    {idea.errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={workflow.isBusy}
                    onClick={() => void workflow.develop(idea._id)}
                  >
                    {workflow.isBusyWith(idea._id) === "developing" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {t(idea.refined ? "Re-develop" : "Develop")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={workflow.isBusy || !idea.refined}
                    onClick={() => void workflow.draftScript(idea._id)}
                  >
                    {workflow.isBusyWith(idea._id) === "drafting" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    {t("Draft script")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openIdea(idea._id)}
                  >
                    {t("Details")}
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <IdeaDialog
        ideaId={openIdeaId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
