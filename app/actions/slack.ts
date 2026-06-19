'use server'

import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySessionCookie } from '@/lib/auth'
import { loadDigestData } from '@/lib/slack/data'
import { buildWeeklyDigest, buildDailyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { lastWeekRange, yesterdayRange } from '@/lib/slack/windows'

type Result = { ok: true } | { skipped: true } | { error: string }

async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return verifySessionCookie(store.get(ADMIN_COOKIE)?.value, process.env.SESSION_SECRET!)
}

export async function postWeeklyNow(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Not authorized.' }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildWeeklyDigest({ engineMatches, playersById, range: lastWeekRange(new Date()) })
    if (!vars) return { skipped: true }
    await postToSlackTrigger(process.env.SLACK_WEBHOOK_URL!, vars)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to post.' }
  }
}

export async function postDailyNow(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Not authorized.' }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildDailyDigest({ engineMatches, playersById, range: yesterdayRange(new Date()) })
    if (!vars) return { skipped: true }
    await postToSlackTrigger(process.env.SLACK_DAILY_WEBHOOK_URL!, vars)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to post.' }
  }
}
