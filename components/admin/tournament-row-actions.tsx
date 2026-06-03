'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { renameTournament, deleteTournament } from '@/app/actions/tournaments'

export function TournamentManageActions({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [renaming, setRenaming] = useState(false)

  async function onRename(formData: FormData) {
    setPending(true)
    await renameTournament(id, formData)
    setPending(false)
    setRenaming(false)
    router.refresh()
  }

  async function confirmDelete() {
    setPending(true)
    await deleteTournament(id)
    setPending(false)
    router.push('/admin/tournaments')
  }

  return (
    <div className="flex items-center gap-2">
      {renaming ? (
        <form action={onRename} className="flex items-center gap-2">
          <input
            name="name"
            defaultValue={name}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="text-sm text-muted-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Rename
        </button>
      )}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete tournament?</DialogTitle>
            <DialogDescription>
              {name} — this removes the tournament and all its matches, then rebuilds ELO from the
              remaining history. This cannot be undone.
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
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Delete tournament'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
