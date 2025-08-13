// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from "@/lib/auth";
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { date, description, amount } = await req.json()
  if (!date || !description || amount == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      date: new Date(date),
      description,
      amount: Number(amount),
    },
  })
  return NextResponse.json(transaction, { status: 201 })
}
