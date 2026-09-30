"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getSheetAccessToken, sheetConfigured } from "./sheets";

/**
 * YouTube Data API v3.
 *
 * Two very different jobs live behind the same API:
 *
 *   reading    works with a plain API key. Channel statistics, recent uploads
 *              and per-video numbers are public data, so a key is enough.
 *   uploading  does NOT. The upload endpoint authorises on behalf of a user, so
 *              it needs an OAuth2 client created in the creator's own Google
 *              Cloud project. This module refuses to pretend otherwise: the
 *              action returns the exact steps instead of failing obscurely.
 *
 * The split matters because "I have a YouTube key" and "I can publish from
 * here" are different claims, and only the first one is true from a key alone.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 15_000;

/** The quota unit cost of each call this module makes, per Google's table. */
const QUOTA_COST = {
  channels: 1,
  search: 100,
  videoList: 1,
} as const;

export interface ChannelStats {
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
  /** Recent uploads with their real numbers, newest first. */
  recent: {
    videoId: string;
    title: string;
    publishedAt: string | null;
    views: number;
    likes: number;
    comments: number;
    /** Retention of the last 24h against the channel's average view count. */
    relativeToAverage: number | null;
  }[];
  quotaUsed: number;
  fetchedAt: number;
  error?: string;
}

export interface UploadReadiness {
  ok: boolean;
  ready: boolean;
  /** What is missing, in the order it must be fixed. */
  missing: { key: string; why: string }[];
  instructions: string[];
  error?: string;
}

function requireKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not set on this deployment. Add it in the project's Keys tab.",
    );
  }
  return key;
}

async function youtubeGet(
  path: string,
  params: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: response.status, body: await response.text().catch(() => "") };
}

function explain(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    if (parsed.error?.message) return parsed.error.message.slice(0, 240);
  } catch {
    // Not JSON.
  }
  if (status === 403) {
    return "YouTube refused the request. The API is probably not enabled for this key, or the daily quota is spent.";
  }
  if (status === 404) return "That channel was not found. Check the id or @handle.";
  return `YouTube answered HTTP ${status}.`;
}

/** YouTube abbreviates large counts as "1.2M" in the statistics block. */
export function parseAbbreviatedNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim();
  const match = /^([\d.]+)\s*([KMB])?$/.exec(text);
  if (!match) return null;
  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;
  const multiplier = { K: 1_000, M: 1_000_000, B: 1_000_000_000 } as const;
  const suffix = match[2] as "K" | "M" | "B" | undefined;
  return Math.round(base * (suffix ? multiplier[suffix] : 1));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export { formatCount };

/* ------------------------------ channel stats ----------------------------- */

