import { cn } from "@/lib/utils";
import {
  Compass,
  Film,
  FolderKanban,
  Lightbulb,
  PenLine,
  Rocket,
  Search,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";

/**
 * IDEAS → RESEARCH → ANGLE → SCRIPT → SHORTS → SEO → PUBLISH.
 *
 * Stages that exist show real counts from the database. Stages that are not
 * built are marked plainly, so nothing on this screen overstates the product.
 *
 * Shorts, SEO and Publish are all served by one publish kit per script, so they
 * carry the same count and say what they actually produce instead.
 */
const STAGES = [
  { id: "idea", label: "Idea", icon: Lightbulb, live: true },
  { id: "research", label: "Research", icon: Search, live: false },
  { id: "angle", label: "Angle", icon: Compass, live: true },
  { id: "script", label: "Script", icon: PenLine, live: true },
  { id: "shorts", label: "Shorts", icon: Film, live: true, note: "Cut plan" },
  { id: "seo", label: "SEO", icon: TrendingUp, live: true, note: "Metadata kit" },
  { id: "publish", label: "Publish", icon: Rocket, live: true, note: "No upload" },
] as const;

export interface PipelineCounts {
  ideas: number;
  developed: number;
  capturing?: number;
  scripts: number;
  /** Publish kits — one covers Shorts, SEO and publish together. */
  kits?: number;
}

export function PipelineMap({
  counts,
  activeStage = "script",
  projects = [],
}: {
  counts: PipelineCounts;
  activeStage?: string;
  projects?: { _id: string; name: string }[];
}) {
  const valueFor = (id: string): number | null => {
    if (id === "idea") return counts.ideas;
    if (id === "angle") return counts.developed;
    if (id === "script") return counts.scripts;
    if (id === "shorts" || id === "seo" || id === "publish") {
      return counts.kits ?? 0;
    }
    return null;
  };

  return (
    <div className="surface-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Creator pipeline
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Idea → angle → script → publish kit, end to end. Research is not built.
        </p>
      </div>

      <div className="mt-4 flex snap-x items-stretch gap-2 overflow-x-auto pb-1">
        {STAGES.map((stage, index) => {
          const value = valueFor(stage.id);
          const isActive = stage.live && activeStage === stage.id;
          return (
            <div key={stage.id} className="flex snap-start items-center gap-2">
              <div
                className={cn(
                  "flex min-w-[104px] flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors",
                  stage.live
                    ? "border-border bg-muted/40"
                    : "border-dashed border-border/70 bg-transparent",
                  isActive && "border-primary/50 bg-primary/8",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <stage.icon
                    className={cn(
                      "size-3.5",
                      stage.live ? "text-primary" : "text-muted-foreground/70",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      !stage.live && "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-lg leading-none font-semibold tracking-tight",
                    stage.live ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {stage.live ? (value ?? 0) : "—"}
                </span>
                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  {stage.live ? ("note" in stage ? stage.note : "Live") : "Not built"}
                </span>
              </div>
              {index < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="h-px w-3 shrink-0 bg-border sm:w-5"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {projects.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <FolderKanban className="size-3.5" />
            Projects
          </span>
          {projects.slice(0, 4).map((project) => (
            <Link
              key={project._id}
              to="/dashboard/projects"
              className={cn(
                "rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs transition-colors",
                "hover:border-primary/40 hover:text-foreground",
              )}
            >
              {project.name}
            </Link>
          ))}
          {projects.length > 4 ? (
            <Link
              to="/dashboard/projects"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              +{projects.length - 4} more
            </Link>
          ) : null}
          <Link
            to="/dashboard/projects"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Manage projects
          </Link>
        </div>
      ) : null}
    </div>
  );
}
