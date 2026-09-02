/* عمولةُ المستشار: ما هو له، وما ليس له.

   الدالّةُ وصلت من جلسةٍ أخرى بعطبين متعاكسين — كلاهما على رقمٍ يُعرض
   للمستشار باسم «المستحقّ لي»، وهو أوّلُ ما يُختلف عليه:

   ١) **إتمامُ العمل كان يمحو أجرَه**: المقامُ كان مقيَّدا بـ`unassignedAt:
      null`، فمن أغلق حالةً ورُفع إسنادُها — وهو ما يقع عند كلّ بيعةٍ تمّت —
      سقطت عمولتُها. فالمجتهدُ يرى صفرا والمتقاعسُ يرى رقما.

   ٢) **ويُحسب له ما ليس من عمله**: كلُّ ما دفعه العميلُ في عمره كلِّه، بما
      اشتراه قبل أن يعرف المستشارَ أصلا.

   ٣) وثالثةٌ في المعدَّل: كان مقيَّدا بالتقييمات المعتمَدة، والمخطَّطُ يمنع
      ذلك صراحةً — الاعتمادُ يحكم التعليقَ المكتوب لا الدرجة، «لو اختارت
      الإدارةُ أيَّ الدرجات تدخل فيه لصار الرقمُ مصنوعا». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let advisorId = ''

const STAMP = Date.now()
const DAY = 86_400_000

const mkClient = async (tag: string) => {
  const u = await auth.register(`adv-${tag}-${STAMP}@test.local`, 'Client#12345', `عميل ${tag}`)
  await auth.setRoles(u.userId, ['learner'])
  return u.userId
}

/** حالةُ عميلٍ مُسندةٌ إلى المستشار في وقتٍ محدَّد، ثمّ تُغلق أو تبقى */
async function assignCase(clientId: string, assignedAt: Date, unassignedAt: Date | null) {
  const c = await prisma.advisorCase.create({ data: { clientId, status: 'contacted' } })
  await prisma.advisorAssignment.create({
    data: { caseId: c.id, advisorId, assignedAt, unassignedAt },
  })
  return c.id
}

const paidOrder = (userId: string, total: number, paidAt: Date) =>
  prisma.order.create({
    data: { userId, status: 'paid', subtotal: total, total, currency: 'USD', paidAt, createdAt: paidAt },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  const a = await auth.register(`adv-self-${STAMP}@test.local`, 'Advisor#12345', 'المستشار')
  advisorId = a.userId
  await auth.setRoles(advisorId, ['advisor'])
  await prisma.advisorProfile.create({ data: { userId: advisorId, commissionPct: 10 } })
}, 240_000)

describe('نسبةُ المستشار تُحسب على ما هو من عمله', () => {
  it('الحالةُ المغلقةُ تبقى في حسابه — إتمامُ العمل لا يمحو أجرَه', async () => {
    const client = await mkClient('closed')
    const assignedAt = new Date(Date.now() - 30 * DAY)
    await assignCase(client, assignedAt, new Date(Date.now() - 5 * DAY))
    await paidOrder(client, 200, new Date(Date.now() - 20 * DAY))

    const e = await advisors.myEarnings(advisorId)
    expect(e.revenueFromReferrals, 'سقطت عمولةُ حالةٍ أُغلقت').toBe(200)
    expect(e.commissionOwed).toBe(20)
    /* والحالاتُ النشطةُ تعني النشطةَ فعلا — بخلاف مقام العمولة */
    expect(e.activeCases, '«النشطة» عدّت المغلقة').toBe(0)
  })

  it('وما دُفع قبل إسناده إليه ليس له', async () => {
    const client = await mkClient('before')
    const assignedAt = new Date(Date.now() - 10 * DAY)
    await assignCase(client, assignedAt, null)
    await paidOrder(client, 500, new Date(Date.now() - 40 * DAY))   // قبل معرفته به
    await paidOrder(client, 100, new Date(Date.now() - 2 * DAY))    // بعد إسناده

    const e = await advisors.myEarnings(advisorId)
    /* ٢٠٠ من الاختبار الأوّل + ١٠٠ من هذا — و٥٠٠ ما قبل الإسناد خارجها */
    expect(e.revenueFromReferrals, 'حُسب له ما اشتُري قبل أن يعرفه').toBe(300)
    expect(e.activeCases).toBe(1)
  })

  it('والمعدَّلُ على كلّ التقييمات لا على ما اعتمدته الإدارة', async () => {
    /* ثلاثةُ تقييمات: واحدٌ معتمَدٌ واثنان معلَّقان. فبقيدِ الاعتماد يقع
       العددُ تحت الحدّ الأدنى (٣) فيُخفى المعدَّل كلُّه — وهو رقمٌ مصنوع. */
    const rater = await mkClient('rater')
    const cohort = await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title: `شعبةُ التقييم ${STAMP}`, status: 'active',
        registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 10,
      },
    })
    for (const [i, status] of ['approved', 'pending', 'pending'].entries()) {
      const learner = i === 0 ? rater : await mkClient(`rater-${i}`)
      const enrollment = await prisma.enrollment.create({
        data: { cohortId: cohort.id, userId: learner, status: 'enrolled' },
      })
      await prisma.rating.create({
        data: {
          enrollmentId: enrollment.id, raterId: learner, subjectType: 'advisor', subjectId: advisorId,
          score: 5, publishStatus: status,
        },
      })
    }

    const e = await advisors.myEarnings(advisorId)
    expect(e.ratingCount, 'العدُّ على المعتمَد وحدَه').toBe(3)
    expect(e.ratingAvg, 'أُخفي المعدَّلُ لأنّ الإدارة لم تعتمد ما يكفي').toBe(5)
  })
})
