'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { MatchLogForm, type MatchFormInitial } from '@/components/match-log-form'
import { deleteMatch } from '@/app/actions/matches'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function MatchRowActions({
  initial,
  players,
  label,
}: {
  initial: MatchFormInitial
  players: PlayerOption[]
  label: string
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirmDelete() {
    setPending(true)
    await deleteMatch(initial.id)
    setPending(false)
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      {/* Edit */}
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        aria-label="Edit match"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit match</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <MatchLogForm
            players={players}
            initial={initial}
            onSuccess={() => {
              setEditOpen(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        aria-label="Delete match"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive hover:bg-secondary"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete match?</DialogTitle>
            <DialogDescription>
              {label} — this removes the match and rebuilds ELO from the remaining history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Delete match'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
