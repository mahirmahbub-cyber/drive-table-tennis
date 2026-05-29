import { JoinForm } from '@/components/join-form'

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Create your profile</h1>
      <p className="mb-6 text-sm text-zinc-500">
        You&apos;ll show up on the roster and start at 1200 ELO.
      </p>
      <JoinForm />
    </main>
  )
}
