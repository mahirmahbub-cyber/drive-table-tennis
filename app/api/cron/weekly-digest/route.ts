import { loadDigestData } from '@/lib/slack/data'
import { buildWeeklyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { lastWeekRange } from '@/lib/slack/windows'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildWeeklyDigest({ engineMatches, playersById, range: lastWeekRange(new Date()) })
    if (!vars) return Response.json({ skipped: true })
    await postToSlackTrigger(process.env.SLACK_WEBHOOK_URL!, vars)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('weekly-digest failed', e)
    return new Response('Internal Error', { status: 500 })
  }
}
