'use client'

import { useState } from 'react'
import { createPlayerSelfServe } from '@/app/actions/players'

export function JoinForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    const result = await createPlayerSelfServe(formData)
    setPending(false)
    if (result && 'error' in result) setError(result.error)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Photo (optional, ≤2 MB)</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="mt-1 block w-full text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Name *</span>
        <input
          name="name"
          required
          maxLength={60}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Nickname</span>
        <input
          name="nickname"
          maxLength={30}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Bio (≤200 chars)</span>
        <textarea
          name="bio"
          maxLength={200}
          rows={3}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email (optional)</span>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create profile'}
      </button>
    </form>
  )
}
