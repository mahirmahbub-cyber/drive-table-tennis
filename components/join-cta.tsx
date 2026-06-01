import Link from 'next/link'

export function JoinCta() {
  return (
    <section className="rounded-xl border border-border bg-gradient-to-br from-secondary to-card p-5">
      <p className="font-display uppercase tracking-[0.2em] text-[10px] text-primary mb-1">
        New here?
      </p>
      <h2 className="font-display text-lg font-bold tracking-tight leading-tight">
        Want in on the fun?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        Create your profile and start climbing the Drive ladder.
      </p>
      <Link
        href="/join"
        className="mt-3 inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
      >
        Create a profile
      </Link>
    </section>
  )
}
