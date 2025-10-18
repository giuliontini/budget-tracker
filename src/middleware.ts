// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1) allow these paths through
  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/api/transactions/ingest') ||
    pathname.startsWith('/api/gmail-push') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // 2) build a Supabase SSR client that reads from req.cookies and writes to our new response
  const res = NextResponse.next({ request: req })
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

  // 3) refresh (and/or read) the session
  const { data: { session } } = await supabase.auth.getSession()

  // 4) if there is no session, redirect to /sign-in
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // 5) otherwise, allow the request (with any refreshed cookies)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
