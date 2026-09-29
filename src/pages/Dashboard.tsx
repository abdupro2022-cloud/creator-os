import { IdeaCapture } from "@/components/app/IdeaCapture";
import { IdeaDialog } from "@/components/app/IdeaDialog";
import { PipelineMap } from "@/components/app/PipelineMap";
import { RunTrace } from "@/components/app/RunTrace";
import {
  StatusPill,
  ideaStatusMeta,
  runKindLabel,
  scriptStatusMeta,
} from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useIdeaWorkflow } from "@/hooks/use-idea-workflow";
import { formatDuration, formatRelativeTime } from "@/lib/script";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Fingerprint,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

function SectionHeader({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof Sparkles;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const overview = useQuery(api.dashboard.overview);
  const workflow = useIdeaWorkflow();
  const navigate = useNavigate();
  const [openIdeaId, setOpenIdeaId] = useState<Id<"ideas"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const projects = overview?.projects ?? [];
  const firstName = (user?.name ?? "").split(" ")[0];

  const openIdea = (ideaId: Id<"ideas">) => {
    setOpenIdeaId(ideaId);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Command Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Capture raw ideas here, develop them into a real angle, then draft
            the script. Every number below comes from your own workspace.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={() => navigate("/dashboard/scripts")}
        >
          <PenLine className="size-4" />
          Open Script Studio
        </Button>
      </motion.header>

      {overview === undefined ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your workspace…
        </div>
      ) : overview === null ? (
        <p className="py-16 text-sm text-muted-foreground">
          Workspace unavailable — try signing in again.
        </p>
      ) : (
        <>
          <PipelineMap
            counts={{
              ideas: overview.pipeline.ideas,
              developed: overview.pipeline.developed,
              capturing: overview.pipeline.captured,
              scripts: overview.pipeline.scripts,
            }}
            projects={overview.projects.map((project) => ({
              _id: project._id,
              name: project.name,
            }))}
          />

          <IdeaCapture
            projects={projects}
            defaultProjectId={overview.activeProjectId}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Ideas in progress */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="surface-panel flex flex-col gap-4 p-4 sm:p-5"
            >
              <SectionHeader
                icon={Sparkles}
                title="Ideas in progress"
                hint={
                  overview.pipeline.developed > 0
                    ? `${overview.pipeline.developed} developed · ${overview.pipeline.captured} waiting`
                    : "Nothing developed yet — start with one idea"
                }
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/dashboard/ideas")}
                  >
                    All ideas
                    <ArrowRight className="size-3.5" />
                  </Button>
                }
              />

              {overview.recentIdeas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No ideas yet. Write one above — it takes ten seconds.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overview.recentIdeas.map((idea) => (
                    <li
                      key={idea._id}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"
                    >
                      <button
                        type="button"
                        onClick={() => openIdea(idea._id)}
                        className="flex flex-col gap-1 text-left"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill {...ideaStatusMeta(idea.status)} dot />
                          <span className="text-[11px] text-muted-foreground">
                            {idea.projectName} ·{" "}
                            {formatRelativeTime(idea.updatedAt)}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-sm leading-relaxed">
                          {idea.title ?? idea.rawInput}
                        </span>
                      </button>

                      {idea.errorMessage ? (
                        <p className="text-[11px] text-destructive line-clamp-2">
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
                          {idea.title ? "Re-develop" : "Develop"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          disabled={workflow.isBusy || !idea.title}
                          onClick={() => void workflow.draftScript(idea._id)}
                        >
                          {workflow.isBusyWith(idea._id) === "drafting" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          Draft script
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            {/* Recent drafts */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="surface-panel flex flex-col gap-4 p-4 sm:p-5"
            >
              <SectionHeader
                icon={PenLine}
                title="Recent drafts"
                hint={
                  overview.pipeline.scripts > 0
                    ? `${overview.pipeline.verified} verified · ${overview.pipeline.drafts} in draft`
                    : "No scripts drafted yet"
                }
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/dashboard/scripts")}
                  >
                    All scripts
                    <ArrowRight className="size-3.5" />
                  </Button>
                }
              />

              {overview.recentScripts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Drafts land here with real word counts and a duration estimate
                  based on your pacing.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overview.recentScripts.map((script) => (
                    <li key={script._id}>
                      <Link
                        to={`/dashboard/scripts/${script._id}`}
                        className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill {...scriptStatusMeta(script.status)} dot />
                          <span className="text-[11px] text-muted-foreground">
                            {script.projectName} ·{" "}
                            {formatRelativeTime(script.updatedAt)}
                          </span>
                        </span>
                        <span className="line-clamp-1 text-sm font-medium">
                          {script.title}
                        </span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{script.wordCount} words</span>
                          <span>
                            {formatDuration(script.estSeconds)} narration
                          </span>
                          <span>
                            {script.writtenCount}/{script.sectionCount} sections
                          </span>
                        </span>
                        <Progress
                          value={
                            script.sectionCount > 0
                              ? (script.writtenCount / script.sectionCount) * 100
                              : 0
                          }
                          className="h-1"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Style profile */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="surface-panel flex flex-col gap-4 p-4 sm:p-5"
            >
              <SectionHeader
                icon={Fingerprint}
                title="Creator style profile"
                hint="Injected into every model call — the single biggest quality lever."
              />
              {overview.profile ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-semibold tracking-tight">
                      {overview.profile.completeness.percent}%
                    </span>
                    <div className={cn("flex-1")}>
                      <Progress
                        value={overview.profile.completeness.percent}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={overview.profile.language}
                      tone="neutral"
                    />
                    <StatusPill
                      label={`${overview.profile.pacing} pacing`}
                      tone="info"
                    />
                    <StatusPill
                      label={`${overview.profile.targetLengthMin} min target`}
                      tone="neutral"
                    />
                  </div>
                  {overview.profile.completeness.missing.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Missing:{" "}
                      {overview.profile.completeness.missing.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-success">
                      Profile complete — every field is set.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not set up yet. Without it, drafts use a neutral voice instead
                  of yours.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => navigate("/dashboard/style")}
              >
                <Fingerprint className="size-4" />
                {overview.profile ? "Edit profile" : "Set up profile"}
              </Button>
            </motion.section>

            {/* AI activity */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="surface-panel flex flex-col gap-4 p-4 sm:p-5"
            >
              <SectionHeader
                icon={Sparkles}
                title="Agent activity"
                hint="Every model call, with the provider that answered."
                action={
                  overview.inFlightRuns > 0 ? (
                    <StatusPill label="Running" tone="info" dot />
                  ) : undefined
                }
              />
              {overview.recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No model calls yet. Developing an idea will show up here with
                  model, latency and token usage.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {overview.recentRuns.slice(0, 2).map((run) => (
                    <li key={run._id} className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        {runKindLabel(run.kind)}
                      </span>
                      <RunTrace run={run} />
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          </div>
        </>
      )}

      <IdeaDialog
        ideaId={openIdeaId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
