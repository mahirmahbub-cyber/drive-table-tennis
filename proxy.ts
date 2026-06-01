import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionCookie, ADMIN_COOKIE } from '@/lib/auth'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value
  if (verifySessionCookie(cookie, process.env.SESSION_SECRET!)) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
