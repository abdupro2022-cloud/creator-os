import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n/provider";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Film,
  Loader2,
  RefreshCw,
  ThumbsUp,
  Users,
} from "lucide-react";

/**
 * Channel statistics — the one YouTube feature that really runs today.
 *
 * Reading public channel numbers needs only the plain API key, so this card
 * calls `youtube.channelStats` directly. Uploading is a different credential
 * entirely (OAuth2, not an API key), which is why the readiness block below
 * reports what is missing instead of showing a button that would fail.
 */

type Stats = {
  ok: boolean;
  channel?: {
    id: string;
    title: string;
    handle: string | null;
    subscribers: number | null;
    views: number;
    videoCount: number | null;
    publishedAt: string | null;
    country: string | null;
    description: string | null;
  };
  recent: {
    videoId: string;
    title: string;
    publishedAt: string | null;
    views: number;
    likes: number;
    comments: number;
    relativeToAverage: number | null;
  }[];
  quotaUsed: number;
  fetchedAt: number;
  error?: string;
};

type Readiness = {
  ok: boolean;
  ready: boolean;
  missing: { key: string; why: string }[];
  instructions: string[];
  error?: string;
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ChannelCard() {
  const { t } = useI18n();
  const channelStats = useAction(api.youtube.channelStats);
  const uploadReadiness = useAction(api.youtube.uploadReadiness);

  const [stats, setStats] = useState<Stats | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await channelStats({});
      setStats(result);
      if (!result.ok) {
        toast.error(t("Could not read the channel"), {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error(t("Could not read the channel"), {
        description:
          error instanceof Error
            ? error.message.slice(0, 300)
            : t("Something went wrong."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkReadiness = async () => {
    setIsChecking(true);
    try {
      setReadiness(await uploadReadiness({}));
    } catch (error) {
      toast.error(t("Could not check upload readiness"), {
        description:
          error instanceof Error
            ? error.message.slice(0, 300)
            : t("Something went wrong."),
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <section className="surface-panel flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">
            {t("Channel statistics")}
          </h2>
          {stats?.ok ? (
            <StatusPill label={t("Read")} tone="success" dot />
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isLoading}
          onClick={load}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {stats ? t("Refresh") : t("Load statistics")}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          "Reads public numbers through the YouTube Data API. Configure your channel id or @handle in Settings; the key alone is enough to read, never to upload.",
        )}
      </p>

      {stats?.ok && stats.channel ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              dir="auto"
              className="text-sm font-semibold tracking-tight break-words"
            >
              {stats.channel.title}
            </span>
            {stats.channel.handle ? (
              <span dir="ltr" className="text-xs text-muted-foreground">
                {stats.channel.handle}
              </span>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border/60 p-2.5">
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t("Subscribers")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {stats.channel.subscribers === null
                  ? t("Hidden")
                  : formatCount(stats.channel.subscribers)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t("Views")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatCount(stats.channel.views)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t("Videos")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {stats.channel.videoCount === null
                  ? "—"
                  : formatCount(stats.channel.videoCount)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 p-2.5">
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t("Quota used")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {stats.quotaUsed}
              </dd>
            </div>
          </dl>

          {stats.recent.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t("Recent uploads")}
              </span>
              <ul className="flex flex-col gap-1.5">
                {stats.recent.slice(0, 5).map((video) => (
                  <li
                    key={video.videoId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                  >
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="auto"
                      className="min-w-0 flex-1 truncate text-xs underline-offset-2 hover:underline"
                    >
                      {video.title}
                    </a>
                    <span className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {formatCount(video.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="size-3" />
                        {formatCount(video.likes)}
                      </span>
                      {video.relativeToAverage !== null ? (
                        <span
                          className={
                            video.relativeToAverage >= 100
                              ? "text-success"
                              : "text-warning"
                          }
                        >
                          {video.relativeToAverage}%
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t(
                  "The percentage compares each upload's views against your channel average across these videos.",
                )}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {stats && !stats.ok && stats.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/8 p-2.5 text-xs leading-relaxed break-words text-destructive">
          {stats.error}
        </p>
      ) : null}

      {/* ------------------------ upload readiness ------------------------ */}
      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Film className="size-3.5 text-primary" />
            {t("Uploading")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground"
            disabled={isChecking}
            onClick={checkReadiness}
          >
            {isChecking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {t("Check readiness")}
          </Button>
        </div>

        {readiness ? (
          readiness.ready ? (
            <p className="mt-2 text-xs leading-relaxed text-success">
              {t(
                "All three OAuth values are present. Publishing through the upload endpoint is possible.",
              )}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                {t(
                  "Reading a channel needs an API key. Uploading needs OAuth2 and cannot be done with a key — that is why there is no upload button here.",
                )}
              </p>
              {readiness.missing.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {readiness.missing.map((item) => (
                    <li
                      key={item.key}
                      className="flex flex-col gap-0.5 rounded-lg border border-border/60 p-2"
                    >
                      <code
                        dir="ltr"
                        className="font-mono text-[11px] text-foreground"
                      >
                        {item.key}
                      </code>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">
                        {item.why}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {readiness.error ? (
                <p className="text-xs break-words text-destructive">
                  {readiness.error}
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
