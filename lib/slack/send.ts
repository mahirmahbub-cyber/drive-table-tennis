import type { DigestVariables } from '@/lib/slack/digest'

/** POST a flat variable payload to a Slack Workflow Builder webhook trigger. */
export async function postToSlackTrigger(url: string, variables: DigestVariables): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variables),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack trigger failed: ${res.status} ${body}`)
  }
}
