// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from "@/lib/auth";
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const result = month
    ? await prisma.settings.findFirst({ where: { month } })
    : await prisma.settings.findMany({ orderBy: { month: 'desc' } })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // parse & validate
  const body = await req.json()
  const hourlyRate = parseFloat(body.hourlyRate)
  const hoursPP1   = parseInt(body.hoursPP1, 10)
  const hoursPP2   = parseInt(body.hoursPP2, 10)
  const month      = body.month

  if (
    isNaN(hourlyRate) ||
    isNaN(hoursPP1)   ||
    isNaN(hoursPP2)   ||
    !month
  ) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const existing = await prisma.settings.findFirst({ where: { month } })
  const settings = existing
    ? await prisma.settings.update({
        where: { id: existing.id },
        data: { hourlyRate, hoursPP1, hoursPP2 },
      })
    : await prisma.settings.create({
        data: { hourlyRate, hoursPP1, hoursPP2, month },
      })

  return NextResponse.json(settings)
}
