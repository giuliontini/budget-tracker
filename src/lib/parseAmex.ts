// src/lib/parseAmex.ts
import * as cheerio from "cheerio";

const AMEX_FROM = "AmericanExpress@welcome.americanexpress.com";
const AMEX_SUBJECT = "Large Purchase Approved";

export type ParsedTx = {
  merchant?: string;
  amount?: number;
  date?: Date;
  reason?: string;
  confidence?: 'high' | 'medium' | 'low';
};

function cleanText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

// AMEX-specific: merchant appears in blue (#006fcf) text
function findMerchantAmexStyle($: cheerio.CheerioAPI): { merchant?: string; confidence: 'high' | 'medium' | 'low' } {
  let bestCandidate: { text: string; score: number } | null = null;

  // Strategy 1: Look for blue-colored (#006fcf) text that's all caps
  // This is the most reliable indicator based on the real email
  $("*").each((_, el) => {
    const $el = $(el);
    const text = cleanText($el.text());
    
    // Check if element has the AMEX blue color
    const style = $el.attr("style") || "";
    const hasBlueColor = /color:\s*#006fcf/i.test(style);
    
    // Also check direct color attribute
    const colorAttr = $el.css("color");
    const isBlueColor = hasBlueColor || colorAttr === "#006fcf";
    
    if (isBlueColor && text.length > 3) {
      // Check if it's mostly uppercase (merchant names are usually all caps)
      const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.replace(/[^a-zA-Z]/g, '').length;
      
      if (uppercaseRatio > 0.5) {
        // Exclude known boilerplate phrases
        if (!/change the dollar amount|track this spending|contact us|update your/i.test(text)) {
          const score = 15; // High confidence for blue + uppercase
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { text, score };
          }
        }
      }
    }
  });

  // Strategy 2: Look in <p> tags with bold font for all-caps text near dollar signs
  if (!bestCandidate) {
    $("p").each((_, el) => {
      const $el = $(el);
      const text = cleanText($el.text());
      
      // Check if it's bold
      const isBold = $el.css("font-weight") === "bold" || 
                     $el.find("strong, b").length > 0 ||
                     /font-weight:\s*bold/i.test($el.attr("style") || "");
      
      if (isBold && /^[A-Z0-9\s&\-\.]{3,}$/.test(text)) {
        // Check if there's a dollar amount nearby
        const parent = $el.parent();
        const parentText = cleanText(parent.text());
        const hasDollarNearby = /\$\d+/.test(parentText);
        
        if (hasDollarNearby) {
          const score = 10;
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { text, score };
          }
        }
      }
    });
  }

  // Strategy 3: Fallback - look for all-caps text in table cells
  if (!bestCandidate) {
    $("td").each((_, el) => {
      const text = cleanText($(el).text());
      
      if (/^[A-Z0-9\s&\-\.]{5,50}$/.test(text)) {
        const notBoilerplate = !/there was a large purchase|your card|account ending|dear |american express/i.test(text);
        const noDollar = !/\$\d+/.test(text);
        
        if (notBoilerplate && noDollar) {
          const score = 5;
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { text, score };
          }
        }
      }
    });
  }

  if (!bestCandidate) {
    return { confidence: 'low' as const };
  }

  // Explicitly type bestCandidate to help TypeScript
  const candidate: { text: string; score: number } = bestCandidate;
  
  const confidence = candidate.score >= 15 ? ('high' as const) : 
                     candidate.score >= 10 ? ('medium' as const) : ('low' as const);
  
  return { merchant: candidate.text, confidence };
}

