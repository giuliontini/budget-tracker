// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from "@/lib/auth";
import prisma from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { category, addToLookup } = await req.json()
  if (!category) {
    return NextResponse.json(
      { error: 'Category is required' },
      { status: 400 }
    )
  }

  const updatedTx = await prisma.transaction.update({
    where: { id: params.id },
    data: { category, status: 'confirmed' },
  })

  if (addToLookup) {
    const merchantPattern = updatedTx.description.trim().toUpperCase()
    await prisma.merchantCategory.upsert({
      where: { merchantPattern },
      create: { merchantPattern, category },
      update: { category },
    })
  }

  return NextResponse.json(updatedTx)
}
