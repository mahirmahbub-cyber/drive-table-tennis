import { loadDigestData } from '@/lib/slack/data'
import { buildDailyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { yesterdayRange } from '@/lib/slack/windows'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildDailyDigest({ engineMatches, playersById, range: yesterdayRange(new Date()) })
    if (!vars) return Response.json({ skipped: true })
    await postToSlackTrigger(process.env.SLACK_DAILY_WEBHOOK_URL!, vars)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('daily-digest failed', e)
    return new Response('Internal Error', { status: 500 })
  }
}
