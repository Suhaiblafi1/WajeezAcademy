/* مساراتُ المنحة (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-pathway.service.ts`.

   ① **لا دورةَ في مسارٍ بلا شعبةٍ تُشترى اليوم** — مغلقةُ التسجيل، وبلا سعر، وممتلئة، وبلا خطّةٍ معتمدة: تُردّ.
   ② **ولا يتجاوز حدَّ دورات المنحة** — ولا مسارَ بلا اسمٍ أو بلا دورات.
   ③ **وهامشُ المسار كلِّه** — أقربُ شعبةٍ لكلّ دورة، وما يدفعه بلا منحةٍ وبها، وأجورُ المدرّبين، والفرق.
   ④ **وما أُغلقت شعبتُه بعد الحفظ يُقال** — ولا يدخل السعر.
   ⑤ **والحذفُ والحفظُ يُكتبان في الأثر.** */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantPathwayService } from '../../services/grant-pathway.service'
import { approvedPlanBy, approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let grants: GrantService
let paths: GrantPathwayService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort(courseId: string, over: Record<string, unknown> = {}, plan: 'fixture' | 'mine' | 'none' = 'mine') {
  const c = await prisma.cohort.create({
    data: {
      ...(plan === 'none' ? {} : { plans: { create: plan === 'mine' ? approvedPlanBy(profileId) : await approvedTrainerPlan(prisma) } }),
      courseId, title: `شعبة مسار المنحة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 200, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * DAY),
      ...over,
    } as never,
  })
  if (plan === 'mine') await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return c
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  grants = new GrantService(prisma)
  paths = new GrantPathwayService(prisma)
  ownerId = (await auth.register(`gp-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const user = await prisma.user.create({ data: { email: `gp-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المسار', passwordHash: 'x' } })
  const app = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-GP-${STAMP}`, fullName: 'مدرب المسار', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: app.id } })).id
  await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 50, effectiveFrom: new Date(Date.now() - DAY) } })
  /* من آخر القائمة — فلا تلتقي بدورات ملفّات الشراء التي تأخذ من أوّلها */
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id)
  await grants.update({ percentOff: 60, maxCourses: 4 }, ownerId)
}, 240_000)

describe('① لا دورة في مسار بلا شعبة تشترى اليوم', () => {
  it('⚠️ مغلقة التسجيل، وبلا سعر، وممتلئة، وبلا خطة معتمدة — ترد، والمفتوحة تقبل', async () => {
    const ok = nextCourse()
    await cohort(ok)
    for (const over of [{ registrationOpen: false }, { price: null }]) {
      const x = nextCourse()
      await cohort(x, over)
      await expect(paths.save(null, { titleAr: 'مسار مرفوض', courseIds: [ok, x] }, ownerId), JSON.stringify(over))
        .rejects.toMatchObject({ code: 'no_cohort' })
    }
    const noPlan = nextCourse()
    await cohort(noPlan, {}, 'none')
    await expect(paths.save(null, { titleAr: 'مسار مرفوض', courseIds: [ok, noPlan] }, ownerId)).rejects.toMatchObject({ code: 'no_cohort' })
    /* وممتلئةٌ بمن حُجز لهم: سعتُها مقعدٌ واحدٌ محجوز */
    const full = nextCourse()
    const f = await cohort(full, { capacity: 1 })
    const buyer = await prisma.user.create({ data: { email: `gp-b-${STAMP}@test.local`, displayName: 'مشتر', passwordHash: 'x' } })
    await prisma.enrollmentRequest.create({ data: { userId: buyer.id, cohortId: f.id, status: 'seat_held' } })
    await expect(paths.save(null, { titleAr: 'مسار مرفوض', courseIds: [ok, full] }, ownerId)).rejects.toMatchObject({ code: 'no_cohort' })

    const saved = await paths.save(null, { titleAr: 'مسار مقبول', courseIds: [ok] }, ownerId)
    expect(saved.courseIds).toEqual([ok])
  })
})

