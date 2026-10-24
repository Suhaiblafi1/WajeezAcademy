/* «لقاءاتي الآتية» — ما يُقابَل به ما يختاره الطالبُ من شعبٍ قبل أن يدفع (٢٤ أكتوبر ٢٠٢٦، `cohort-overlap.ts`).

   يحرس ما يدخل القائمةَ وما لا يدخلها: لقاءُ شعبةٍ سجّل فيها، آتٍ ومعتمَد — لا ما مضى، ولا ما ينتظر الإدارة، ولا
   الملغى، ولا ما انسحب منه، ولا شعبةٌ أُلغيت. ولا يُقرأ بلا دخول. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''
const STAMP = Date.now()
const H = 3_600_000
const at = (days: number) => new Date(Date.now() + days * 24 * H)

let kept = ''
let dropped = ''
let cancelled = ''

async function cohortWith(title: string, status = 'open') {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  return prisma.cohort.create({ data: { courseId: course.id, title: `${title} ${STAMP}`, status, capacity: 20 } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const u = await auth.register(`my-sessions-${STAMP}@test.local`, 'Learn#12345', 'طالب')
  await auth.setRoles(u.userId, ['learner'])
  cookie = `${SESSION_COOKIE}=${(await auth.login(`my-sessions-${STAMP}@test.local`, 'Learn#12345')).token}`

  const a = await cohortWith('شعبة مسجّلة')
  kept = a.id
  await prisma.enrollment.create({ data: { cohortId: a.id, userId: u.userId, status: 'enrolled' } })
  await prisma.cohortSession.createMany({
    data: [
      { cohortId: a.id, title: 'آت معتمد', startsAt: at(10), endsAt: new Date(at(10).getTime() + 2 * H), approvalState: 'approved' },
      { cohortId: a.id, title: 'مضى', startsAt: at(-3), endsAt: new Date(at(-3).getTime() + 2 * H), approvalState: 'approved' },
      { cohortId: a.id, title: 'ينتظر الإدارة', startsAt: at(12), endsAt: new Date(at(12).getTime() + 2 * H), approvalState: 'pending' },
      { cohortId: a.id, title: 'ملغى', startsAt: at(14), endsAt: new Date(at(14).getTime() + 2 * H), status: 'cancelled' },
    ],
  })

  const b = await cohortWith('شعبة انسحب منها')
  dropped = b.id
  await prisma.enrollment.create({ data: { cohortId: b.id, userId: u.userId, status: 'dropped' } })
  await prisma.cohortSession.create({ data: { cohortId: b.id, title: 'لقاء', startsAt: at(10), approvalState: 'approved' } })

  const c = await cohortWith('شعبة ألغيت', 'cancelled')
  cancelled = c.id
  await prisma.enrollment.create({ data: { cohortId: c.id, userId: u.userId, status: 'enrolled' } })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'لقاء', startsAt: at(10), approvalState: 'approved' } })
}, 180_000)

describe('لقاءاتي الآتية', () => {
  it('⚠️ لقاء شعبة سجّل فيها، آت ومعتمد — وحده', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/learner/my-sessions', headers: { cookie } })
    expect(r.statusCode, r.body).toBe(200)
    const { cohorts } = r.json() as { cohorts: { cohortId: string; titleAr: string; sessions: { startsAt: string }[] }[] }
    expect(cohorts.map((x) => x.cohortId)).toEqual([kept])
    expect(cohorts[0]!.sessions).toHaveLength(1)
    expect(cohorts[0]!.titleAr.startsWith('دورة')).toBe(true)
    expect([dropped, cancelled].some((id) => r.body.includes(id))).toBe(false)
  })

  it('⚠️ ولا يقرأ بلا دخول', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/learner/my-sessions' })).statusCode).toBe(401)
  })
})
