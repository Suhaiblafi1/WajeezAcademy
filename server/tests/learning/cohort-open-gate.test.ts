/* بوّابةُ فتح الشعبة — شرطٌ لم يكن يُوفَّى، وزرٌّ كان يتخطّاها كلَّها.

   ── ① خطّةُ التقديم: شرطٌ بلا باب ──

   من شروط الفتح الخمسة «خطّةُ تقديمٍ للشعبة». وصفوفُ `CohortDeliveryPlan`
   كانت تُكتب في **موضعٍ واحدٍ في المستودَع كلِّه**: نشرُ اقتراحِ تعديلٍ من
   مدرّبٍ بنطاق شعبة. فكلُّ شعبةٍ تُنشأ يدويّا عالقةٌ في المسوّدة أبدا — لا
   لعطبٍ في المنطق بل لأنّ الشرطَ لا سبيلَ إلى إيفائه.

   ── ② الزرُّ الجماعيُّ: بابٌ خلفيّ ──

   `openAllCohorts` كان يُنشئ الصفَّ بـ`status: 'open'` و`registrationOpen`
   مباشرةً، فيتخطّى الشروطَ الخمسة كلَّها. فزرٌّ واحدٌ يفتح للبيع **شعبا بلا
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
  /* ── ما تغيّر، ولماذا يُحرَس عكسُ ما كان يُحرَس ──

     كان هذا الوصفُ يشترط ألّا تُفتح شعبةٌ بلا مدرّبٍ مؤهَّل. وقرارُ صاحب
     الأكاديميّة أن تُفتح الشعبُ كلُّها الآن على الفصل الأوّل وأن يُسنَد
     المدرّبون دفعةً واحدةً لاحقا — فخرج المدرّبُ من شروط الفتح.

     والحراسةُ لا تُرفع بل تنتقل إلى ما بقي صوابا: أن تُفتح **بجدولٍ وسعرٍ
     وخطّةٍ ومقعد**، فلا يُباع موعدٌ لا وجودَ له. */

  it('يفتح الشعبَ كلَّها — كلٌّ بجدولها وخطّتها', async () => {
    const res = await openAllCohorts(prisma, { apply: true, actorId })
    expect(res.applied).toBe(true)
    expect(res.opened, 'لم تُفتح شعبةٌ واحدة').toBeGreaterThan(0)
    expect(res.prepared, `بقيت شعبٌ مسوّدةً: ${JSON.stringify(res.rows.filter((r) => r.blocked))}`).toBe(0)

    const opened = await prisma.cohort.findMany({
      where: { status: 'open' },
      include: { sessions: true, plans: true },
    })
    for (const c of opened) {
      expect(c.sessions.length, `شعبةٌ مفتوحةٌ بلا جلسات: ${c.title}`).toBeGreaterThan(0)
      expect(c.plans.length, `شعبةٌ مفتوحةٌ بلا خطّةِ تقديم: ${c.title}`).toBeGreaterThan(0)
      expect(c.price, `شعبةٌ مفتوحةٌ بلا سعر: ${c.title}`).not.toBeNull()
      expect(c.registrationOpen, `شعبةٌ مفتوحةٌ والتسجيلُ مغلق: ${c.title}`).toBe(true)
    }
  })

  it('ولا جلسةَ قبل موعد الشعبة — الجدولُ يبدأ حيث وُضعت في الفصل', async () => {
    const opened = await prisma.cohort.findMany({
      where: { status: 'open', title: { contains: 'الدفعة الأولى' } },
      include: { sessions: { orderBy: { startsAt: 'asc' } } },
    })
    expect(opened.length).toBeGreaterThan(0)
    for (const c of opened) {
      expect(c.startsAt, `شعبةٌ بلا تاريخ بدء: ${c.title}`).not.toBeNull()
      expect(c.sessions[0].startsAt.getTime(), `جلسةٌ قبل موعد شعبتها: ${c.title}`)
        .toBeGreaterThanOrEqual(new Date().getTime())
    }
    /* والمواعيدُ موزّعةٌ لا مكوّمةٌ في يومٍ واحد */
    const distinctStarts = new Set(opened.map((c) => c.startsAt!.toISOString().slice(0, 10)))
    expect(distinctStarts.size, 'كلُّ الشعب تبدأ في اليوم نفسِه').toBeGreaterThan(1)
  })
})
