import { rebuildElo } from '@/app/actions/matches'

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin dashboard</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Use the navigation above to manage players, log matches, and run tournaments.
      </p>
      <form action={rebuildElo}>
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Rebuild ELO from match history
        </button>
      </form>
      <p className="mt-2 text-sm text-zinc-500">
        Replays the entire match history and rewrites all per-match ELO snapshots
        and each player&apos;s current ELO. Safe to run anytime.
      </p>
    </main>
  )
}
