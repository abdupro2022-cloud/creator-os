"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Google Sheets as a tracking sheet.
 *
 * A service account is the only credential that can write without a browser
 * consent flow, and the creator supplies it as the JSON key file Google hands
 * out. Signing the JWT by hand keeps the dependency list unchanged: the only
 * primitives needed are an RSA signature and base64url, both in the platform.
 *
 * The sheet must be shared with the service account's `client_email` — that is
 * the step people miss, and it is called out in the error when an append fails.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TIMEOUT_MS = 15_000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function readCredentials(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS?.trim();
  if (!raw) return null;
  try {
    // The Keys tab may store the JSON with its newlines escaped.
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sheetConfigured(): boolean {
  return readCredentials() !== null;
}

function base64Url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const HEADER: Record<string, string> = {
  alg: "RS256",
  typ: "JWT",
};

/**
 * Exchange the service account for a short-lived access token using the JWT
 * bearer flow. Google accepts the assertion signed with the account's own key,
 * so no client library is involved.
 */
export async function getSheetAccessToken(): Promise<string | null> {
  const credentials = readCredentials();
  if (!credentials) return null;

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: credentials.token_uri ?? TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(HEADER))}.${base64Url(
    JSON.stringify(claims),
  )}`;

  const pem = credentials.private_key.replace(/\\n/g, "\n");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  try {
    const response = await fetch(credentials.token_uri ?? TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

/** Strip the PEM armour and hand back raw PKCS#8 DER bytes. */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export interface SheetRow {
  title: string;
  description: string;
  tags: string;
  publishDate: string;
  status: string;
  chapters: number;
  shorts: number;
  scriptWords: number;
  model: string;
  packId: string;
  url: string;
}

export interface AppendResult {
  ok: boolean;
  row: number | null;
  sheetUrl: string | null;
  error?: string;
}

/**
 * Append one publish kit as a tracking row.
 *
 * The header row is written once, on the first append, so the sheet is readable
 * the first time it is used rather than only after a second visit.
 */
export const appendPublishKit = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args): Promise<AppendResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, row: null, sheetUrl: null, error: "You are not signed in." };
    }

    const [settings, loaded] = await Promise.all([
      ctx.runQuery(internal.settings.forUser, { ownerId: userId }),
      ctx.runQuery(internal.publishing.forTrackingSheet, {
        scriptId: args.scriptId,
        ownerId: userId,
      }),
    ]);

    const spreadsheetId = settings.trackingSheetId?.trim();
    if (!spreadsheetId) {
      return {
        ok: false,
        row: null,
        sheetUrl: null,
        error:
          "No tracking spreadsheet configured. Add the spreadsheet id in Settings first.",
      };
    }
    if (!loaded) {
      return {
        ok: false,
        row: null,
        sheetUrl: null,
        error: "Generate the publish kit before pushing it to the sheet.",
      };
    }

    const token = await getSheetAccessToken();
    if (!token) {
      return {
        ok: false,
        row: null,
        sheetUrl: null,
        error:
          readCredentials() === null
            ? "GOOGLE_SHEETS_CREDENTIALS is not set on this deployment."
            : "Google rejected the service account credentials.",
      };
    }

    const kit = loaded.pack;
    const chosen = kit.chosenTitleIndex ?? 0;
    const title = kit.titles[chosen]?.text ?? kit.titles[0]?.text ?? "Untitled";
    const tab = settings.trackingSheetTab?.trim() || "A1";

    const header = [
      "Title",
      "Description",
      "Tags",
      "Publish date",
      "Status",
      "Chapters",
      "Shorts",
      "Script words",
      "Pack model",
      "Pack id",
      "Source",
    ];
    const values: (string | number)[][] = [
      header,
      [
        title,
        kit.description.slice(0, 2000),
        kit.tags.join(", "),
        "",
        kit.status,
        kit.chapters.length,
        kit.shorts.length,
        loaded.wordCount,
        kit.model ?? "",
        kit._id,
        `${args.scriptId}`,
      ],
    ];

    try {
      // INSERT_ROWS on a named range appends below existing content, and the
      // first call includes the header so the sheet is legible immediately.
      const response = await fetch(
        `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      const body = await response.text().catch(() => "");
      if (!response.ok) {
        let message = `Google Sheets answered HTTP ${response.status}.`;
        if (response.status === 403 || response.status === 404) {
          message =
            "Google refused the write. Share the spreadsheet with the service account's client_email (found in the credentials JSON) with Editor access.";
        }
        try {
          const parsed = JSON.parse(body) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message.slice(0, 240);
        } catch {
          // Not JSON.
        }
        return { ok: false, row: null, sheetUrl: null, error: message };
      }

      const payload = JSON.parse(body) as {
        updates?: { updatedRange?: string };
      };
      const range = payload.updates?.updatedRange ?? "";
      const startRow = Number.parseInt(range.split("!")[1]?.replace(/\D/g, "") ?? "", 10);
      return {
        ok: true,
        row: Number.isFinite(startRow) ? startRow : null,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      };
    } catch (error) {
      return {
        ok: false,
        row: null,
        sheetUrl: null,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "Google Sheets did not answer within 15s."
            : error instanceof Error
              ? error.message.slice(0, 240)
              : "The append could not be completed.",
      };
    }
  },
});
