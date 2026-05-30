import { JoinForm } from '@/components/join-form'

export default function JoinPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 md:px-6">
      <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
        Enter the Grid
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight leading-none mb-2">
        Create your profile
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        You&apos;ll show up on the roster and start at 1200 ELO — pit lane awaits.
      </p>
      <div className="rounded-xl border border-border bg-card p-5">
        <JoinForm />
      </div>
    </main>
  )
}
