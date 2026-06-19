'use client'

/** Full-screen blocking overlay shown while a write is in flight. Covers the viewport
 *  so a second click/submit is impossible until the action resolves. */
export function LoadingOverlay({ open, label = 'Saving…' }: { open: boolean; label?: string }) {
  if (!open) return null
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        aria-hidden
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  )
}
