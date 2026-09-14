/* مخاطبةُ مستشاري متعلّمي الشعبة — ومن هم فعلا (ع-١).

   ═══ السؤالُ وجوابُه ═══

   سؤالُ ع-١: «مستشارو دورته» أهم المسنَدون إلى الشعبة أم من يتابعون
   متعلّميها؟ والجوابُ في المخطّط لا في الرأي: **لا رابطَ بين مستشارٍ وشعبة
   ولا بينه وبين دورة**. المستشارُ يُسنَد إلى **حالة**، والحالةُ لها عميلٌ
   هو إنسان. فالطريقُ الوحيدُ الذي تسنده البيانات واحد.

   ═══ وما يُحرَس هنا ═══

   ① من يتابع متعلّما في الشعبة يصله، ومن لا يتابع أحدا منهم لا يصله.
   ② والإسنادُ المُلغى (`unassignedAt`) لا يصله — من رُفعت عنه الحالةُ
      لا شأنَ له بها.
   ③ والمستشارُ الواحدُ يتابع اثنين في الشعبة فيصله **واحدةٌ لا اثنتان**.
   ④ وشعبةٌ لا مستشارَ على أحدٍ من متعلّميها تُردّ بسببٍ مفهوم، ولا تُكتب
      رسالةٌ لا تبلغ أحدا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortMessageService } from '../../services/cohort-message.service'

let prisma: PrismaClient
let messages: CohortMessageService
let auth: AuthService
let cohortId = ''
let emptyCohortId = ''
let trainerId = ''
let advisorBoth = ''
let advisorStale = ''
let advisorOther = ''

const STAMP = Date.now()
const COURSE = 'C-BIZ-101'

/** متعلّمٌ في شعبةٍ ومعه حالةٌ — يُعيد معرّفَ الحالة */
async function learnerWithCase(cohort: string, tag: string): Promise<string> {
  const u = await auth.register(`adv-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${tag}`)
  await prisma.enrollment.create({ data: { userId: u.userId, cohortId: cohort, status: 'enrolled' } })
  const c = await prisma.advisorCase.create({ data: { clientId: u.userId, status: 'enrolled' } })
  return c.id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  messages = new CohortMessageService(prisma)

  const mk = async (tag: string) => (await auth.register(`adv-u-${tag}-${STAMP}@test.local`, 'Advisor#12345', `مستشار ${tag}`)).userId
  advisorBoth = await mk('both')
  advisorStale = await mk('stale')
  advisorOther = await mk('other')
  trainerId = (await auth.register(`adv-trainer-${STAMP}@test.local`, 'Trainer#12345', 'مدرّبُ الشعبة')).userId

  const base = {
    courseId: COURSE, status: 'active', registrationOpen: false, financialReady: true,
    price: 100, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() - 30 * 86_400_000),
  }
  cohortId = (await prisma.cohort.create({ data: { ...base, title: `شعبةُ المستشارين ${STAMP}` } })).id
  emptyCohortId = (await prisma.cohort.create({ data: { ...base, title: `شعبةٌ بلا مستشار ${STAMP}` } })).id

  const caseA = await learnerWithCase(cohortId, 'a')
  const caseB = await learnerWithCase(cohortId, 'b')

  /* المتابعُ نفسُه على متعلّمَين — ويصله واحدة */
  await prisma.advisorAssignment.create({ data: { caseId: caseA, advisorId: advisorBoth } })
  await prisma.advisorAssignment.create({ data: { caseId: caseB, advisorId: advisorBoth } })
  /* وإسنادٌ رُفع — لا يصله */
  await prisma.advisorAssignment.create({
    data: { caseId: caseA, advisorId: advisorStale, unassignedAt: new Date() },
  })
  /* ومتابعُ إنسانٍ خارج الشعبة — لا يصله */
  const outsider = await auth.register(`adv-out-${STAMP}@test.local`, 'Learner#12345', 'من خارجها')
  const caseOut = await prisma.advisorCase.create({ data: { clientId: outsider.userId, status: 'new' } })
  await prisma.advisorAssignment.create({ data: { caseId: caseOut.id, advisorId: advisorOther } })

  /* والشعبةُ الفارغة: متعلّمٌ بلا حالةٍ أصلا */
  const lone = await auth.register(`adv-lone-${STAMP}@test.local`, 'Learner#12345', 'بلا مستشار')
  await prisma.enrollment.create({ data: { userId: lone.userId, cohortId: emptyCohortId, status: 'enrolled' } })
})

describe('مستشارو الشعبة هم من يتابعون متعلّميها', () => {
  it('تصل من يتابع متعلّما فيها — ولا تصل غيرَه', async () => {
    const msg = await messages.send(trainerId, cohortId, {
      audience: 'advisors',
      body: 'متعلّمان في شعبتي يحتاجان متابعةً بعد اللقاء الثالث',
    })
    expect(msg.audience).toBe('advisors')
    /* ③ المتابعُ على اثنين واحدٌ لا اثنان */
    expect(msg.recipients).toBe(1)
    expect(msg.enrollmentId).toBeNull()

    const reached = await prisma.notification.findMany({
      where: { data: { path: ['messageId'], equals: msg.id } },
      select: { userId: true, audience: true },
    })
    expect(reached.map((n) => n.userId)).toEqual([advisorBoth])
    /* والمستشارُ يقرأ من جانب الفريق لا من جانب المتعلّم */
    expect(reached[0].audience).toBe('staff')
    expect(reached.map((n) => n.userId)).not.toContain(advisorStale)
    expect(reached.map((n) => n.userId)).not.toContain(advisorOther)
  })

  it('وشعبةٌ لا مستشارَ على أحدٍ من متعلّميها تُردّ ولا تُكتب رسالةٌ لا تبلغ أحدا', async () => {
    await expect(messages.send(trainerId, emptyCohortId, {
      audience: 'advisors', body: 'رسالةٌ لا أحدَ يقرؤها',
    })).rejects.toMatchObject({ code: 'no_advisors' })
    const none = await prisma.cohortMessage.count({ where: { cohortId: emptyCohortId } })
    expect(none, 'كُتبت رسالةٌ لا تبلغ أحدا').toBe(0)
  })

  it('ومخاطبةُ الشعبة نفسِها لم تتغيّر — المتعلّمون لا المستشارون', async () => {
    const msg = await messages.send(trainerId, cohortId, { audience: 'cohort', body: 'إعلانٌ لكم جميعا' })
    expect(msg.recipients).toBe(2)
    const reached = await prisma.notification.findMany({
      where: { data: { path: ['messageId'], equals: msg.id } },
      select: { userId: true, audience: true },
    })
    expect(reached).toHaveLength(2)
    expect(reached.every((n) => n.audience === 'learner')).toBe(true)
    expect(reached.map((n) => n.userId)).not.toContain(advisorBoth)
  })
})
