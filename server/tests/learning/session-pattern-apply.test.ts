/* أيّامُ الشعبة وساعتُها تُكتب من لقاءاتها المعتمَدة — عند اعتماد خطّة المدرّب وعند الفتح (١٢ أكتوبر ٢٠٢٦).

   «sessions or any other details could be filled here» (صاحب المنصّة): كان لسانُ «الجدول واللقاءات»
   بعد الاعتماد بلا أيّامٍ وبساعةٍ مفترَضة، ولا يرى الزائرُ أيّامَ الشعبة. وهنا على قاعدةٍ حقيقيّة:

   ١) **الاعتمادُ يكتبها** من اللقاءات المعتمَدة — لا الملغى ولا المؤقّت ولا المنتظِر.
   ٢) **والفتحُ يكتبها** لما اعتُمد قبل هذا.
   ٣) **ولا لقاءَ معتمَدا: لا يُمسّ ما كتبته الإدارة.** */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { approvedTrainerPlan, fixtureTrainerId } from '../helpers/approved-trainer'

let prisma: PrismaClient
let cohorts: CohortService
let plans: CohortPlanService
let managerId = ''
let courseId = ''

/* الأحد ٢٠٢٦-١١-١ والثلاثاء ٣ والأحد ٨ — السادسةُ مساءً بعمّان (+3) */
const SESSIONS = [
  { title: 'اللقاء 1', startsAt: new Date('2026-11-01T15:00:00Z') },
  { title: 'اللقاء 2', startsAt: new Date('2026-11-03T15:00:00Z') },
  { title: 'اللقاء 3', startsAt: new Date('2026-11-08T15:00:00Z') },
  /* وما ليس منها: ملغًى يوم الجمعة، ومؤقّتٌ يوم الاثنين — كلٌّ في ساعةٍ أخرى */
  { title: 'ملغى', startsAt: new Date('2026-11-06T09:00:00Z'), status: 'cancelled' },
  { title: 'مؤقّت', startsAt: new Date('2026-11-02T09:00:00Z'), placeholder: true },
]
/* ومنتظِرٌ يوم السبت — والاعتمادُ يعتمد المنتظِرَ معه إن أنشأ اجتماعَه (وZoom في الاختبار لا يُضمن)،
   فلا يُفحص به الاعتماد بل الفتح، وهو لا يعتمد لقاءً */
const PENDING = { title: 'منتظر', startsAt: new Date('2026-11-07T09:00:00Z'), approvalState: 'pending' }

async function draft(plan: 'approved' | 'submitted', sessions = SESSIONS) {
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبةُ الأيّام ${Math.random()}`, status: 'draft',
      capacity: 10, price: 100, currency: 'USD', financialReady: true,
      daysOfWeek: ['sat'], startTime: '10:00',
      sessions: { create: sessions },
      plans: {
        create: plan === 'approved'
          ? await approvedTrainerPlan(prisma)
          : { trainerId: await fixtureTrainerId(prisma), status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
      },
    },
    include: { plans: true },
  })
}

const scheduleOf = (id: string) => prisma.cohort.findUniqueOrThrow({ where: { id }, select: { daysOfWeek: true, startTime: true, timezone: true } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)
  plans = new CohortPlanService(prisma)
  const m = await auth.register('pattern-manager@test.local', 'Admin#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).id
}, 240_000)

describe('١ — الاعتماد يكتبها', () => {
  it('⚠️ اعتماد خطّة المدرّب يكتب أيّام اللقاءات المعتمدة وساعتها — ويقولها الأثر', async () => {
    const c = await draft('submitted')
    const r = await plans.decide(managerId, c.plans[0]!.id, true)
    expect(r.status).toBe('approved')
    expect(await scheduleOf(c.id)).toEqual({ daysOfWeek: ['sun', 'tue'], startTime: '18:00', timezone: 'Asia/Amman' })
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.plan.approve', entityId: c.id } })
    expect(audit.meta).toMatchObject({ daysOfWeek: ['sun', 'tue'], startTime: '18:00' })
  })
})

describe('٢ — والفتح يكتبها لما اعتمد قبل هذا', () => {
  it('⚠️ «افتح الشعبة» يكتب الأيّام والساعة من اللقاءات المعتمدة', async () => {
    const c = await draft('approved', [...SESSIONS, PENDING])
    await cohorts.open(c.id, managerId)
    expect(await scheduleOf(c.id)).toEqual({ daysOfWeek: ['sun', 'tue'], startTime: '18:00', timezone: 'Asia/Amman' })
  })
})

describe('٣ — ولا لقاء معتمدا: لا يمسّ ما كتبته الإدارة', () => {
  it('⚠️ لقاءات منتظرة وحدها — تبقى الأيّام والساعة كما هي', async () => {
    const c = await draft('approved', [PENDING])
    expect(await cohorts.applySessionPattern(c.id)).toBeNull()
    expect(await scheduleOf(c.id)).toMatchObject({ daysOfWeek: ['sat'], startTime: '10:00' })
  })
})
