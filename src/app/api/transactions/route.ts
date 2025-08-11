// src/app/api/transactions/route.ts
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

  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next({ request: req })
  if (await requireAuth(req, res)) return requireAuth(req, res)

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
