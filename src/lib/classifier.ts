// src/lib/classifier.ts
import prisma from '@/lib/prisma'

/**
 * Try to find a matching merchantPattern (normalized to UPPERCASE).
 * Returns the category string, or null if none.
 */
export async function lookupCategory(merchant: string): Promise<string | null> {
  const key = merchant.trim().toUpperCase()
  const record = await prisma.merchantCategory.findUnique({
    where: { merchantPattern: key }
  })
  return record?.category ?? null
}