// Find amounts with their context
function findAmounts($: cheerio.CheerioAPI): Array<{ amount: number; context: unknown; isBold: boolean }> {
  const results: Array<{ amount: number; context: unknown; isBold: boolean }> = [];
  
  $("*").each((_, el) => {
    const $el = $(el);
    const text = cleanText($el.text());
    
    // Match dollar amounts including asterisk (for pre-auth notes)
    const match = text.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\*?/);
    
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      
      // Skip the $1.00 threshold mention
      if (amount === 1) {
        const hasThresholdContext = /more than|greater than|threshold/i.test(text);
        if (hasThresholdContext) return;
      }
      
      // Check if bold
      const isBold = $el.css("font-weight") === "bold" || 
                     /font-weight:\s*bold/i.test($el.attr("style") || "") ||
                     $el.find("strong, b").length > 0 ||
                     $el.closest("strong, b").length > 0;
      
      results.push({ amount, context: el, isBold });
    }
  });
  
  return results;
}

// Enhanced date detection
function findDate($: cheerio.CheerioAPI, fallbackRFC2822?: string): Date | undefined {
  let foundDate: Date | undefined;
  
  // Strategy 1: Look for date in the same table cell as the amount
  // AMEX puts "Sun, Oct 19, 2025" right below the amount
  $("*").each((_, el) => {
    const text = cleanText($(el).text());
    
    // Format: "Sun, Oct 19, 2025" or "Oct 19, 2025"
    const match = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
      if (!isNaN(parsed.getTime())) {
        foundDate = parsed;
        return false; // break the loop
      }
    }
  });
  
  // Strategy 2: Look for date without day name
  if (!foundDate) {
    $("*").each((_, el) => {
      const text = cleanText($(el).text());
      const match = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
      if (match && !/to stop this alert/i.test(text)) {
        const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
        if (!isNaN(parsed.getTime())) {
          foundDate = parsed;
          return false;
        }
      }
    });
  }
  
  // Fallback to RFC2822 header
  if (!foundDate && fallbackRFC2822) {
    const d = new Date(fallbackRFC2822);
    if (!isNaN(d.getTime())) foundDate = d;
  }
  
  return foundDate;
}

export function parseAmexLargePurchase(
  html: string,
  fallbacks: { rfc2822Date?: string } = {}
): ParsedTx {
  try {
    const $ = cheerio.load(html);
    
    // Find merchant using AMEX-specific patterns
    const merchantResult = findMerchantAmexStyle($);
    const merchant = merchantResult.merchant;
    let confidence = merchantResult.confidence;
    
    // Find amounts
    const amounts = findAmounts($);
    
    // Prefer bold amounts (the actual transaction amount)
    const boldAmounts = amounts.filter(a => a.isBold);
    const preferredAmounts = boldAmounts.length > 0 ? boldAmounts : amounts;
    
    // Get the largest amount (usually the actual purchase)
    const amount = preferredAmounts.length > 0 
      ? Math.max(...preferredAmounts.map(a => a.amount))
      : undefined;
    
    // Find date
    const date = findDate($, fallbacks.rfc2822Date);
    
    // Adjust confidence based on what we found
    if (amount && merchant) {
      // If we found both with high confidence, keep it high
      if (confidence === 'high') {
        confidence = 'high';
      } else {
        confidence = 'medium';
      }
    } else if (!merchant) {
      confidence = 'low';
    }
    
    // Determine reason
    let reason = 'ok';
    if (!amount) {
      reason = 'no-amount';
      confidence = 'low';
    } else if (!merchant) {
      reason = 'no-merchant';
      confidence = 'low';
    } else if (!date) {
      reason = 'no-date-using-header';
      // Don't lower confidence for missing date if we have fallback
      if (!fallbacks.rfc2822Date) {
        confidence = confidence === 'high' ? 'medium' : 'low';
      }
    }
    
    return {
      merchant,
      amount,
      date,
      reason,
      confidence,
    };
  } catch (error) {
    console.error("Error parsing AMEX email:", error);
    return {
      reason: 'parse-error',
      confidence: 'low',
    };
  }
}

export const AMEX_FILTERS = { from: AMEX_FROM, subject: AMEX_SUBJECT };