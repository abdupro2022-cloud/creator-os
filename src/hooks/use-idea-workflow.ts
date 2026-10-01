import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Phase = "developing" | "drafting" | null;

function message(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message.replace(/^Server Error\s*/i, "").slice(0, 400);
  }
  return fallback;
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
  const { t } = useI18n();

  const [activeIdeaId, setActiveIdeaId] = useState<Id<"ideas"> | null>(null);
  const [phase, setPhase] = useState<Phase>(null);

  const develop = useCallback(
    async (ideaId: Id<"ideas">) => {
      setActiveIdeaId(ideaId);
      setPhase("developing");
      const toastId = toast.loading(
        t("Developing the idea — planning, analyzing, saving…"),
      );
      try {
        const result = await developAction({ ideaId });
        if (!result.ok) {
          toast.error(t("Development failed"), {
            id: toastId,
            description: result.error,
          });
          return false;
        }
        toast.success(t("Angle ready"), {
          id: toastId,
          description: t(
            "Developed with {model}. Open the idea to review the angle, key points and anything that still needs a source.",
            { model: result.model },
          ),
        });
        return true;
      } catch (error) {
        toast.error(t("Development failed"), {
          id: toastId,
          description: message(error, t("Something went wrong.")),
        });
        return false;
      } finally {
        setPhase(null);
        setActiveIdeaId(null);
      }
    },
    [developAction, t],
  );

  const draftScript = useCallback(
    async (ideaId: Id<"ideas">) => {
      setActiveIdeaId(ideaId);
      setPhase("drafting");
      const toastId = toast.loading(
        t("Drafting the script — outline, sections, verification…"),
      );
      try {
        const result = await draftAction({ ideaId });
        if (!result.ok) {
          toast.error(t("Drafting failed"), {
            id: toastId,
            description: result.error,
          });
          return false;
        }
        if (!result.scriptId) {
          toast.error(t("Drafting finished without a script"), { id: toastId });
          return false;
        }
        toast.success(t("Drafted {n} section(s)", { n: result.sectionsWritten ?? 0 }), {
          id: toastId,
          description:
            (result.sectionsFailed ?? 0) > 0
              ? t("{n} section(s) failed — open the studio to retry them.", {
                  n: result.sectionsFailed ?? 0,
                })
              : result.verification?.ok
                ? t("Verification score {score}/100.", {
                    score: result.verification.score ?? 0,
                  })
                : t("Verification did not complete — run it from the studio."),
        });
        navigate(`/dashboard/scripts/${result.scriptId}`);
        return true;
      } catch (error) {
        toast.error(t("Drafting failed"), {
          id: toastId,
          description: message(error, t("Something went wrong.")),
        });
        return false;
      } finally {
        setPhase(null);
        setActiveIdeaId(null);
      }
    },
    [draftAction, navigate, t],
  );

  const remove = useCallback(
    async (ideaId: Id<"ideas">) => {
      try {
        await removeIdea({ ideaId });
        toast.success(t("Idea deleted"));
        return true;
      } catch (error) {
        toast.error(t("Could not delete the idea"), {
          description: message(error, t("Something went wrong.")),
        });
        return false;
      }
    },
    [removeIdea, t],
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
