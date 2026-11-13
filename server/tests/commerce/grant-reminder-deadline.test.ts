/* تذكيرُ المنحة مربوطٌ بالنهاية التي أُرسل لها (١٣ نوفمبر ٢٠٢٦).

   كان «ذُكِّر قبلُ» يُعرف بأثرٍ (`coupon.grant_reminder`) مرحلتُه هي ('3d' أو '1d') — بلا النهاية التي ذُكِّر لها.
   فلمّا مُدّت المنحةُ (١ نوفمبر ٢٠٢٦ إلى ١٢ نوفمبر) لم يصل تذكيرا النهايةِ الجديدة أحدا ممّن وصله تذكيرا القديمة.
   والآن يُكتب في الأثر `closesAt`، ولكلّ نهايةٍ تذكيراها مرّةً مرّة. والعلّةُ في `sendGrantReminders`.

   ① **مُدّت فيصل تذكيرُ النهاية الجديدة مرّةً واحدة** — ولكلّ مرحلةٍ منها.
   ② **وأثرٌ قديمٌ بلا نهاية** يُحسب للنهاية التي كُتب في نافذتها وحدَها: لا يمنع تذكيرَ نهايةٍ بعدها، ويمنع تكرارَ نهايته.

   الساعةُ ساعةُ الاختبار (`now`) لا ساعةُ الجهاز — والنهاياتُ تواريخُ ثابتةٌ بعيدة، فلا يحمرّ الحارسُ وحدَه يومَ تفوت. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { sendGrantReminders } from '../../services/grant-followup.service'

let prisma: PrismaClient
let landing: GrantLandingService
let grant: GrantService
let ownerId = ''
let seq = 0
const STAMP = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR

/* نهايةٌ أولى ثمّ تمديدٌ أسبوعا — أوّلَ اليوم بتوقيت عمّان كما تحفظها شاشتُها */
const FIRST = new Date('2031-03-01T21:00:00.000Z')
const LATER = new Date('2031-03-08T21:00:00.000Z')
const before = (closesAt: Date, hours: number) => new Date(closesAt.getTime() - hours * HOUR)

const mails = (to: string) => prisma.outboxMail.findMany({ where: { to, purpose: 'grant.reminder' }, orderBy: { createdAt: 'asc' } })

/** عضوٌ أخذ كودَه قبل النهاية الأولى بأسبوعين — قبل كلّ نافذة */
async function member() {
  seq += 1
  const email = `grd-${seq}-${STAMP}@test.local`
  const out = await landing.apply({ fullName: `عضو ${seq}`, phone: `0793${String(500000 + seq)}`, email, workField: 'الهندسة' })
  await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(FIRST.getTime() - 14 * DAY) } })
  return { ref: out.ref, email }
}

let had: { enabled: boolean; config: unknown } | null = null

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  landing = new GrantLandingService(prisma)
  grant = new GrantService(prisma)
  ownerId = (await auth.register(`grd-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  await grant.update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
  had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
  const config = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
  await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config }, create: { provider: 'email', enabled: true, config } })
}, 240_000)

afterAll(async () => {
  if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
  else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
  await grant.update({ closesAt: null }, ownerId)
})

describe('تذكير المنحة لكل نهاية', () => {
  it('⚠️ ① مدت المنحة فيصل تذكير النهاية الجديدة مرة واحدة لكل مرحلة', async () => {
    const idle = await member()
    await grant.update({ closesAt: FIRST }, ownerId)
    expect((await sendGrantReminders(prisma, before(FIRST, 62))).stage).toBe('3d')
    expect((await sendGrantReminders(prisma, before(FIRST, 14))).stage).toBe('1d')
    expect(await mails(idle.email), 'لم يصله تذكيرا النهاية الأولى').toHaveLength(2)
    const first = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.grant_reminder', entityId: idle.ref } })
    expect((first.meta as { closesAt?: string }).closesAt, 'لم تكتب النهاية في الأثر').toBe(FIRST.toISOString())

    /* مُدّت أسبوعا — وفي نافذة الأيّام الثلاثة الجديدة يصل مرّةً ولو دار العاملُ مرّتين */
    await grant.update({ closesAt: LATER }, ownerId)
    await sendGrantReminders(prisma, before(LATER, 62))
    expect(await mails(idle.email), 'لم يصله تذكير النهاية الجديدة').toHaveLength(3)
    await sendGrantReminders(prisma, before(LATER, 40))
    expect(await mails(idle.email), 'ذكر مرتين للنهاية نفسها').toHaveLength(3)

    /* وآخرُ يومٍ الجديدُ له تذكيرُه مرّةً */
    await sendGrantReminders(prisma, before(LATER, 14))
    await sendGrantReminders(prisma, before(LATER, 2))
    const m = await mails(idle.email)
    expect(m, 'آخر يوم الجديد').toHaveLength(4)
    expect(m[3].subject).toBe('اليوم آخر يوم لمنحتك')
    await grant.update({ closesAt: null }, ownerId)
  })

  it('⚠️ ② وأثر قديم بلا نهاية يحسب للنهاية التي كتب في نافذتها وحدها', async () => {
    const old = await member()
    const fresh = await member()
    /* أثران كُتبا قبل هذا الإصلاح — بلا `closesAt`: الأوّلُ في نافذة النهاية الأولى، والثاني في نافذة الجديدة */
    await prisma.auditEvent.create({
      data: { action: 'coupon.grant_reminder', entityType: 'lead', entityId: old.ref, meta: { stage: '3d', campaign: 'wajeez-members', picks: 0 }, createdAt: before(FIRST, 62) },
    })
    await prisma.auditEvent.create({
      data: { action: 'coupon.grant_reminder', entityType: 'lead', entityId: fresh.ref, meta: { stage: '3d', campaign: 'wajeez-members', picks: 0 }, createdAt: before(LATER, 62) },
    })
    await grant.update({ closesAt: LATER }, ownerId)
    await sendGrantReminders(prisma, before(LATER, 61))
    expect(await mails(old.email), 'أثر النهاية الأولى منع تذكير الجديدة').toHaveLength(1)
    expect(await mails(fresh.email), 'أثر النهاية نفسها لم يمنع التكرار').toHaveLength(0)
    await grant.update({ closesAt: null }, ownerId)
  })
})
