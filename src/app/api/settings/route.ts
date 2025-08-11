// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import prisma from '@/lib/prisma'

async function requireAuth(req: NextRequest, res: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const res = NextResponse.next({ request: req })
  if (await requireAuth(req, res)) return requireAuth(req, res)

  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const result = month
    ? await prisma.settings.findFirst({ where: { month } })
    : await prisma.settings.findMany({ orderBy: { month: 'desc' } })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next({ request: req })
  if (await requireAuth(req, res)) return requireAuth(req, res)

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