export const channelStats = action({
  args: { channelId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<ChannelStats> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, recent: [], quotaUsed: 0, fetchedAt: Date.now(), error: "You are not signed in." };
    }

    // The channel is a setting, so the creator configures it once.
    const settings = await ctx.runQuery(internal.settings.forUser, {
      ownerId: userId,
    });
    const channel = args.channelId?.trim() || settings.youtubeChannelId?.trim();
    if (!channel) {
      return {
        ok: false,
        recent: [],
        quotaUsed: 0,
        fetchedAt: Date.now(),
        error:
          "No channel configured. Add your channel id or @handle in Settings, or pass one here.",
      };
    }

    const key = (() => {
      try {
        return requireKey();
      } catch (error) {
        return error instanceof Error ? `!${error.message}` : null;
      }
    })();
    if (!key || key.startsWith("!")) {
      return {
        ok: false,
        recent: [],
        quotaUsed: 0,
        fetchedAt: Date.now(),
        error: key?.slice(1) ?? "YOUTUBE_API_KEY is missing.",
      };
    }

    // A handle starts with @; a channel id starts with UC. The API needs the
    // matching parameter, and a creator is as likely to paste either one.
    const isHandle = channel.startsWith("@") || !channel.startsWith("UC");
    try {
      const channelResult = await youtubeGet("channels", {
        part: "statistics,snippet,contentDetails",
        ...(isHandle
          ? { forHandle: channel.replace(/^@/, "") }
          : { id: channel }),
        key,
      });
      if (channelResult.status !== 200) {
        return {
          ok: false,
          recent: [],
          quotaUsed: QUOTA_COST.channels,
          fetchedAt: Date.now(),
          error: explain(channelResult.status, channelResult.body),
        };
      }

      const payload = JSON.parse(channelResult.body) as {
        items?: {
          id: string;
          snippet?: {
            title?: string;
            customUrl?: string;
            publishedAt?: string;
            country?: string;
            description?: string;
          };
          statistics?: {
            subscriberCount?: string;
            viewCount?: string;
            videoCount?: string;
          };
          contentDetails?: {
            relatedPlaylists?: { uploads?: string };
          };
        }[];
      };
      const item = payload.items?.[0];
      if (!item) {
        return {
          ok: false,
          recent: [],
          quotaUsed: QUOTA_COST.channels,
          fetchedAt: Date.now(),
          error: "YouTube returned no channel for that id or handle.",
        };
      }

      const uploadsPlaylist = item.contentDetails?.relatedPlaylists?.uploads;
      let recent: ChannelStats["recent"] = [];
      let quotaUsed = QUOTA_COST.channels;

      if (uploadsPlaylist) {
        // The uploads playlist is free to read (1 unit) versus 100 for search.
        const playlistResult = await youtubeGet("playlistItems", {
          part: "snippet,contentDetails",
          playlistId: uploadsPlaylist,
          maxResults: "10",
          key,
        });
        if (playlistResult.status === 200) {
          quotaUsed += QUOTA_COST.videoList;
          const playlist = JSON.parse(playlistResult.body) as {
            items?: {
              snippet?: {
                videoId?: string;
                title?: string;
                publishedAt?: string;
              };
            }[];
          };
          const ids = (playlist.items ?? [])
            .map((entry) => entry.snippet?.videoId)
            .filter((id): id is string => Boolean(id));
          const titles = new Map(
            (playlist.items ?? []).map((entry) => [
              entry.snippet?.videoId,
              entry.snippet,
            ]),
          );
          const published = new Map(
            (playlist.items ?? []).map((entry) => [
              entry.snippet?.videoId,
              entry.snippet?.publishedAt ?? null,
            ]),
          );

          if (ids.length > 0) {
            const statsResult = await youtubeGet("videos", {
              part: "statistics",
              id: ids.join(","),
              key,
            });
            if (statsResult.status === 200) {
              quotaUsed += QUOTA_COST.videoList;
              const stats = JSON.parse(statsResult.body) as {
                items?: {
                  id: string;
                  statistics?: {
                    viewCount?: string;
                    likeCount?: string;
                    commentCount?: string;
                  };
                }[];
              };
              const averageViews =
                (stats.items ?? []).reduce(
                  (sum, video) =>
                    sum + Number.parseInt(video.statistics?.viewCount ?? "0", 10),
                  0,
                ) / Math.max(1, (stats.items ?? []).length);

              recent = (stats.items ?? []).map((video) => {
                const views = Number.parseInt(
                  video.statistics?.viewCount ?? "0",
                  10,
                );
                return {
                  videoId: video.id,
                  title: titles.get(video.id)?.title ?? "Untitled",
                  publishedAt: published.get(video.id) ?? null,
                  views,
                  likes: Number.parseInt(
                    video.statistics?.likeCount ?? "0",
                    10,
                  ),
                  comments: Number.parseInt(
                    video.statistics?.commentCount ?? "0",
                    10,
                  ),
                  relativeToAverage:
                    averageViews > 0
                      ? Math.round((views / averageViews) * 100)
                      : null,
                };
              });
            }
          }
        }
      }

      const stats = item.statistics ?? {};
      return {
        ok: true,
        channel: {
          id: item.id,
          title: item.snippet?.title ?? "Unknown channel",
          handle: item.snippet?.customUrl ?? null,
          subscribers: parseAbbreviatedNumber(stats.subscriberCount),
          views: Number.parseInt(stats.viewCount ?? "0", 10),
          videoCount: parseAbbreviatedNumber(stats.videoCount),
          publishedAt: item.snippet?.publishedAt ?? null,
          country: item.snippet?.country ?? null,
          description: item.snippet?.description?.slice(0, 600) ?? null,
        },
        recent,
        quotaUsed,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      return {
        ok: false,
        recent: [],
        quotaUsed: 0,
        fetchedAt: Date.now(),
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "YouTube did not answer within 15s."
            : error instanceof Error
              ? error.message.slice(0, 240)
              : "The request could not be completed.",
      };
    }
  },
});

