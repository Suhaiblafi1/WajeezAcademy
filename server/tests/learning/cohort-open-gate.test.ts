/* بوّابةُ فتح الشعبة — شرطٌ لم يكن يُوفَّى، وزرٌّ كان يتخطّاها كلَّها.

   ── ① خطّةُ التقديم: شرطٌ بلا باب ──

   من شروط الفتح الستّة «خطّةُ تقديمٍ للشعبة». وصفوفُ `CohortDeliveryPlan`
   كانت تُكتب في **موضعٍ واحدٍ في المستودَع كلِّه**: نشرُ اقتراحِ تعديلٍ من
   مدرّبٍ بنطاق شعبة. فكلُّ شعبةٍ تُنشأ يدويّا عالقةٌ في المسوّدة أبدا — لا
   لعطبٍ في المنطق بل لأنّ الشرطَ لا سبيلَ إلى إيفائه.

   ── ② الزرُّ الجماعيُّ: بابٌ خلفيّ ──

   `openAllCohorts` كان يُنشئ الصفَّ بـ`status: 'open'` و`registrationOpen`
   مباشرةً، فيتخطّى الشروطَ الستّة كلَّها. فزرٌّ واحدٌ يفتح للبيع **شعبا بلا
   مدرّبٍ ولا جدولٍ ولا خطّة** — ويدفع متعلّمٌ ثمنَ مقعدٍ لا أحدَ يدرّس فيه.
   ولا يفشل شيءٌ ولا يشتكي أحدٌ حتّى يأتي أوّلُ موعد.

   والحارسُ هنا على الأثر لا على السطر: يُشغَّل الزرُّ فعلا، ثمّ يُسأل عمّا
   في القاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { openAllCohorts } from '../../services/catalog-readiness.service'

let prisma: PrismaClient
let cohorts: CohortService
let actorId = ''
let courseId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('cohort-gate@test.local', 'Admin#12345', 'مدير')
  actorId = admin.userId
  await auth.setRoles(actorId, ['academic_manager'])
  courseId = (await prisma.course.findFirstOrThrow({ orderBy: { id: 'asc' } })).id
}, 180_000)

describe('خطّةُ التقديم — الشرطُ صار له باب', () => {
  it('شعبةٌ بلا خطّةٍ تُعلن نقصَها، وكتابةُ الخطّة تُسقط النقص', async () => {
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةُ فحصِ الخطّة', status: 'draft', capacity: 10, price: 100, currency: 'USD', financialReady: true },
    })
    const before = await cohorts.openChecklist(c.id)
    expect(before.missing.some((m) => m.startsWith('لا خطة تقديم')), 'الشرطُ لا يظهر أصلا').toBe(true)

    await cohorts.setDeliveryPlan(c.id, actorId, {
      notesAr: 'تقديمٌ عن بُعد عبر Zoom، الثلاثاء والخميس السادسة مساءً بتوقيت عمّان، ثماني جلسات.',
    })
    const after = await cohorts.openChecklist(c.id)
    expect(after.missing.some((m) => m.startsWith('لا خطة تقديم')), 'كُتبت الخطّةُ وبقي الشرطُ ناقصا').toBe(false)
  })

  it('ولا تُقبل خطّةٌ أقصرُ من أن تُقرأ — الشرطُ يُوفَّى لا يُختَم', async () => {
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةُ الخطّة القصيرة', status: 'draft', capacity: 10 },
    })
    await expect(cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'عن بعد' }))
      .rejects.toMatchObject({ code: 'plan_too_short' })
  })

  it('والكتابةُ مرّتين تُحدِّث ولا تُكرِّر — خطّةٌ واحدةٌ أساسيّة', async () => {
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةُ التحديث', status: 'draft', capacity: 10 },
    })
    await cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'النصُّ الأوّل، وهو أطولُ من عشرين حرفا بيقين.' })
    await cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'النصُّ الثاني، وهو كذلك أطولُ من عشرين حرفا.' })
    const plans = await cohorts.deliveryPlans(c.id)
    expect(plans).toHaveLength(1)
    expect((plans[0].content as { notesAr: string }).notesAr).toContain('الثاني')
  })
})

describe('الزرُّ الجماعيّ يمرّ بالبوّابة نفسِها', () => {
  it('لا يفتح شعبةً ناقصةَ الشروط — ويقول ما نقصها', async () => {
    const res = await openAllCohorts(prisma, { apply: true, actorId })
    expect(res.applied).toBe(true)

    /* كلُّ ما أنشأه هذا النداء: لا شعبةَ مفتوحةً بلا مدرّبٍ مؤهَّل */
    const opened = await prisma.cohort.findMany({
      where: { status: 'open' },
      include: { trainers: true },
    })
    for (const c of opened) {
      expect(c.trainers.length, `شعبةٌ مفتوحةٌ بلا مدرّب: ${c.title}`).toBeGreaterThan(0)
    }

    /* وما لم يُفتح يُقال سببُه لا يُخفى */
    expect(res.prepared, 'لم تُهيَّأ شعبةٌ واحدة — الفحصُ لا يقيس شيئا').toBeGreaterThan(0)
    const blocked = res.rows.filter((r) => r.blocked?.length)
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked[0].blocked!.join(' '), 'لم يُذكر نقصُ المدرّب').toContain('مدرب')
  })

  it('والمهيّأةُ تحمل جلساتِها وخطّتَها — فلا يبقى ناقصا إلّا ما لا يُختلق', async () => {
    const c = await prisma.cohort.findFirstOrThrow({
      where: { status: 'draft', title: { contains: 'الدفعة الأولى' } },
      include: { sessions: true, plans: true },
    })
    expect(c.sessions.length, 'هُيّئت بلا جلسات — والنمطُ معلَنٌ في صفّها').toBeGreaterThan(0)
    expect(c.plans.length, 'هُيّئت بلا خطّةِ تقديم').toBeGreaterThan(0)
    expect(c.registrationOpen, 'مسوّدةٌ والتسجيلُ مفتوح').toBe(false)
  })
})
