import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Phase = "developing" | "drafting" | null;

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Server Error\s*/i, "").slice(0, 400);
  }
  return "Something went wrong.";
}

/**
 * The one workflow version 1 is built around: capture -> develop -> draft.
 *
 * The AI work happens in Convex actions; this hook only drives loading state,
 * error handling, toasts and navigation, so every entry point behaves the same.
 */
export function useIdeaWorkflow() {
  const developAction = useAction(api.agent.ideas.develop);
  const draftAction = useAction(api.agent.scripts.draftFromIdea);
  const removeIdea = useMutation(api.ideas.remove);
  const navigate = useNavigate();

  const [activeIdeaId, setActiveIdeaId] = useState<Id<"ideas"> | null>(null);
  const [phase, setPhase] = useState<Phase>(null);

  const develop = useCallback(
    async (ideaId: Id<"ideas">) => {
      setActiveIdeaId(ideaId);
      setPhase("developing");
      const toastId = toast.loading(
        "Developing the idea — planning, analyzing, saving…",
      );
      try {
        const result = await developAction({ ideaId });
        if (!result.ok) {
          toast.error("Development failed", {
            id: toastId,
            description: result.error,
          });
          return false;
        }
        toast.success("Angle ready", {
          id: toastId,
          description: `Developed with ${result.model}. Open the idea to review the angle, key points and anything that still needs a source.`,
        });
        return true;
      } catch (error) {
        toast.error("Development failed", {
          id: toastId,
          description: message(error),
        });
        return false;
      } finally {
        setPhase(null);
        setActiveIdeaId(null);
      }
    },
    [developAction],
  );

  const draftScript = useCallback(
    async (ideaId: Id<"ideas">) => {
      setActiveIdeaId(ideaId);
      setPhase("drafting");
      const toastId = toast.loading(
        "Drafting the script — outline, sections, verification…",
      );
      try {
        const result = await draftAction({ ideaId });
        if (!result.ok) {
          toast.error("Drafting failed", {
            id: toastId,
            description: result.error,
          });
          return false;
        }
        if (!result.scriptId) {
          toast.error("Drafting finished without a script", { id: toastId });
          return false;
        }
        toast.success(`Drafted ${result.sectionsWritten ?? 0} section(s)`, {
          id: toastId,
          description:
            (result.sectionsFailed ?? 0) > 0
              ? `${result.sectionsFailed} section(s) failed — open the studio to retry them.`
              : result.verification?.ok
                ? `Verification score ${result.verification.score}/100.`
                : "Verification did not complete — run it from the studio.",
        });
        navigate(`/dashboard/scripts/${result.scriptId}`);
        return true;
      } catch (error) {
        toast.error("Drafting failed", {
          id: toastId,
          description: message(error),
        });
        return false;
      } finally {
        setPhase(null);
        setActiveIdeaId(null);
      }
    },
    [draftAction, navigate],
  );

  const remove = useCallback(
    async (ideaId: Id<"ideas">) => {
      try {
        await removeIdea({ ideaId });
        toast.success("Idea deleted");
        return true;
      } catch (error) {
        toast.error("Could not delete the idea", { description: message(error) });
        return false;
      }
    },
    [removeIdea],
  );

  return {
    develop,
    draftScript,
    remove,
    phase,
    activeIdeaId,
    isBusy: phase !== null,
    isBusyWith: (ideaId: Id<"ideas">) =>
      activeIdeaId === ideaId ? phase : null,
  };
}
