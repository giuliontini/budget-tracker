// src/app/api/gmail-push/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { google, gmail_v1 } from "googleapis";
import { parseAmexLargePurchase } from "@/lib/parseAmex";
import { lookupCategory } from '@/lib/classifier';
import prisma from "@/lib/prisma";

// ===== Config you can override via env =====
const AUDIENCE =
  process.env.PUBSUB_PUSH_AUDIENCE ??
  "https://finances-tracker-468805.uw.r.appspot.com/api/gmail-push";

const PUSH_SERVICE_ACCOUNT =
  process.env.PUBSUB_PUSH_SA_EMAIL ??
  "finances-tracker-468805@appspot.gserviceaccount.com"; // <-- your choice

const ALLOWED_ISS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

const AMEX_FROM = "AmericanExpress@welcome.americanexpress.com";
const AMEX_SUBJECT = "Large Purchase Approved";

// ------- OIDC verify (Pub/Sub -> your server) -------
async function verifyPubSubOidc(req: NextRequest) {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authz?.startsWith("Bearer ")) throw new Error("Missing bearer token");
  const token = authz.slice("Bearer ".length);

  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: token, audience: AUDIENCE });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid OIDC token");
  if (!payload.iss || !ALLOWED_ISS.has(payload.iss)) throw new Error("Bad issuer");
  if (payload.email !== PUSH_SERVICE_ACCOUNT) throw new Error("Wrong service account");
}

// ------- Gmail client (single-inbox via env, or per-user via DB) -------
async function getGmailClientFor(emailAddress: string): Promise<gmail_v1.Gmail> {
  // Single-inbox: use env tokens you’ve put in .env
  // If you later store tokens in DB (GmailCredential), fetch them here by emailAddress.
  const access_token = process.env.GMAIL_ACCESS_TOKEN;
  const refresh_token = process.env.GMAIL_REFRESH_TOKEN;
  const expiry_date = process.env.GMAIL_EXPIRY_DATE ? Number(process.env.GMAIL_EXPIRY_DATE) : undefined;

  if (!access_token || !refresh_token) {
    throw new Error("Missing Gmail OAuth tokens (GMAIL_ACCESS_TOKEN / GMAIL_REFRESH_TOKEN)");
  }

  const oAuth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oAuth2.setCredentials({ access_token, refresh_token, expiry_date });
  return google.gmail({ version: "v1", auth: oAuth2 });
}

// ------- Gmail state helpers -------
async function getLastHistoryId(emailAddress: string): Promise<string | null> {
  const row = await prisma.gmailState.findUnique({ where: { emailAddress } });
  return row?.historyId ?? null;
}

async function setLastHistoryId(emailAddress: string, historyId: string) {
  await prisma.gmailState.upsert({
    where: { emailAddress },
    update: { historyId },
    create: { emailAddress, historyId },
  });
}


// ------- History processing -------
async function processHistory(emailAddress: string, pushedHistoryId: string) {
  const gmail = await getGmailClientFor(emailAddress);
  const start = (await getLastHistoryId(emailAddress)) ?? pushedHistoryId;

  let pageToken: string | undefined;
  let newest = start;

  do {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId: start,
      historyTypes: ["messageAdded"],
      pageToken,
      maxResults: 500,
    });
    pageToken = res.data.nextPageToken ?? undefined;

    for (const h of res.data.history ?? []) {
      if (h.id && BigInt(h.id) > BigInt(newest)) newest = h.id;

      for (const ma of h.messagesAdded ?? []) {
        const id = ma.message?.id;
        if (!id) continue;

        const m = await gmail.users.messages.get({ userId: "me", id, format: "full" });

        const headers = m.data.payload?.headers ?? [];
        const from = headers.find(hh => hh.name?.toLowerCase() === "from")?.value || "";
        const subject = headers.find(hh => hh.name?.toLowerCase() === "subject")?.value || "";

        const isAmex =
          from.includes(AMEX_FROM) && subject.trim() === AMEX_SUBJECT;

        if (!isAmex) continue;

        // Collect HTML
        let html = "";
        const walk = (p?: gmail_v1.Schema$MessagePart) => {
          if (!p) return;
          if (p.mimeType === "text/html" && p.body?.data) {
            html += Buffer.from(p.body.data, "base64").toString("utf-8");
          }
          p.parts?.forEach(walk);
        };
        walk(m.data.payload);
        if (!html && m.data.payload?.body?.data) {
          html = Buffer.from(m.data.payload.body.data, "base64").toString("utf-8");
        }

        // Use Date header as a fallback for the parser
        const dateHeader = headers.find(hh => hh.name?.toLowerCase() === "date")?.value ?? undefined;

        const parsed = parseAmexLargePurchase(html, { rfc2822Date: dateHeader });

        if (!parsed.amount || !parsed.merchant || !parsed.date) {
        console.warn("AMEX parse failed", {
            gmailId: m.data.id,
            parsedPreview: parsed,
            snippet: m.data.snippet,
        });
        continue; // skip insert for this message
        }

        const category = await lookupCategory(parsed.merchant)
        const status = category ? 'confirmed' : 'pending'

        await prisma.transaction.create({
        data: {
            date: parsed.date,
            description: `${parsed.merchant}`,
            amount: parsed.amount,
            status: status,
        },
        });

      }
    }
  } while (pageToken);

  if (newest !== start) {
    await setLastHistoryId(emailAddress, newest);
  }
}

// ------- HTTP entrypoint -------
export async function POST(req: NextRequest) {
  try {
    await verifyPubSubOidc(req);

    if (!/application\/json/i.test(req.headers.get("content-type") || "")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }
    const body = await req.json();
    const msg = body?.message;
    if (!msg?.data) return NextResponse.json({ ok: true });

    // Gmail push payload: { emailAddress, historyId }
    const { emailAddress, historyId } = JSON.parse(
      Buffer.from(msg.data, "base64").toString("utf8")
    ) as { emailAddress?: string; historyId?: string };

    if (emailAddress && historyId) {
      // fire-and-forget so we ACK fast
      void processHistory(emailAddress, historyId).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    const status = /token|auth/i.test(m) ? 401 : 400;
    return NextResponse.json({ error: m }, { status });
  }
}
