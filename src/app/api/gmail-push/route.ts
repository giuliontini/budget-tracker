// src/app/api/gmail-push/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for processing

import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { google, gmail_v1 } from "googleapis";
import { parseAmexLargePurchase } from "@/lib/parseAmex";
import { lookupCategory } from '@/lib/classifier';
import prisma from "@/lib/prisma";

// ===== Config =====
const AUDIENCE =
  process.env.PUBSUB_PUSH_AUDIENCE ??
  "https://finances-tracker-468805.uw.r.appspot.com/api/gmail-push";

const PUSH_SERVICE_ACCOUNT =
  process.env.PUBSUB_PUSH_SA_EMAIL ??
  "finances-tracker-468805@appspot.gserviceaccount.com";

const ALLOWED_ISS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

const AMEX_FROM = "AmericanExpress@welcome.americanexpress.com";
const AMEX_SUBJECT = "Large Purchase Approved";

const PROCESSING_TIME_BUDGET_MS = 55_000; // Keep a buffer below the 60s hard limit

class ProcessingDeadlineError extends Error {
  constructor() {
    super("Processing time budget exhausted");
  }
}

class GmailHistoryResyncError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function compareHistoryIds(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const ai = BigInt(a);
  const bi = BigInt(b);
  if (ai === bi) return 0;
  return ai > bi ? 1 : -1;
}

function isHistoryIdNotFoundError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: number; errors?: Array<{ reason?: string }>; message?: string };
  const message = anyErr.message ?? "";
  const reason = anyErr.errors?.some(e => e.reason === "historyIdNotFound");
  return anyErr.code === 404 && (reason || /historyid/i.test(message));
}

// ------- OIDC verify -------
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

// ------- Gmail client -------
async function getGmailClientFor(): Promise<gmail_v1.Gmail> {
  const access_token = process.env.GMAIL_ACCESS_TOKEN;
  const refresh_token = process.env.GMAIL_REFRESH_TOKEN;
  const expiry_date = process.env.GMAIL_EXPIRY_DATE ? Number(process.env.GMAIL_EXPIRY_DATE) : undefined;

  if (!access_token || !refresh_token) {
    throw new Error("Missing Gmail OAuth tokens");
  }

  const oAuth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oAuth2.setCredentials({ access_token, refresh_token, expiry_date });
  return google.gmail({ version: "v1", auth: oAuth2 });
}

// ------- State helpers -------
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

async function resetHistoryPointer(gmail: gmail_v1.Gmail, emailAddress: string) {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const latestHistoryId = profile.data.historyId;

  if (!latestHistoryId) {
    throw new GmailHistoryResyncError("Unable to obtain latest Gmail historyId");
  }

  await setLastHistoryId(emailAddress, latestHistoryId);
  console.warn(
    `[Gmail Push] Gmail historyId too old. Resetting pointer to ${latestHistoryId}`
  );

  return latestHistoryId;
}

// ------- Duplicate detection helper -------
async function isTransactionDuplicate(
  date: Date,
  description: string,
  amount: number
): Promise<boolean> {
  // Check for existing transaction with same date, description, and amount
  // within a 1-day window to account for timezone differences
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const existing = await prisma.transaction.findFirst({
    where: {
      date: {
        gte: dayBefore,
        lte: dayAfter,
      },
      description,
      amount,
    },
  });

  return !!existing;
}

