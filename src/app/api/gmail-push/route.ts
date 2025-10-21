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
    const start = (await getLastHistoryId(emailAddress)) ?? pushedHistoryId;

    let pageToken: string | undefined;
    let newest = start;
    let messagesProcessed = 0;
    let transactionsCreated = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    do {
      try {
        const res = await gmail.users.history.list({
          userId: "me",
          startHistoryId: start,
          historyTypes: ["messageAdded"],
          pageToken,
          maxResults: 100, // Reduced from 500 for more reliable processing
        });
        
        pageToken = res.data.nextPageToken ?? undefined;

        for (const h of res.data.history ?? []) {
          if (h.id && BigInt(h.id) > BigInt(newest)) newest = h.id;

          for (const ma of h.messagesAdded ?? []) {
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
      } catch (pageError) {
        console.error(`[Gmail Push] Error processing history page:`, pageError);
        throw pageError; // Re-throw to be caught by outer try-catch
      }
    } while (pageToken);

    // Update history ID only if we successfully processed everything
    if (newest !== start) {
      await setLastHistoryId(emailAddress, newest);
      console.log(`[Gmail Push] Updated historyId to ${newest}`);
    }

    console.log(`[Gmail Push] Complete: ${messagesProcessed} messages, ${transactionsCreated} transactions, ${errors.length} errors`);
    
    if (errors.length > 0) {
      console.log(`[Gmail Push] Errors:`, errors);
    }

  } catch (error) {
    console.error(`[Gmail Push] Fatal error processing history:`, error);
    throw error; // Will be caught by the POST handler
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
      const errMsg = processError instanceof Error ? processError.message : String(processError);
      console.error(`[Gmail Push] Processing failed:`, errMsg);
      
      // Return 500 to trigger Pub/Sub retry with exponential backoff
      return NextResponse.json(
        { 
          error: "Processing failed", 
          message: errMsg 
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