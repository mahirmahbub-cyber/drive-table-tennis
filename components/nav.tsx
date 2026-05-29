import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export function AdminNav() {
  return (
    <nav className="flex items-center gap-6 border-b px-6 py-3 text-sm">
      <Link href="/admin" className="font-semibold">Admin</Link>
      <Link href="/admin/players">Players</Link>
      <Link href="/admin/matches/new">Log match</Link>
      <Link href="/admin/tournaments/new">New tournament</Link>
      <form action={logout} className="ml-auto">
        <button type="submit" className="text-zinc-500 hover:text-zinc-900">
          Sign out
        </button>
      </form>
    </nav>
  )
}
