/* «انتقل إلى هذا الموسم» — على قاعدةٍ حقيقيّة (١٨ أكتوبر ٢٠٢٦).

   ١) المعاينةُ لا تغيّر شيئا.
   ٢) التنفيذ: تُفتح شعبُ الموسم المعتمدةُ الجاهزة، وما لا تتمّ شروطُه يُسمّى ولا يُفتح.
   ٣) تُلغى الشعبُ الحيّةُ قبله بلا متعلّمين — وما فيه متعلّمٌ لا يُمسّ.
   ٤) يُفتح الموسمُ المخطَّط، وتنتهي المواسمُ الحيّةُ قبله. ولا يُحذف شيء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { SeasonSwitchService } from '../../services/season-switch.service'

const DAY = 86_400_000
const STAMP = Date.now()
let prisma: PrismaClient
let svc: SeasonSwitchService
let adminId = ''
let learnerId = ''
let profileId = ''
let courseId = ''
let oldTermId = ''
let newTermId = ''
const ids: Record<string, string> = {}

async function cohort(key: string, data: { termId: string; status: string; approved?: boolean; ready?: boolean; learner?: boolean }) {
  const c = await prisma.cohort.create({
    data: {
      courseId, title: `${key} ${STAMP}`, status: data.status, termId: data.termId,
      /* وغيرُ الجاهزة بلا إعدادٍ ماليّ — لا بلا سعة: المسعَّرةُ تُعطى ٢٠ ولا تُعدّ ناقصةً سعة (٢٠ أكتوبر ٢٠٢٦) */
      capacity: 10, price: 100, financialReady: data.ready !== false,
      registrationOpen: data.status !== 'draft',
    },
  })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'لقاء', startsAt: new Date(Date.now() + 40 * DAY) } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  if (data.approved) {
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: c.id, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [] } as never } })
  }
  if (data.learner) await prisma.enrollment.create({ data: { userId: learnerId, cohortId: c.id, status: 'enrolled' } })
  ids[key] = c.id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  svc = new SeasonSwitchService(prisma)
  adminId = (await auth.register(`ss-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير المواسم')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  learnerId = (await auth.register(`ss-learner-${STAMP}@test.local`, 'Learner#12345', 'متعلم')).userId
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-SS-${STAMP}`, fullName: 'مدرب المواسم', email: `ss-t-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, isVerified: true } })).id
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id

  /* موسمان بسنتين لا تُستعملان في غيره — الماضي حيٌّ «مخطَّط»، والجديدُ «مخطَّط» */
  oldTermId = (await prisma.term.create({ data: { year: 2091, season: 'aug_oct', titleAr: 'خريف تجربة', startsOn: new Date('2091-08-01'), endsOn: new Date('2091-10-31') } })).id
  newTermId = (await prisma.term.create({ data: { year: 2091, season: 'nov_jan', titleAr: 'شتاء تجربة', startsOn: new Date('2091-11-01'), endsOn: new Date('2092-01-31') } })).id

  await cohort('معتمدة جاهزة', { termId: newTermId, status: 'draft', approved: true })
  await cohort('معتمدة بلا سعة', { termId: newTermId, status: 'draft', approved: true, ready: false })
  await cohort('مسودة غير معتمدة', { termId: newTermId, status: 'draft' })
  await cohort('تجربة فارغة', { termId: oldTermId, status: 'open', approved: true })
  await cohort('تجربة بمتعلم', { termId: oldTermId, status: 'open', approved: true, learner: true })
}, 240_000)

describe('الانتقال إلى موسم', () => {
  it('المعاينة تسمي كل شيء ولا تغير شيئا', async () => {
    const p = await svc.preview(newTermId)
    const titles = (xs: { title: string }[]) => xs.map((x) => x.title.replace(` ${STAMP}`, ''))
    expect(titles(p.toOpen).sort()).toEqual(['معتمدة بلا سعة', 'معتمدة جاهزة'])
    expect(p.toOpen.find((c) => c.title.startsWith('معتمدة بلا سعة'))?.ready).toBe(false)
    expect(titles(p.toCancel)).toContain('تجربة فارغة')
    expect(titles(p.withLearners)).toContain('تجربة بمتعلم')
    expect(p.termsToClose.map((t) => t.id)).toContain(oldTermId)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: ids['تجربة فارغة']! } })).status).toBe('open')
  })

  it('التنفيذ يفتح ويغلق ولا يمس ما فيه متعلم', async () => {
    const r = await svc.apply(adminId, newTermId)
    const st = async (k: string) => prisma.cohort.findUniqueOrThrow({ where: { id: ids[k]! } })
    expect((await st('معتمدة جاهزة')).status).toBe('open')
    expect((await st('معتمدة جاهزة')).registrationOpen).toBe(true)
    expect((await st('معتمدة بلا سعة')).status, 'فتحت بلا شروطها').toBe('draft')
    expect(r.failed.map((f) => f.title)).toContain(`معتمدة بلا سعة ${STAMP}`)
    expect((await st('مسودة غير معتمدة')).status).toBe('draft')
    expect((await st('تجربة فارغة')).status).toBe('cancelled')
    expect((await st('تجربة فارغة')).registrationOpen).toBe(false)
    expect((await st('تجربة بمتعلم')).status, 'مس شعبة فيها متعلم').toBe('open')
    expect((await prisma.term.findUniqueOrThrow({ where: { id: newTermId } })).status).toBe('open')
    expect((await prisma.term.findUniqueOrThrow({ where: { id: oldTermId } })).status).toBe('closed')
    expect(await prisma.auditEvent.count({ where: { action: 'term.season_switch', entityId: newTermId } })).toBe(1)
  })
})