/* ------------------------------ upload readiness --------------------------- */

/**
 * Publishing is a different problem from reading, and this action says so.
 *
 * The upload endpoint has no API-key path. It authorises a user through OAuth2,
 * and the client for that OAuth flow has to exist in the creator's own Google
 * Cloud project. So rather than a button that fails with an opaque 403, the app
 * reports exactly which pieces are absent and what to do about each.
 */
export const uploadReadiness = action({
  args: {},
  handler: async (ctx): Promise<UploadReadiness> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, ready: false, missing: [], instructions: [], error: "You are not signed in." };
    }

    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
    const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN?.trim();

    const missing: UploadReadiness["missing"] = [];
    if (!clientId) {
      missing.push({
        key: "YOUTUBE_OAUTH_CLIENT_ID",
        why: "An OAuth client id identifies your Google Cloud project to YouTube. It cannot be created from inside this app.",
      });
    }
    if (!clientSecret) {
      missing.push({
        key: "YOUTUBE_OAUTH_CLIENT_SECRET",
        why: "The client secret that pairs with the id above. Same Google Cloud project.",
      });
    }
    if (!refreshToken) {
      missing.push({
        key: "YOUTUBE_OAUTH_REFRESH_TOKEN",
        why: "A refresh token for your own channel, obtained once by approving the OAuth consent screen. This is the credential that lets the app publish as you.",
      });
    }

    const ready = missing.length === 0;
    return {
      ok: true,
      ready,
      missing,
      instructions: ready
        ? [
            "All three OAuth values are present. The publish kit can be sent to YouTube through the resumable upload endpoint.",
          ]
        : [
            "1. Open Google Cloud Console and create (or pick) a project.",
            "2. Enable the YouTube Data API v3 for that project.",
            "3. Under APIs & Services → Credentials, create an OAuth client ID of type 'Desktop app'.",
            "4. Configure the OAuth consent screen and add your own Google account as a test user.",
            "5. Run the one-time authorisation to obtain a refresh token for your channel, then add all three values in the Keys tab.",
            "Until that is done, the publish kit stays exactly what it is today: finished copy the creator pastes into YouTube themselves.",
          ],
    };
  },
});

/* ------------------------------- sheets link ------------------------------ */

/** Whether a tracking sheet is wired up, for the publish page to show. */
export const trackingReadiness = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; sheetReady: boolean; reason?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, sheetReady: false, reason: "You are not signed in." };
    const settings = await ctx.runQuery(internal.settings.forUser, {
      ownerId: userId,
    });
    if (!settings.trackingSheetId) {
      return {
        ok: true,
        sheetReady: false,
        reason: "No tracking spreadsheet configured in Settings.",
      };
    }
    if (!sheetConfigured()) {
      return {
        ok: true,
        sheetReady: false,
        reason: "GOOGLE_SHEETS_CREDENTIALS is not set on this deployment.",
      };
    }
    const token = await getSheetAccessToken();
    return {
      ok: true,
      sheetReady: Boolean(token),
      reason: token
        ? undefined
        : "The service account credentials were rejected by Google.",
    };
  },
});
