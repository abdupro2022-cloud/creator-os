import { StatusPill } from "@/components/app/StatusPill";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/script";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FormState {
  name: string;
  niche: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: "", niche: "", description: "" };

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Server Error\s*/i, "").slice(0, 300)
    : "Something went wrong.";
}

export default function Projects() {
  const projects = useQuery(api.projects.list, {});
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"projects"> | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Give the project a name with at least 2 characters.");
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateProject({
          projectId: editingId,
          name,
          niche: form.niche,
          description: form.description,
        });
        toast.success("Project updated");
      } else {
        await createProject({
          name,
          niche: form.niche,
          description: form.description,
        });
        toast.success("Project created", {
          description: "Ideas and scripts stay scoped to this project.",
        });
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (error) {
      toast.error("Could not save the project", { description: errorText(error) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Context
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            A project is a context boundary. Ideas, scripts, runs and style stay
            scoped to it, so two channels never bleed into each other.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-2 self-start"
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditingId(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          New project
        </Button>
      </header>

      {projects === undefined ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="surface-panel flex flex-col items-start gap-2 p-6">
          <FolderKanban className="size-5 text-primary" />
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            One is created automatically the first time you capture an idea, but
            you can split work by channel, series or client at any time.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {projects.map((project, index) => (
            <motion.li
              key={project._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
              className="surface-panel flex flex-col gap-3 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={project.archived ? "Archived" : "Active"}
                  tone={project.archived ? "neutral" : "success"}
                  dot
                />
                {project.niche ? (
                  <StatusPill label={project.niche} tone="info" />
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(project.updatedAt)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold tracking-tight">
                  {project.name}
                </h2>
                {project.description ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{project.ideaCount} ideas</span>
                <span>{project.developedCount} developed</span>
                <span>{project.scriptCount} scripts</span>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(project._id);
                    setForm({
                      name: project.name,
                      niche: project.niche ?? "",
                      description: project.description ?? "",
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await updateProject({
                        projectId: project._id,
                        archived: !project.archived,
                      });
                      toast.success(
                        project.archived ? "Project restored" : "Project archived",
                      );
                    } catch (error) {
                      toast.error("Could not update the project", {
                        description: errorText(error),
                      });
                    }
                  }}
                >
                  {project.archived ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                  {project.archived ? "Restore" : "Archive"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete “{project.name}”?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the project plus{" "}
                        {project.ideaCount} idea(s) and {project.scriptCount}{" "}
                        script(s) inside it, including their sections and
                        revisions. It cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await removeProject({ projectId: project._id });
                            toast.success("Project deleted");
                          } catch (error) {
                            toast.error("Could not delete the project", {
                              description: errorText(error),
                            });
                          }
                        }}
                      >
                        Delete everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit project" : "New project"}
            </DialogTitle>
            <DialogDescription>
              Keep one project per channel, series or client so context never
              mixes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={form.name}
                maxLength={80}
                placeholder="Main channel"
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-niche">Niche (optional)</Label>
              <Input
                id="project-niche"
                value={form.niche}
                maxLength={80}
                placeholder="Tech reviews, history, self-improvement…"
                onChange={(event) =>
                  setForm((current) => ({ ...current, niche: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Textarea
                id="project-description"
                value={form.description}
                rows={3}
                maxLength={500}
                className="resize-none"
                placeholder="What is this channel or series about?"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="gap-2"
              disabled={isSaving}
              onClick={submit}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
