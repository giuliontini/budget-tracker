// src/app/api/budget-items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from "@/lib/auth";
import prisma from '@/lib/prisma'

// GET all budget items
export async function GET(req: NextRequest): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const items = await prisma.budgetItem.findMany({
    include: {
      category: { select: { id: true, macro: true, micro: true } },
    },
    orderBy: [
      { category: { macro: 'asc' } },
      { category: { micro: 'asc' } },
      { name: 'asc' },
    ],
  })
  return NextResponse.json(items)
}

// POST to add or update a budget item
export async function POST(req: NextRequest): Promise<Response> {

  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { name, amount, macro, micro } = await req.json()
  if (!name || amount == null || !macro || !micro) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  let cat = await prisma.category.findUnique({ where: { micro } })
  if (!cat) {
    cat = await prisma.category.create({ data: { macro, micro } })
  }

  const existing = await prisma.budgetItem.findFirst({
    where: { name, categoryId: cat.id },
  })
  const item = existing
    ? await prisma.budgetItem.update({
        where: { id: existing.id },
        data: { amount },
        include: { category: true },
      })
    : await prisma.budgetItem.create({
        data: { name, amount, categoryId: cat.id },
        include: { category: true },
      })

  return NextResponse.json(item, {
    status: existing ? 200 : 201,
  })
}
