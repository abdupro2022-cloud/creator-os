import { StatusPill, scriptStatusMeta } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDuration, formatRelativeTime } from "@/lib/script";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function Scripts() {
  const scripts = useQuery(api.scripts.list, {});
  const projects = useQuery(api.projects.list, {});
  const createManual = useMutation(api.scripts.createManual);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const submit = async () => {
    const value = title.trim();
    if (value.length < 2) {
      toast.error("Give the script a title first.");
      return;
    }
    setIsCreating(true);
    try {
      const scriptId = await createManual({
        title: value,
        projectId: projectId ? (projectId as Id<"projects">) : undefined,
      });
      setOpen(false);
      setTitle("");
      toast.success("Script created", {
        description: "Write it yourself or draft sections with the agent.",
      });
      navigate(`/dashboard/scripts/${scriptId}`);
    } catch (error) {
      toast.error("Could not create the script", {
        description:
          error instanceof Error
            ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
            : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Step 3 · Script
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Script Studio
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Drafts keep real word counts, a narration estimate from your pacing,
            section-level rewrites, verification findings and revisions.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-2 self-start"
          onClick={() => {
            setProjectId((projects ?? [])[0]?._id ?? "");
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          New script
        </Button>
      </header>

      {scripts === undefined ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading scripts…
        </div>
      ) : scripts.length === 0 ? (
        <div className="surface-panel flex flex-col items-start gap-2 p-6">
          <FileText className="size-5 text-primary" />
          <p className="text-sm font-medium">No scripts yet</p>
          <p className="text-sm text-muted-foreground">
            Develop an idea and press “Draft script”, or start one from scratch
            and write it yourself — the metrics and revisions work either way.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 gap-2"
            asChild
          >
            <Link to="/dashboard/ideas">
              <Sparkles className="size-4" />
              Go to ideas
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {scripts.map((script, index) => (
            <motion.li
              key={script._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
            >
              <Link
                to={`/dashboard/scripts/${script._id}`}
                className="surface-panel flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill {...scriptStatusMeta(script.status)} dot />
                  <span className="text-[11px] text-muted-foreground">
                    {script.projectName} · {formatRelativeTime(script.updatedAt)}
                  </span>
                </span>
                <span className="line-clamp-2 text-sm font-semibold tracking-tight">
                  {script.title}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{script.wordCount} words</span>
                  <span>{formatDuration(script.estSeconds)} narration</span>
                  <span>
                    target {formatDuration(script.targetDurationSec)}
                  </span>
                </span>
                <div className="mt-auto flex flex-col gap-1.5">
                  <Progress
                    value={
                      script.sectionCount > 0
                        ? (script.writtenCount / script.sectionCount) * 100
                        : 0
                    }
                    className="h-1"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {script.writtenCount}/{script.sectionCount} sections written
                  </span>
                </div>
                {script.errorMessage ? (
                  <span className="rounded-lg border border-destructive/30 bg-destructive/8 p-2 text-[11px] break-words">
                    {script.errorMessage}
                  </span>
                ) : null}
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New script</DialogTitle>
            <DialogDescription>
              Start empty and write it yourself. You can draft individual sections
              with the agent once it exists.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="script-title">Title</Label>
              <Input
                id="script-title"
                value={title}
                maxLength={160}
                placeholder="Working title"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            {projects && projects.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project._id} value={project._id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={submit}
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Create script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
