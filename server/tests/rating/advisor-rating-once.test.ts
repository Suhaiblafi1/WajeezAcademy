/* المستشارُ يُقيَّم مرّةً لكلّ متعلّم (١٥ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «One per learner»).

   كان تقييمُ المستشار يُعلَّق بأوّل تسجيلٍ في قائمةٍ بلا ترتيب، والمفتاحُ الفريدُ بالتسجيل. فمن له تسجيلان وانسحب من
   أوّلهما صار تسجيلُه الثاني «الأوّل»، فقيّم المستشارَ ثانيةً — وكلا التقييمين في معدّله. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { RatingService } from '../../services/rating.service'

let prisma: PrismaClient
let auth: AuthService
const STAMP = Date.now()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 240_000)

describe('تقييم المستشار', () => {
  it('⚠️ له تسجيلان وانسحب من أولهما: يحدث تقييمه ولا يضيف ثانيا', async () => {
    const learner = (await auth.register(`aro-l-${STAMP}@test.local`, 'Learner#12345', 'متعلم')).userId
    const advisorId = (await auth.register(`aro-a-${STAMP}@test.local`, 'Advisor#12345', 'مستشار')).userId
    await makeAdvisor(prisma, auth, advisorId)
    await prisma.advisorCase.create({ data: { clientId: learner, assignments: { create: { advisorId } } } })
    const started = new Date(Date.now() - 86_400_000)
    const seat = async (n: number) => {
      const c = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: `شعبة ${n}`, status: 'active', capacity: 10, startsAt: started } })
      return prisma.enrollment.create({ data: { userId: learner, cohortId: c.id, status: 'enrolled', createdAt: new Date(Date.now() - (10 - n) * 1000) } })
    }
    const first = await seat(1)
    await seat(2)
    const ratings = new RatingService(prisma)

    const rateAdvisor = async (score: number) => {
      const target = (await ratings.rateableFor(learner)).find((r) => r.subjectType === 'advisor')
      expect(target, 'لا يعرض المستشار للتقييم').toBeTruthy()
      await ratings.submit(learner, { enrollmentId: target!.enrollmentId, subjectType: 'advisor', subjectId: advisorId, score })
      return target!
    }
    await rateAdvisor(2)
    await prisma.enrollment.update({ where: { id: first.id }, data: { status: 'dropped' } })
    const again = await rateAdvisor(5)
    expect(again.myScore, 'لا يرى تقييمه السابق').toBe(2)

    const rows = await prisma.rating.findMany({ where: { raterId: learner, subjectType: 'advisor', subjectId: advisorId } })
    expect(rows, 'قيّم المستشار مرتين').toHaveLength(1)
    expect(rows[0].score).toBe(5)
  })
})
