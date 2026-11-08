/* بريدُ الإشعار يُعاد إن رُدّ، ولا يخرج مرّتين (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `NotificationService.attemptSend`
   و`dispatchQueuedNotifications`.

   ① **ويُعاد ما رُدّ** — كان رفضُ المزوّد مرّةً (حدُّ Resend في الثانية، وإلغاءُ شعبةٍ يراسل متعلّميها تباعا) يُعلّم
      البريدَ «فشل»، والعاملُ لا يختار إلّا المنتظر: فلا يصل أبدا. فصار يبقى في الطابور ويعيده العاملُ بعد مهلته.
   ② **وما كُتب وقناتُه مغلقة يخرج حين تُوصَل** — كان يُعلَّم «فشل» ساعةَ كُتب بلا محاولة.
   ③ **ولا يخرج مرّتين** — الإرسالُ الفوريُّ ودورةُ العامل معا كانا يرسلان الصفَّ الواحد. */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

/* المُرسِلُ يُحقَن: بوّابةُ البريد تردّ كلَّ إرسالٍ في الاختبار، فلا يُبلغ فرعُ النجاح بلا هذا */
const mail = vi.hoisted(() => ({
  live: true,
  calls: [] as string[],
  answer: async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true }),
}))
vi.mock('../../services/integrations.service', async (orig) => {
  const m = await orig<typeof import('../../services/integrations.service')>()
  return {
    ...m,
    getEmailConfig: async () => ({ enabled: mail.live, apiKey: mail.live ? 're_test' : undefined, fromEmail: 'no-reply@test.local', fromName: 'وجيز' }),
  }
})
vi.mock('../../services/mail', async (orig) => {
  const m = await orig<typeof import('../../services/mail')>()
  return { ...m, sendEmail: async (_c: unknown, input: { to: string }) => { mail.calls.push(input.to); return mail.answer() } }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { NotificationService, NOTIFICATION_RETRY_AFTER_MS } from '../../services/notification.service'
import { dispatchQueuedNotifications } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let notifications: NotificationService
let seq = 0

const learner = async () => {
  seq += 1
  return (await auth.register(`mail-retry-${seq}@test.local`, 'Learn#12345', `متعلم ${seq}`)).userId
}
const cancelled = (userId: string) => notifications.notify({
  userId, channel: 'in_app', templateKey: 'cohort.cancelled', title: 'ألغيت شعبتك', body: 'راسل الدعم',
})
const emailRow = (userId: string) => prisma.notification.findFirstOrThrow({ where: { userId, channel: 'email' } })
/** تمضي المهلة — بلا انتظارها */
const later = () => new Date(Date.now() + NOTIFICATION_RETRY_AFTER_MS + 1_000)
const dispatch = (now = later()) => dispatchQueuedNotifications(prisma, now, { gapMs: 0 })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  notifications = new NotificationService(prisma)
}, 240_000)
afterEach(() => {
  mail.live = true
  mail.calls = []
  mail.answer = async () => ({ ok: true })
})

describe('① ويعاد ما رد', () => {
  it('⚠️ رده المزود مرة: يبقى في الطابور، والعامل يرسله بعد مهلته', async () => {
    const userId = await learner()
    mail.answer = async () => ({ ok: false, error: 'تجاوز حد الإرسال لدى Resend — أعد المحاولة لاحقا' })
    await cancelled(userId)
    const first = await emailRow(userId)
    expect(first.status, 'علم «فشل» من أول رد').toBe('queued')
    expect(first.attempts).toBe(1)

    mail.answer = async () => ({ ok: true })
    await dispatchQueuedNotifications(prisma, new Date(), { gapMs: 0 })
    expect((await emailRow(userId)).attempts, 'أعيد قبل مهلته').toBe(1)

    await prisma.notification.update({ where: { id: first.id }, data: { claimedAt: new Date(Date.now() - NOTIFICATION_RETRY_AFTER_MS - 1_000) } })
    await dispatch()
    const after = await emailRow(userId)
    expect(after.status, 'لم يعده العامل').toBe('sent')
    expect(after.attempts).toBe(2)
  })

  it('ورد ثلاثا: يفشل عند الحد ولا يعاد بعده', async () => {
    const userId = await learner()
    mail.answer = async () => ({ ok: false, error: 'سقط' })
    await cancelled(userId)
    const id = (await emailRow(userId)).id
    for (let i = 0; i < 4; i++) {
      await prisma.notification.update({ where: { id }, data: { claimedAt: new Date(Date.now() - NOTIFICATION_RETRY_AFTER_MS - 1_000) } })
      await dispatch()
    }
    const row = await emailRow(userId)
    expect(row.status).toBe('failed')
    expect(row.attempts).toBe(3)
    expect(mail.calls.length).toBe(3)
  })
})

describe('② وما كتب وقناته مغلقة يخرج حين توصل', () => {
  it('⚠️ يبقى منتظرا بلا عداد، ثم يخرج مع أول دورة بعد الوصل', async () => {
    const userId = await learner()
    mail.live = false
    await cancelled(userId)
    const waiting = await emailRow(userId)
    expect(waiting.status, 'علم «فشل» ولم يحاول أحد').toBe('queued')
    expect(waiting.attempts).toBe(0)

    mail.live = true
    await dispatchQueuedNotifications(prisma, new Date(), { gapMs: 0 })
    expect((await emailRow(userId)).status).toBe('sent')
  })
})

describe('③ ولا يخرج مرتين', () => {
  it('⚠️ محاولتان معا للصف نفسه: رسالة واحدة', async () => {
    const userId = await learner()
    mail.live = false
    await cancelled(userId)
    const id = (await emailRow(userId)).id
    mail.live = true
    mail.answer = async () => { await new Promise((r) => setTimeout(r, 50)); return { ok: true } }
    await Promise.all([notifications.attemptSend(id), notifications.attemptSend(id)])
    expect(mail.calls, 'أرسل الصف مرتين').toHaveLength(1)
    const row = await emailRow(userId)
    expect(row.status).toBe('sent')
    expect(row.attempts).toBe(1)
  })
})
