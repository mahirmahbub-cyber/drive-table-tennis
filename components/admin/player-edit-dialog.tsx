'use client'

import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updatePlayer } from '@/app/actions/players'

type PlayerData = {
  id: string
  name: string
  nickname: string | null
  bio: string | null
  email: string | null
}

export function PlayerEditDialog({ player }: { player: PlayerData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = await updatePlayer(player.id, formData)
      if (r && 'error' in r) {
        setError(r.error ?? 'Unknown error')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  const field =
    'mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const labelText = 'font-display uppercase tracking-widest text-xs text-muted-foreground'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-primary hover:underline"
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit {player.name}</DialogTitle>
          </DialogHeader>
          <form action={handle} className="space-y-4">
            <LoadingOverlay open={pending} label="Saving profile…" />
            <label className="block">
              <span className={labelText}>Name</span>
              <input name="name" required defaultValue={player.name} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Nickname</span>
              <input name="nickname" defaultValue={player.nickname ?? ''} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Bio</span>
              <textarea name="bio" defaultValue={player.bio ?? ''} rows={3} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Email</span>
              <input name="email" type="email" defaultValue={player.email ?? ''} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Photo (replace)</span>
              <input name="photo" type="file" accept="image/*" className="mt-1.5 block w-full text-sm text-muted-foreground" />
            </label>
            {error && <div className="text-sm text-loss">{error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
