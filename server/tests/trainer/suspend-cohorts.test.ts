/* إيقافُ المدرّب وشعبُه التي لم تبدأ — على قاعدةٍ حقيقيّة (٢٤ أكتوبر ٢٠٢٦).

   «لقد قمت بإيقاف المدرّب.. لماذا ما زالت شعبتُه ظاهرةً لدينا؟» (صاحب المنصّة)، واختار: يُسأل في نافذة الإيقاف
   عن كلّ شعبةٍ لم تبدأ — تُلغى أو تبقى لبديل. فيُحرس:
   ١) المعاينةُ تعرض شعبَه التي لم تبدأ وحدَها، بعدد مسجّليها؛
   ٢) ما اختير يُلغى ويصل متعلّميه الخبر، وما لم يُختر يبقى — وشعبةُ غيره لا تُلغى ولو أُرسل معرّفُها؛
   ٣) وما بقي يُرى في «تبدأ قريبا» بأنّ مدرّبه موقوف. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortEconomicsService } from '../../services/cohort-economics.service'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000009'
const COURSE = 'C-BIZ-101'
const DAY = 86_400_000
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

const review = () => new TrainerReviewService(prisma)
const trainer = async (name: string) => (await review().createTrainerDirectly(ACTOR, { fullName: name, email: `susp-${++seq}@test.local` })).profileId
async function cohortOf(profileId: string, title: string, status = 'open', inDays = 10) {
  const c = await prisma.cohort.create({ data: { courseId: COURSE, title, status, startsAt: new Date(Date.now() + inDays * DAY) } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  return c
}

describe('إيقاف المدرب يسأل عن شعبه التي لم تبدأ', () => {
  it('⚠️ المعاينة: شعبه التي لم تبدأ وحدها، بعدد مسجليها', async () => {
    const p = await trainer('مدرب يعاين')
    const open = await cohortOf(p, 'شعبة مفتوحة')
    await cohortOf(p, 'شعبة جارية', 'active')
    await cohortOf(p, 'شعبة ملغاة', 'cancelled')
    const u = await prisma.user.create({ data: { email: `susp-l-${++seq}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: open.id } })
    const rows = await review().suspendPreview(p)
    expect(rows.map((r) => r.title)).toEqual(['شعبة مفتوحة'])
    expect(rows[0]).toMatchObject({ enrolled: 1, otherTrainers: 0, role: 'lead' })
  })

  it('⚠️ ما اختير يلغى، وما لم يختر يبقى ويرى بأن مدربه موقوف — وشعبة غيره لا تمس', async () => {
    const p = await trainer('مدرب يوقف')
    const other = await trainer('مدرب آخر')
    const cancel = await cohortOf(p, 'تلغى مع إيقافه')
    const keep = await cohortOf(p, 'تبقى لبديل')
    const foreign = await cohortOf(other, 'شعبة غيره')
    const u = await prisma.user.create({ data: { email: `susp-l-${++seq}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: cancel.id } })

    const r = await review().suspendTrainer(p, ACTOR, 'إيقاف اختباري', { cancelCohortIds: [cancel.id, foreign.id] })
    expect(r.cancelled).toBe(1)
    const status = async (id: string) => (await prisma.cohort.findUniqueOrThrow({ where: { id } })).status
    expect(await status(cancel.id)).toBe('cancelled')
    expect(await status(keep.id)).toBe('open')
    expect(await status(foreign.id), 'ألغيت شعبة مدرب آخر').toBe('open')
    expect(await prisma.notification.count({ where: { userId: u.id, channel: 'in_app', templateKey: 'cohort.cancelled' } })).toBe(1)

    const upcoming = await new CohortEconomicsService(prisma).upcoming(30)
    expect(upcoming.find((c) => c.id === keep.id)?.trainerSuspended).toBe(true)
    expect(upcoming.find((c) => c.id === foreign.id)?.trainerSuspended).toBe(false)
  })

  it('⚠️ وبلا اختيار لا يلغى شيء', async () => {
    const p = await trainer('مدرب بلا اختيار')
    const c = await cohortOf(p, 'تبقى بلا اختيار')
    expect((await review().suspendTrainer(p, ACTOR, 'إيقاف اختباري')).cancelled).toBe(0)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('open')
  })
})
