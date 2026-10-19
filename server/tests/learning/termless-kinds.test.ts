/* شعبٌ بلا فصل على قاعدةٍ حقيقيّة: ما يتحدّد وحدَه وما يحتاجك (١٩ أكتوبر ٢٠٢٦).

   «لماذا يجب أن أعيد التوزيع والمدرّبُ هو من حدّد وأنا اعتمدت.. هذا فعلٌ مكرّر» (صاحب المنصّة).
   ① لها مدرّبٌ وخطّتُه لم تُعتمَد: `auto` — وتاريخُ البدء الذي اختاره في خطّته يُقرأ.
   ② لا مدرّبَ لها، أو اعتُمدت ولم يُعرف موسمُها: `needs` بسببه.
   ③ والمعتمدةُ بلا بدءٍ مكتوب يسمّي العاملُ فصلَها من أوّل لقاءٍ قائم — لا من ملغى — فتخرج من الطابور. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { assignMissingTerms } from '../../services/term-ensure'

const STAMP = Date.now()
let prisma: PrismaClient
let cohorts: CohortService
let courseId = ''
let profileId = ''
const ids: Record<string, string> = {}

async function cohort(key: string, opts: { trainer?: boolean; plan?: string; content?: object; sessions?: { at: string; status?: string }[] } = {}) {
  const c = await prisma.cohort.create({ data: { courseId, title: `${key} ${STAMP}`, status: 'draft' } })
  if (opts.trainer !== false) await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  if (opts.plan) {
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: profileId, status: opts.plan, content: { kind: 'trainer', modules: [], ...(opts.content ?? {}) } as never },
    })
  }
  for (const s of opts.sessions ?? []) {
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'لقاء', startsAt: new Date(s.at), status: s.status ?? 'scheduled' } })
  }
  ids[key] = c.id
}
const row = async (k: string) => (await cohorts.cohortsWithoutTerm()).find((r) => r.id === ids[k])

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-TL-${STAMP}`, fullName: 'مدرب الفصول', email: `tl-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, isVerified: true } })).id
  await prisma.term.deleteMany({ where: { year: { in: [2096, 2097] } } })

  await cohort('خطة عند مدربها', { plan: 'draft', content: { startsOn: '2096-12-05', endsOn: '2097-01-20' } })
  await cohort('خطة تنتظرك', { plan: 'submitted' })
  await cohort('بلا خطة')
  await cohort('بلا مدرب', { trainer: false })
  await cohort('معتمدة بلا تاريخ', { plan: 'approved' })
  await cohort('معتمدة بلقاءات', { plan: 'approved', sessions: [{ at: '2096-08-01T16:00:00Z', status: 'cancelled' }, { at: '2096-12-10T16:00:00Z' }] })
}, 240_000)

describe('① يتحدد وحده', () => {
  it('⚠️ لها مدرب وخطته لم تعتمد — auto، وتاريخ بدئه من خطته', async () => {
    const a = await row('خطة عند مدربها')
    expect(a?.kind).toBe('auto')
    expect(a?.plan).toBe('draft')
    expect(a?.startsOn, 'تاريخ المدرب في خطته لا يقرأ').toBe('2096-12-05')
    expect((await row('خطة تنتظرك'))?.kind).toBe('auto')
    expect((await row('بلا خطة'))?.kind).toBe('auto')
  })
})

describe('② يحتاجك — بسببه', () => {
  it('⚠️ لا مدرب لها، أو اعتمدت ولم يعرف موسمها', async () => {
    expect(await row('بلا مدرب')).toMatchObject({ kind: 'needs', whyAr: 'لا مدرب لها' })
    expect((await row('معتمدة بلا تاريخ'))?.kind).toBe('needs')
  })
})

describe('③ العامل يسمي المعتمدة من أول لقاء قائم', () => {
  it('⚠️ لا من الملغى — وتخرج من الطابور', async () => {
    expect((await row('معتمدة بلقاءات'))?.kind).toBe('needs')
    await assignMissingTerms(prisma)
    const t = (await prisma.cohort.findUniqueOrThrow({ where: { id: ids['معتمدة بلقاءات']! }, select: { term: { select: { year: true, season: true } } } })).term
    expect(t, 'سمي من اللقاء الملغى أو لم يسم').toEqual({ year: 2096, season: 'nov_jan' })
    expect(await row('معتمدة بلقاءات')).toBeUndefined()
    expect((await row('معتمدة بلا تاريخ'))?.kind, 'لا تاريخ لها فلا يخمن').toBe('needs')
    expect((await row('خطة عند مدربها'))?.kind, 'سمي فصل ما لم يعتمد').toBe('auto')
  })
})
