import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type PillTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const TONES: Record<PillTone, string> = {
  neutral: "border-border bg-muted/60 text-muted-foreground",
  info: "border-chart-1/35 bg-chart-1/12 text-chart-1",
  success: "border-success/35 bg-success/12 text-success",
  warning: "border-warning/35 bg-warning/14 text-warning",
  danger: "border-destructive/35 bg-destructive/12 text-destructive",
  accent: "border-primary/35 bg-primary/12 text-primary",
};

export function StatusPill({
  label,
  tone = "neutral",
  className,
  dot = false,
}: {
  label: string;
  tone?: PillTone;
  className?: string;
  dot?: boolean;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {t(label)}
    </span>
  );
}

export function ideaStatusMeta(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "captured":
      return { label: "Captured", tone: "neutral" };
    case "developing":
      return { label: "Developing", tone: "info" };
    case "developed":
      return { label: "Developed", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function scriptStatusMeta(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "drafting":
      return { label: "Drafting", tone: "info" };
    case "draft":
      return { label: "Draft", tone: "neutral" };
    case "verified":
      return { label: "Verified", tone: "success" };
    case "failed":
      return { label: "Needs attention", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function sectionStatusMeta(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "queued":
      return { label: "Queued", tone: "neutral" };
    case "writing":
      return { label: "Writing", tone: "info" };
    case "written":
      return { label: "Written", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function publishStatusMeta(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "idle":
      return { label: "Not generated", tone: "neutral" };
    case "generating":
      return { label: "Generating", tone: "info" };
    case "ready":
      return { label: "Ready to publish", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function runStatusMeta(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "queued":
      return { label: "Queued", tone: "neutral" };
    case "running":
      return { label: "Running", tone: "info" };
    case "completed":
      return { label: "Completed", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export function knowledgeMeta(kind: string): { label: string; tone: PillTone } {
  switch (kind) {
    case "fact":
      return { label: "Fact", tone: "success" };
    case "inference":
      return { label: "Inference", tone: "info" };
    case "suggestion":
      return { label: "AI suggestion", tone: "accent" };
    case "unverified":
      return { label: "Unverified", tone: "warning" };
    default:
      return { label: kind, tone: "neutral" };
  }
}

export function severityMeta(severity: string): {
  label: string;
  tone: PillTone;
} {
  switch (severity) {
    case "critical":
      return { label: "Critical", tone: "danger" };
    case "warning":
      return { label: "Warning", tone: "warning" };
    default:
      return { label: "Note", tone: "neutral" };
  }
}

export function runKindLabel(kind: string): string {
  switch (kind) {
    case "idea_development":
      return "Idea development";
    case "research":
      return "Research";
    case "script_outline":
      return "Script outline";
    case "script_section":
      return "Section writing";
    case "script_verification":
      return "Verification";
    case "publish_pack":
      return "Publish kit";
    default:
      return kind;
  }
}
