import { cookies } from 'next/headers'
import { SiteHeader } from '@/components/site-header'
import { verifySessionCookie, ADMIN_COOKIE } from '@/lib/auth'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const isLoggedIn = verifySessionCookie(cookie, process.env.SESSION_SECRET ?? '')

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      {children}
    </>
  )
}
