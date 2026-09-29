/* مواعيدُ لقاءات الشعبة في القائمة العامّة — ما يُعلَن للمشتري (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «these dates appears in the information of the training
   for the user when they buy it». وكانت القائمةُ تحمل أوّلَ لقاءٍ وحدَه.

   والحارسُ هنا على **ما يُعلَن**: المعتمَدُ غيرُ الملغى وحدَه — لا ما ينتظر
   الإدارة (لا يراه المسجَّلُ نفسُه)، ولا المردود، ولا الملغى، ولا المبدئيُّ
   (مثالٌ يُرفع حين يضع المدرّبُ جدولَه). ولا يخرج معه رابطُ اجتماع: القائمةُ
   عامّةٌ بلا دخول. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let publicCatalog: PublicCatalogService
let cohortId = ''

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY)

async function session(title: string, days: number, over: Record<string, unknown> = {}) {
  return prisma.cohortSession.create({
    data: { cohortId, title, startsAt: at(days), endsAt: new Date(at(days).getTime() + 2 * 3_600_000), ...over },
  })
}

async function listed() {
  const row = (await publicCatalog.cohorts()).find((c) => c.id === cohortId)
  expect(row, 'الشعبةُ لا تظهر في القائمة العامّة').toBeTruthy()
  return row!
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  publicCatalog = new PublicCatalogService(prisma)
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبةُ مواعيد اللقاءات ${Date.now()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20, startsAt: at(20),
    },
  })).id

  /* بترتيبٍ مخلوطٍ عمدا: القائمةُ ترتّبها لا ترثُ ترتيبَ الإنشاء */
  await session('اللقاءُ الثاني', 30)
  await session('اللقاءُ الأوّل', 23)
  const withMeeting = await session('اللقاءُ الثالث', 37)
  await prisma.zoomMeeting.create({
    data: { sessionId: withMeeting.id, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/SECRET-JOIN', meetingId: '999', createdBy: null },
  })
  await session('ينتظرُ الإدارة', 25, { approvalState: 'pending' })
  await session('مردود', 26, { approvalState: 'rejected', status: 'cancelled' })
  await session('أُلغي بعد اعتماده', 27, { status: 'cancelled' })
  await session('الجلسةُ 1 (مثال)', 24, { placeholder: true })
}, 180_000)

describe('ما يُعلَن من لقاءات الشعبة', () => {
  it('⚠️ المعتمَدةُ كلُّها بمواعيدها — مرتّبةً، لا أوّلُها وحدَه', async () => {
    const row = await listed()
    expect(row.sessions.map((s) => s.title)).toEqual(['اللقاءُ الأوّل', 'اللقاءُ الثاني', 'اللقاءُ الثالث'])
    expect(row.sessions[0].startsAt).toBeInstanceOf(Date)
    expect(row.sessions[0].endsAt).toBeInstanceOf(Date)
  })

  it('⚠️ ولا ينتظر الإدارةَ ولا مردودٌ ولا ملغًى ولا مثالٌ مبدئيّ', async () => {
    const titles = (await listed()).sessions.map((s) => s.title)
    for (const hidden of ['ينتظرُ الإدارة', 'مردود', 'أُلغي بعد اعتماده', 'الجلسةُ 1 (مثال)']) {
      expect(titles, `«${hidden}» أُعلن للمشتري`).not.toContain(hidden)
    }
  })

  it('⚠️ ولا يخرج معها رابطُ اجتماعٍ ولا معرّف — موعدٌ وعنوانٌ فحسب', async () => {
    const row = await listed()
    expect(Object.keys(row.sessions[2]).sort()).toEqual(['endsAt', 'startsAt', 'title'])
    expect(JSON.stringify(row)).not.toContain('SECRET-JOIN')
  })

  it('و«التالي» أوّلُ ما لم يبدأ — لا أوّلُ ما جُدول', async () => {
    const past = await session('لقاءٌ مضى', -3)
    try {
      const row = await listed()
      expect(row.sessions[0].title, 'مواعيدُ الشعبة كلُّها في القائمة — ماضيها ومقبلُها').toBe('لقاءٌ مضى')
      expect(row.nextSession?.title).toBe('اللقاءُ الأوّل')
    } finally {
      await prisma.cohortSession.delete({ where: { id: past.id } })
    }
  })
})
