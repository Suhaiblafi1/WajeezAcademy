/* جاهزيّة العرض — فتحُ الشعب ومحاذاةُ الأسعار.

   ما يُحرَس هنا ثلاثة، وكلُّها تمسّ المال:

   ١) **العرضُ لا يكتب.** الزرّ في اللوحة يعمل على قاعدة الإنتاج مباشرة. فلو
      كتب `apply=false` شيئا، لصار «اعرض ما سيحدث» فعلا لا استعلاما — وهو
      أخطر ما يمكن أن يُخطئ فيه زرٌّ يفتح ٨١ شعبة.

   ٢) **لا سعرَ مُختلَق.** دورةٌ بلا سعرِ قائمة لا تُفتح لها شعبة، لأنّ فتحها
      يوجب اختلاق رقم — ورقمٌ مُختلَق يُطالَب به في الفاتورة.

   ٣) **المقعدُ المدفوع لا يُعاد تسعيره.** إعادةُ التسعير بعد الحجز تغيّر ما
      اتُّفق عليه بعد الاتّفاق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { openAllCohorts, alignCohortPrices } from '../../services/catalog-readiness.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
})

describe('فتح الشعب', () => {
  it('العرضُ لا يكتب صفّا واحدا', async () => {
    const before = await prisma.cohort.count()
    const r = await openAllCohorts(prisma, { apply: false })
    const after = await prisma.cohort.count()
    expect(after).toBe(before)
    expect(r.applied).toBe(false)
    expect(r.publishedCourses).toBeGreaterThan(0)
  })

  it('ولا يفتح دورةً بلا سعرِ قائمة — ولا يختلق لها سعرا', async () => {
    const r = await openAllCohorts(prisma, { apply: false })
    const refused = r.rows.filter((x) => x.reason)
    for (const row of refused) {
      const c = await prisma.course.findUnique({ where: { id: row.courseId }, select: { listPrice: true } })
      expect(c?.listPrice).toBeNull()
    }
    /* وكلُّ ما سيُفتح له سعرٌ موجب من كتالوجه */
    for (const row of r.rows.filter((x) => !x.reason)) {
      expect(row.price).toBeGreaterThan(0)
      expect(row.currency).not.toBe('—')
    }
  })

  /* والفتحُ اليوم يستوفي شروطَه كلَّها هنا: المدرّبُ خرج منها (يُسنَد دفعةً
     واحدةً لاحقا)، والأربعةُ الباقيةُ — جدولٌ وسعةٌ وخطّةٌ وسعر — تُكتب مع
     الشعبة. فما يُحرَس أن تُفتح **كاملةً** لا أن تبقى محبوسة. */
  /* ── ومهلةٌ صريحةٌ لهذين، ولمَ ليست تخفيفا ──

     يفتح هذا الاختبارُ شعبةَ كلِّ دورةٍ منشورة — أكثرَ من ثمانين — بشروطها
     الخمسة وجدولٍ موزّع. وهو عملٌ يأخذ ثانيتَين ونصفا على جهازٍ فارغ، ومهلةُ
     جسم الاختبار الافتراضيّة **خمسُ ثوانٍ**: هامشٌ يبتلعه عدّاءٌ محمَّل.

     وقد سقط في جولة CI ٦٤٦ بـ«Test timed out in 5000ms»، ثمّ سقط الذي بعده
     تبعا له: الأوّلُ انقطع في منتصفه فبقيت شعبٌ لم تُفتح، ففتحها الثاني
     وقال «أُنشئت نسخةٌ ثانية» — وهو عرَضٌ لا علّة.

     وقِيس أنّه ليس بطئا طارئا من تغييرٍ قريب: ثلاثُ جولاتٍ على هذا الفرع
     (٢٣٦٨ · ٢٧٢٩ · ٢٨٩٦) وثلاثٌ على `main` (٢٦١١ · ٢٦١٩ · ٢٥١٠) — والفرقُ
     بين الوسطَين أقلُّ من تشتّتِ الفرع الواحد.

     فالمهلةُ هي الخطأ لا العمل، ولا يُمسّ شرطٌ واحدٌ من شروط الاختبار. */
  it('والتنفيذُ يفتح الشعبَ بجدولٍ موزّعٍ على الفصل', async () => {
    const first = await openAllCohorts(prisma, { apply: true })
    expect(first.opened, 'لم تُفتح شعبةٌ واحدة').toBeGreaterThan(0)
    expect(first.prepared, `بقيت مسوّدات: ${JSON.stringify(first.rows.filter((r) => r.blocked))}`).toBe(0)

    /* ولكلّ صفٍّ موعدُ بدءٍ معلَن، والمواعيدُ متفاوتة */
    const dates = first.rows.filter((r) => !r.reason).map((r) => r.startsAt)
    expect(dates.every(Boolean), 'صفٌّ بلا موعدِ بدء').toBe(true)
    expect(new Set(dates).size, 'كلُّ الشعب في يومٍ واحد').toBeGreaterThan(1)
    /* ولا موعدَ في الماضي — الفتحُ يسبق أوّلَ جلسةٍ بمهلةٍ للتسجيل */
    for (const d of dates) expect(new Date(d!).getTime()).toBeGreaterThan(Date.now())
  }, 60_000)

  it('ولا يُنشئ نسخةً ثانيةً لدورةٍ لها شعبةٌ قائمة — ولو كانت مسوّدة', async () => {
    const before = await prisma.cohort.count()
    const second = await openAllCohorts(prisma, { apply: true })
    expect(second.opened + second.prepared, 'أُنشئت نسخةٌ ثانية').toBe(0)
    expect(second.alreadyLive).toBeGreaterThan(0)
    expect(await prisma.cohort.count()).toBe(before)
  }, 60_000)
})

