// /src/lib/parseAmex.ts
import * as cheerio from "cheerio";

const AMEX_FROM = "AmericanExpress@welcome.americanexpress.com";
const AMEX_SUBJECT = "Large Purchase Approved";

export type ParsedTx = {
  merchant?: string;
  amount?: number;
  date?: Date;
  reason?: string; // debugging
};

function cleanText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

// Heuristic: merchant is typically UPPERCASE words (letters, spaces & ampersand)
function findMerchant($: cheerio.CheerioAPI): string | undefined {
  // scan headings and strongish elements first
  const candidates: string[] = [];
  $("h1,h2,h3,strong,b,td,div,p,span").each((_, el) => {
    const t = cleanText($(el).text() || "");
    if (!t) return;

    // all-caps-ish and not the boilerplate sentence
    const isCapsy = /^[A-Z0-9&\-\.\s]{3,}$/.test(t) && /[A-Z]/.test(t);
    const notDollar = !/\$\s*\d/.test(t);
    const notBoiler = !/there was a large purchase on your card/i.test(t);
    if (isCapsy && notDollar && notBoiler) candidates.push(t);
  });

  // pick the longest “capsy” chunk (usually the merchant)
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function findAmountsFromText(text: string): number[] {
  const amounts: number[] = [];
  const re = /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    amounts.push(n);
  }
  return amounts;
}

function findDate(text: string): Date | undefined {
  // Formats like: "Fri, Aug 29, 2025" or "Aug 29, 2025"
  const m1 = text.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/
  );
  if (m1) return new Date(`${m1[1]} ${m1[2]}, ${m1[3]}`);

  const m2 = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (m2) return new Date(`${m2[1]} ${m2[2]}, ${m2[3]}`);

  return undefined;
}

export function parseAmexLargePurchase(html: string, fallbacks: {
  // you can pass the RFC2822 Date header from Gmail if needed
  rfc2822Date?: string;
} = {}): ParsedTx {
  const $ = cheerio.load(html);
  const fullText = cleanText($("body").text());

  const merchant = findMerchant($);

  // Try to find a “section” that contains the merchant and then grab the closest amount on that side
  let preferredAmount: number | undefined;
  if (merchant) {
    // locate the element that exactly matches merchant (or very close)
    let node = $("*").filter((_, el) => cleanText($(el).text()) === merchant).first();
    if (!node.length) {
      // relaxed contains
      node = $("*").filter((_, el) => cleanText($(el).text()).includes(merchant)).first();
    }
    if (node.length) {
      // Search sibling/parent area for the first $ amount
      const neighborhood = cleanText(
        node
          .parent()
          .text()
      );
      const nearAmts = findAmountsFromText(neighborhood);
      if (nearAmts.length) preferredAmount = Math.max(...nearAmts);
    }
  }

  // Global amounts in the whole email
  let allAmts = findAmountsFromText(fullText);

  // Filter out the “more than $1.00” boilerplate
  if (/more than\s*\$1\.00/i.test(fullText)) {
    allAmts = allAmts.filter((n) => n !== 1);
  }

  // Choose by preference: neighborhood > largest in body
  const amount = preferredAmount ?? (allAmts.length ? Math.max(...allAmts) : undefined);

  // Date from body, fallback to header
  let date = findDate(fullText);
  if (!date && fallbacks.rfc2822Date) {
    const d = new Date(fallbacks.rfc2822Date);
    if (!Number.isNaN(d.getTime())) date = d;
  }

  return {
    merchant,
    amount,
    date,
    reason: !amount ? "no-amount" : !merchant ? "no-merchant" : "ok",
  };
}

export const AMEX_FILTERS = { from: AMEX_FROM, subject: AMEX_SUBJECT };
