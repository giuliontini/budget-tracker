// src/app/api/transactions/[id]/route.ts
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next({ request: req })
  if (await requireAuth(req, res)) return requireAuth(req, res)

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
