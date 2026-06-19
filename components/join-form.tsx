'use client'

import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
import { createPlayerSelfServe } from '@/app/actions/players'

export function JoinForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  async function handleSubmit(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const result = await createPlayerSelfServe(formData)
      if (result && 'error' in result) setError(result.error)
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  const fieldClass =
    'mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring'
  const labelClass = 'text-sm font-medium text-foreground'

  return (
    <form action={handleSubmit} className="space-y-4">
      <LoadingOverlay open={pending} label="Creating profile…" />
      <label className="block">
        <span className={labelClass}>Photo (optional, ≤2 MB)</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/70"
        />
      </label>
      <label className="block">
        <span className={labelClass}>Name *</span>
        <input name="name" required maxLength={60} className={fieldClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Nickname</span>
        <input name="nickname" maxLength={30} className={fieldClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Bio (≤200 chars)</span>
        <textarea name="bio" maxLength={200} rows={3} className={fieldClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Email (optional)</span>
        <input name="email" type="email" className={fieldClass} />
      </label>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e] disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create profile'}
      </button>
    </form>
  )
}
