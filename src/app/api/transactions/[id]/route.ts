// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from "@/lib/auth";
import prisma from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }   // 👈 Promise
): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const { category, addToLookup } = await req.json()
  if (!category) {
    return NextResponse.json(
      { error: 'Category is required' },
      { status: 400 }
    )
  }

  const updatedTx = await prisma.transaction.update({
    where: { id },
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params; 
  if (!id) return new Response("Missing id", { status: 400 });

  await prisma.transaction.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
