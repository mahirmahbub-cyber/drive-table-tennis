import { put } from '@vercel/blob'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export async function uploadPlayerPhoto(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Photo must be an image' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Photo must be ≤ 2 MB' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const key = `players/${crypto.randomUUID()}.${ext}`
  const blob = await put(key, file, {
    access: 'public',
    contentType: file.type,
  })
  return { url: blob.url }
}
