'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, makeSessionCookie } from '@/lib/auth'

export async function login(formData: FormData) {
  const submitted = String(formData.get('password') ?? '')
  if (submitted !== process.env.ADMIN_PASSWORD) {
    redirect('/admin/login?error=1')
  }
  const cookie = makeSessionCookie(process.env.SESSION_SECRET!)
  ;(await cookies()).set(ADMIN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  redirect('/admin')
}

export async function logout() {
  ;(await cookies()).delete(ADMIN_COOKIE)
  redirect('/')
}