describe('② ولا يتجاوز حد دورات المنحة', () => {
  it('⚠️ خمس والحد أربع — ترد، وبلا اسم أو بلا دورات ترد', async () => {
    const ids: string[] = []
    for (let i = 0; i < 5; i++) { const x = nextCourse(); await cohort(x); ids.push(x) }
    await expect(paths.save(null, { titleAr: 'مسار طويل', courseIds: ids }, ownerId)).rejects.toMatchObject({ code: 'too_many' })
    await expect(paths.save(null, { titleAr: 'م', courseIds: ids.slice(0, 2) }, ownerId)).rejects.toMatchObject({ code: 'bad_title' })
    await expect(paths.save(null, { titleAr: 'مسار فارغ', courseIds: [] }, ownerId)).rejects.toMatchObject({ code: 'no_courses' })
    expect((await paths.save(null, { titleAr: 'مسار رباعي', courseIds: ids.slice(0, 4) }, ownerId)).courseIds).toHaveLength(4)
  })
})

describe('③ وهامش المسار كله', () => {
  it('⚠️ أقرب شعبة لكل دورة، وبلا منحة وبها، وأجور المدربين والفرق — وبنسبة تجرب', async () => {
    const [a, b, c, d] = [nextCourse(), nextCourse(), nextCourse(), nextCourse()]
    /* لـ«a» شعبتان: البعيدةُ بسعرٍ آخر — والأقربُ هي التي تُحسب */
    await cohort(a, { price: 999, startsAt: new Date(Date.now() + 90 * DAY) })
    await cohort(a, { price: 150 })
    for (const x of [b, c, d]) await cohort(x, { price: 150 })
    const p = await paths.save(null, { titleAr: 'مسار الهامش', blurbAr: 'لمن يبدأ', courseIds: [a, b, c, d] }, ownerId)

    const row = (await paths.list()).pathways.find((x) => x.id === p.id)!
    expect(row.listTotal, 'لم تحسب أقرب شعبة').toBe(600)
    expect(row.bundleTotal).toBe(432)
    expect(row.grantTotal).toBe(240)
    expect(row.seatCostTotal).toBe(200)
    expect(row.margin).toBe(40)
    expect(row.missing).toBe(0)
    const at40 = (await paths.list({ percentOff: 40 })).pathways.find((x) => x.id === p.id)!
    expect(at40.grantTotal).toBe(360)
    expect(at40.margin).toBe(160)
  })
})

describe('④ وما أغلقت شعبته بعد الحفظ يقال', () => {
  it('⚠️ لا يدخل السعر — ويعد ناقصا', async () => {
    const [a, b] = [nextCourse(), nextCourse()]
    const ca = await cohort(a, { price: 100 })
    await cohort(b, { price: 100 })
    const p = await paths.save(null, { titleAr: 'مسار ينقص', courseIds: [a, b] }, ownerId)
    await prisma.cohort.update({ where: { id: ca.id }, data: { registrationOpen: false } })
    const row = (await paths.list()).pathways.find((x) => x.id === p.id)!
    expect(row.missing).toBe(1)
    expect(row.listTotal).toBe(100)
    expect(row.courses.find((x) => x.courseId === a)!.cohort).toBeNull()
  })
})

describe('⑤ والحفظ والحذف يكتبان', () => {
  it('⚠️ الأثر لكل منهما — والموقوف لا يعد في المعروض', async () => {
    const a = nextCourse()
    await cohort(a)
    const p = await paths.save(null, { titleAr: 'مسار يحذف', courseIds: [a] }, ownerId)
    await paths.save(p.id, { titleAr: 'مسار يحذف', courseIds: [a], active: false }, ownerId)
    expect((await paths.list({ activeOnly: true })).pathways.some((x) => x.id === p.id), 'عرض مسار موقوف').toBe(false)
    await paths.remove(p.id, ownerId)
    expect(await prisma.grantPathway.count({ where: { id: p.id } })).toBe(0)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_pathway_save', meta: { path: ['pathwayId'], equals: p.id } } })).toBe(2)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_pathway_remove', meta: { path: ['pathwayId'], equals: p.id } } })).toBe(1)
  })
})
