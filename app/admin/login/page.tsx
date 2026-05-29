import { login } from '@/app/actions/auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin login</h1>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        <button
          type="submit"
          className="w-full rounded bg-black px-3 py-2 text-white"
        >
          Sign in
        </button>
        {error ? (
          <p className="text-sm text-red-600">Wrong password</p>
        ) : null}
      </form>
    </main>
  )
}