// ------- History processing with enhanced error handling -------
async function processHistory(emailAddress: string, pushedHistoryId: string) {
  console.log(`[Gmail Push] Processing history for ${emailAddress}, historyId: ${pushedHistoryId}`);

  try {
    const gmail = await getGmailClientFor();
    const saved = await getLastHistoryId(emailAddress);
    const start = saved && compareHistoryIds(saved, pushedHistoryId) > 0 ? saved : pushedHistoryId;

    let pageToken: string | undefined;
    let newest = start;
    let checkpoint = start;
    let messagesProcessed = 0;
    let transactionsCreated = 0;
    const errors: Array<{ messageId: string; error: string }> = [];
    const startedAt = Date.now();

    do {
      if (Date.now() - startedAt > PROCESSING_TIME_BUDGET_MS) {
        throw new ProcessingDeadlineError();
      }

      let res;
      try {
        res = await gmail.users.history.list({
          userId: "me",
          startHistoryId: start,
          historyTypes: ["messageAdded"],
          pageToken,
          maxResults: 100,
        });
      } catch (pageError) {
        if (isHistoryIdNotFoundError(pageError)) {
          await resetHistoryPointer(gmail, emailAddress);
          throw new GmailHistoryResyncError("historyIdNotFound");
        }
        console.error(`[Gmail Push] Error processing history page:`, pageError);
        throw pageError;
      }

      pageToken = res.data.nextPageToken ?? undefined;

      for (const h of res.data.history ?? []) {
        if (Date.now() - startedAt > PROCESSING_TIME_BUDGET_MS) {
          throw new ProcessingDeadlineError();
        }
        if (h.id && BigInt(h.id) > BigInt(newest)) newest = h.id;

        for (const ma of h.messagesAdded ?? []) {
          if (Date.now() - startedAt > PROCESSING_TIME_BUDGET_MS) {
            throw new ProcessingDeadlineError();
          }
          const id = ma.message?.id;
          if (!id) continue;

          try {
            messagesProcessed++;

            // Fetch full message
            const m = await gmail.users.messages.get({
              userId: "me",
              id,
              format: "full"
            });

            const headers = m.data.payload?.headers ?? [];
            const from = headers.find(hh => hh.name?.toLowerCase() === "from")?.value || "";
            const subject = headers.find(hh => hh.name?.toLowerCase() === "subject")?.value || "";

            // Check if this is an AMEX large purchase email
            const isAmex =
              from.includes(AMEX_FROM) && subject.trim() === AMEX_SUBJECT;

            if (!isAmex) continue;

            console.log(`[Gmail Push] Processing AMEX email: ${id}`);

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

            if (!html) {
              console.warn(`[Gmail Push] No HTML content in message ${id}`);
              errors.push({ messageId: id, error: "no-html-content" });
              continue;
            }

            // Parse with fallback date
            const dateHeader = headers.find(hh => hh.name?.toLowerCase() === "date")?.value ?? undefined;
            const parsed = parseAmexLargePurchase(html, { rfc2822Date: dateHeader });

            // Enhanced validation
            if (!parsed.amount || !parsed.merchant || !parsed.date) {
              console.warn(`[Gmail Push] AMEX parse incomplete for ${id}:`, {
                merchant: parsed.merchant,
                amount: parsed.amount,
                date: parsed.date,
                confidence: parsed.confidence,
                reason: parsed.reason,
              });
              errors.push({
                messageId: id,
                error: `parse-incomplete: ${parsed.reason}`
              });
              continue;
            }

            // Low confidence warning
            if (parsed.confidence === 'low') {
              console.warn(`[Gmail Push] Low confidence parse for ${id}:`, parsed);
            }

            // Check for duplicates BEFORE inserting
            const isDuplicate = await isTransactionDuplicate(
              parsed.date,
              parsed.merchant,
              parsed.amount
            );

            if (isDuplicate) {
              console.log(`[Gmail Push] Skipping duplicate transaction: ${parsed.merchant} $${parsed.amount}`);
              continue;
            }

            // Classify and create transaction
            const category = await lookupCategory(parsed.merchant);
            const status = category ? 'confirmed' : 'pending';

            await prisma.transaction.create({
              data: {
                date: parsed.date,
                description: parsed.merchant,
                amount: parsed.amount,
                category,
                status,
              },
            });

            transactionsCreated++;
            console.log(`[Gmail Push] Created transaction: ${parsed.merchant} $${parsed.amount}`);

          } catch (msgError) {
            const errMsg = msgError instanceof Error ? msgError.message : String(msgError);
            console.error(`[Gmail Push] Error processing message ${id}:`, errMsg);
            errors.push({ messageId: id, error: errMsg });
          }
        }
      }

      if (newest && compareHistoryIds(newest, checkpoint) > 0) {
        checkpoint = newest;
        await setLastHistoryId(emailAddress, checkpoint);
        console.log(`[Gmail Push] Advanced checkpoint to ${checkpoint}`);
      }
    } while (pageToken);

    console.log(`[Gmail Push] Complete: ${messagesProcessed} messages, ${transactionsCreated} transactions, ${errors.length} errors`);

    if (errors.length > 0) {
      console.log(`[Gmail Push] Errors:`, errors);
    }

  } catch (error) {
    console.error(`[Gmail Push] Fatal error processing history:`, error);
    throw error;
  }
}

// ------- HTTP entrypoint -------
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify the push notification is authentic
    await verifyPubSubOidc(req);

    if (!/application\/json/i.test(req.headers.get("content-type") || "")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }
    
    const body = await req.json();
    const msg = body?.message;
    
    // Acknowledge immediately if no data (Pub/Sub health check)
    if (!msg?.data) {
      console.log("[Gmail Push] Received empty message, acknowledging");
      return NextResponse.json({ ok: true });
    }

    // Decode the push payload
    const { emailAddress, historyId } = JSON.parse(
      Buffer.from(msg.data, "base64").toString("utf8")
    ) as { emailAddress?: string; historyId?: string };

    if (!emailAddress || !historyId) {
      console.warn("[Gmail Push] Missing emailAddress or historyId");
      return NextResponse.json({ ok: true }); // Acknowledge to prevent retries
    }

    console.log(`[Gmail Push] Received notification: ${emailAddress}, ${historyId}`);

    // Process history synchronously (changed from fire-and-forget)
    // This ensures we don't ACK until processing is complete
    try {
      await processHistory(emailAddress, historyId);

      const duration = Date.now() - startTime;
      console.log(`[Gmail Push] Processing completed in ${duration}ms`);

      return NextResponse.json({
        ok: true,
        processed: true,
        duration
      });
    } catch (processError) {
      if (processError instanceof GmailHistoryResyncError) {
        console.warn(`[Gmail Push] Gmail requested resync, acknowledging push.`);
        return NextResponse.json({ ok: true, resynced: true });
      }

      const errMsg = processError instanceof Error ? processError.message : String(processError);
      const retryable = processError instanceof ProcessingDeadlineError;
      console.error(`[Gmail Push] Processing failed:`, errMsg);

      // Return 500 to trigger Pub/Sub retry with exponential backoff
      return NextResponse.json(
        {
          error: "Processing failed",
          message: errMsg,
          retryable,
        },
        { status: 500 }
      );
    }

  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[Gmail Push] Request error:`, m);
    
    const status = /token|auth/i.test(m) ? 401 : 400;
    return NextResponse.json({ error: m }, { status });
  }
}