/* «لا يحقّ له تغيير مساره بعد الدفع» — والبابان الجملتان كانا مفتوحين.

   `removeItem` و`replaceItem` محروسان بـ`assertNotEnrolled` منذ كُتبا: من
   سجّل في دورةٍ لا ينزعها من خطّته. لكنّ الحارسَ مفردٌ يُنادى على دورةٍ
   بعينها — ولا يمرّ به من يبدّل الخطّة **جملةً**:

     · `replaceCourses` يحذف بنودَ الخطّة كلَّها ثمّ يعيد إنشاءها من قائمةٍ
       يرسلها العميل.
     · `adopt` (اعتمادُ خطّةٍ جديدة) يؤرشف الفعّالة وينشئ غيرَها.

   فنداءٌ واحد إلى أيّهما يبدّل المسارَ كلَّه بعد الدفع — لا باختراق الحارس
   بل بألّا يمرّ به. وهذا هو صنفُ الثغرة الذي لا يظهر في اختبارٍ يقيس
   الحارسَ نفسَه.

   والقاعدةُ ليست «لا تعديل»: يُضيف ما شاء ويبدّل ما لم يُدفع عنه. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { EnrollmentService } from '../../services/enrollment.service'

const POOL: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
  ) as { courses: { course_id: string }[] }
).courses.map((c) => c.course_id)

/* دوراتٌ لا يستعملها غيرُ هذا الملفّ — الشعب تتراكم في قاعدةٍ واحدة */
const PAID = POOL[70]
const FREE = POOL[71]
const OTHER = POOL[72]

let prisma: PrismaClient
let plans: PlanService
let learnerId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  plans = new PlanService(prisma)
  const auth = new AuthService(prisma)
  const enrollments = new EnrollmentService(prisma)
  learnerId = (await auth.register('plan-lock@test.local', 'Learner#12345', 'مشترٍ')).userId

  const cohort = await prisma.cohort.create({
    data: {
      courseId: PAID, title: 'شعبةٌ اشتُريت', status: 'open',
      registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 40 * 86_400_000),
    },
  })
  await enrollments.enroll(cohort.id, learnerId, null, {})
}, 180_000)

/** خطّةٌ فعّالة من الثلاث قبل كلّ اختبار */
beforeEach(async () => {
  await prisma.learnerPlan.deleteMany({ where: { userId: learnerId } })
  await prisma.learnerPlan.create({
    data: {
      userId: learnerId, nameAr: 'خطّتي', composed: false,
      items: { create: [PAID, FREE, OTHER].map((courseId, i) => ({ courseId, sequence: i + 1 })) },
    },
  })
})

describe('البابُ الجمليّ: تبديلُ دورات الخطّة دفعةً واحدة', () => {
  it('لا تُسقَط دورةٌ اشتُريت — وهذا ما كان يمرّ بلا حارس', async () => {
    await expect(
      plans.replaceCourses(learnerId, [FREE, OTHER]),
      'بُدّل المسارُ كلُّه بعد الشراء',
    ).rejects.toThrow(/لا يُغيَّر المسار بعد الشراء/)
  })

  it('ويُبدَّل ما لم يُدفع عنه — القاعدةُ ليست «لا تعديل»', async () => {
    const view = await plans.replaceCourses(learnerId, [PAID, POOL[73]])
    expect(view.items.map((i) => i.courseId).sort()).toEqual([PAID, POOL[73]].sort())
  })

  it('ولمن لم يشترِ شيئا تبقى خطّتُه طيّعةً كما كانت', async () => {
    const auth = new AuthService(prisma)
    const fresh = (await auth.register(`plan-free-${Date.now()}@test.local`, 'Free#12345', 'لم يشترِ')).userId
    await plans.adopt(fresh, { nameAr: 'خطّة', composed: false, courseIds: [FREE, OTHER] })
    const view = await plans.replaceCourses(fresh, [POOL[74]])
    expect(view.items.map((i) => i.courseId)).toEqual([POOL[74]])
  })
})

describe('البابُ الثاني: اعتمادُ خطّةٍ جديدة يؤرشف القديمة', () => {
  it('خطّةٌ جديدة بلا الدورة المشتراة تُرفض — وإلّا صار الأرشفةُ مهربا', async () => {
    await expect(
      plans.adopt(learnerId, { nameAr: 'خطّة أخرى', composed: true, courseIds: [FREE, OTHER] }),
    ).rejects.toThrow(/لا يُغيَّر المسار بعد الشراء/)
  })

  it('وتُقبَل حين تحملها معها — فالإضافةُ ليست تبديلا', async () => {
    const view = await plans.adopt(learnerId, {
      nameAr: 'خطّة موسَّعة', composed: true, courseIds: [PAID, POOL[75], POOL[76]],
    })
    expect(view.items.map((i) => i.courseId)).toContain(PAID)
    expect(view.items).toHaveLength(3)
  })
})

describe('والحارسُ المفرد باقٍ كما كان', () => {
  it('لا تُحذف دورةٌ سجّل فيها', async () => {
    await expect(plans.removeItem(learnerId, PAID)).rejects.toThrow(/مسجَّل في هذه الدورة/)
  })

  it('ولا تُستبدَل', async () => {
    await expect(plans.replaceItem(learnerId, PAID, POOL[77])).rejects.toThrow(/مسجَّل في هذه الدورة/)
  })
})
