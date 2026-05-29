'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { playerCreateSchema } from '@/lib/validators'
import { uploadPlayerPhoto } from '@/lib/upload'

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function createPlayerSelfServe(formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  let photoUrl: string | null = null
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    photoUrl = result.url
  }

  const [created] = await db
    .insert(players)
    .values({
      name: parsed.data.name,
      nickname: emptyToNull(formData.get('nickname')),
      bio: emptyToNull(formData.get('bio')),
      email: emptyToNull(formData.get('email')),
      photoUrl,
      createdVia: 'self_serve',
    })
    .returning({ id: players.id })

  revalidatePath('/players')
  revalidatePath('/')
  redirect(`/players/${created.id}`)
}

export async function createPlayerAdmin(formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let photoUrl: string | null = null
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    photoUrl = result.url
  }

  await db.insert(players).values({
    name: parsed.data.name,
    nickname: emptyToNull(formData.get('nickname')),
    bio: emptyToNull(formData.get('bio')),
    email: emptyToNull(formData.get('email')),
    photoUrl,
    createdVia: 'admin',
  })

  revalidatePath('/players')
  revalidatePath('/admin/players')
  return { ok: true }
}

export async function updatePlayer(id: string, formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const updates: Record<string, string | null> = {
    name: parsed.data.name,
    nickname: emptyToNull(formData.get('nickname')),
    bio: emptyToNull(formData.get('bio')),
    email: emptyToNull(formData.get('email')),
  }
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    updates.photoUrl = result.url
  }

  await db.update(players).set(updates).where(eq(players.id, id))
  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  revalidatePath('/admin/players')
  return { ok: true }
}

export async function setPlayerActive(id: string, active: boolean) {
  await db.update(players).set({ active }).where(eq(players.id, id))
  revalidatePath('/players')
  revalidatePath('/admin/players')
}
