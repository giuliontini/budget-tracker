// src/app/api/transactions/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { lookupCategory } from '@/lib/classifier'

let responseStatus = 201

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('api-key')
  if (apiKey !== process.env.INGESTION_API_KEY) {
    responseStatus=401
    return NextResponse.json({ error: 'Unauthorized', responseStatus }, { status: 401 })
  }
  

  const { date, description, amount } = await req.json()
  if (!date || !description || amount == null) {
    responseStatus=400
    return NextResponse.json({ error: 'Missing fields', responseStatus }, { status: 400 })
  }

  const category = await lookupCategory(description)
  const status = category ? 'confirmed' : 'pending'

  const tx = await prisma.transaction.create({
    data: {
      date: new Date(date),
      description,
      amount: Number(amount),
      category,
      status,
    },
  })

  return NextResponse.json(
    { description: tx.description, category, status, responseStatus },
    { status: 201 }
  )
}
