import { login } from '@/app/actions/auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
        Pit Wall
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight leading-none mb-6">
        Admin login
      </h1>
      <form action={login} className="space-y-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </button>
        {error ? <p className="text-sm text-loss">Wrong password</p> : null}
      </form>
    </main>
  )
}