describe('محاذاة الأسعار', () => {
  it('العرضُ لا يغيّر سعرا', async () => {
    const before = await prisma.cohort.findMany({ select: { id: true, price: true }, orderBy: { id: 'asc' } })
    await alignCohortPrices(prisma, { apply: false })
    const after = await prisma.cohort.findMany({ select: { id: true, price: true }, orderBy: { id: 'asc' } })
    expect(after.map((c) => String(c.price))).toEqual(before.map((c) => String(c.price)))
  })

  it('والمقعدُ المحجوز يمنع إعادة التسعير', async () => {
    /* شعبةٌ بسعرٍ مخالفٍ لقائمتها، وفيها مقعدٌ محجوز */
    const course = await prisma.course.findFirst({ where: { listPrice: { not: null } } })
    expect(course).toBeTruthy()
    const cohort = await prisma.cohort.create({
      data: {
        courseId: course!.id, title: 'شعبةٌ لها مقعدٌ محجوز', status: 'open',
        startsAt: new Date(Date.now() + 30 * 86_400_000), capacity: 10,
        price: 1, currency: 'USD', registrationOpen: true,
      },
    })
    /* متعلّمٌ حقيقيّ — قاعدةُ الاختبار تُبنى بلا مستخدمين */
    const learner = await prisma.user.create({
      data: {
        email: `seatholder-${Date.now()}@test.local`,
        passwordHash: 'x'.repeat(60),
        displayName: 'صاحبُ مقعدٍ محجوز',
      },
    })
    await prisma.enrollmentRequest.create({
      data: { cohortId: cohort.id, userId: learner.id, status: 'seat_held' },
    })

    const r = await alignCohortPrices(prisma, { apply: true })
    const blocked = r.rows.find((x) => x.cohortId === cohort.id)
    expect(blocked?.blocked).toContain('محجوزا')

    const after = await prisma.cohort.findUnique({ where: { id: cohort.id }, select: { price: true } })
    expect(Number(after!.price)).toBe(1)

    await prisma.enrollmentRequest.deleteMany({ where: { cohortId: cohort.id } })
    await prisma.cohort.delete({ where: { id: cohort.id } })
    await prisma.user.delete({ where: { id: learner.id } })
  })
})

/* إيقاعُ اللقاءات — قرارُ صاحب المنصّة: ثلاثٌ أو أربعٌ **لا أكثر**، متباعدة.

   وكان الحسابُ «جلستان لكلّ وحدة»، فدورةٌ بستّ وحداتٍ تأخذ اثنتَي عشرة. وهو
   انحدارٌ صامت: تُضاف وحدةٌ إلى دورةٍ فيزيد لقاؤها المباشر، بلا قرارٍ من أحد.
   فيُقاس العددُ نفسُه هنا لا الحسابُ الذي أنتجه. */
describe('إيقاعُ الجلسات المباشرة', () => {
  it('لا شعبةَ تتجاوز أربعَ جلساتٍ مباشرة، ولا تقلّ عن ثلاث', async () => {
    await openAllCohorts(prisma, { apply: true })
    const cohorts = await prisma.cohort.findMany({
      where: { sessions: { some: {} } },
      select: { id: true, title: true, sessions: { select: { startsAt: true } } },
    })
    expect(cohorts.length, 'لا شعبةَ ذاتَ جلسات — لم يُفتح شيء').toBeGreaterThan(0)
    for (const c of cohorts) {
      expect(
        c.sessions.length,
        `«${c.title}» فيها ${c.sessions.length} جلسة — والحدُّ أربع`,
      ).toBeLessThanOrEqual(4)
      expect(c.sessions.length, `«${c.title}» فيها ${c.sessions.length} جلسة — والأدنى ثلاث`)
        .toBeGreaterThanOrEqual(3)
    }
  })

  it('وبين كلِّ جلستين أسبوعان — مساحةُ المادّة والمهامّ لا فراغ', async () => {
    const cohort = await prisma.cohort.findFirst({
      where: { sessions: { some: {} } },
      select: { title: true, sessions: { select: { startsAt: true }, orderBy: { startsAt: 'asc' } } },
    })
    expect(cohort, 'لا شعبةَ ذاتَ جلسات').toBeTruthy()
    const times = cohort!.sessions.map((s) => s.startsAt.getTime())
    expect(times.length).toBeGreaterThan(1)
    for (let i = 1; i < times.length; i += 1) {
      const days = Math.round((times[i] - times[i - 1]) / 86_400_000)
      expect(days, `«${cohort!.title}»: بين الجلستين ${i} و${i + 1} ${days} يوما لا ١٤`).toBe(14)
    }
  })
})
