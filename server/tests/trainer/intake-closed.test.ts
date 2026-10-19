/* إغلاقُ استقبال طلبات المدرّبين — على قاعدةٍ حقيقيّة (١٩ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/intake-closed.ts`. وما يُحرَس هنا:

   ① **الطلبُ يُرسَل فيؤجَّل وحدَه** — إلى `deferred` بموعد ٢١ ديسمبر لا بموعد التأجيل
      العاديّ، وسطرُ «اكتمل التقديم» يبقى قبله، والفاعلُ النظام. ويُقال للفريق.
   ② **وصفحةُ حالته تعرفه** — `intakeDeferred` له، ولا لمن أجّله مراجع.
   ③ **والوعدُ يُوفى** — في موعده يسأله العاملُ «أما زلتَ مهتمّا؟».
   ④ **والمفتاحُ يعمل** — `TRAINER_INTAKE=open` يعيد الطريقَ العاديّ، ومضيُّ الموعد كذلك.

   والساعةُ مثبَّتةٌ (`Date` وحدَه): الإغلاقُ ينتهي يومَ موعده، فلا يسقط الاختبارُ
   يومَ يمضي ديسمبر. ومتغيّرُ البيئة يُمحى هنا — `vitest.server.config.ts` يفتحه للبقيّة. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerDeferralService } from '../../services/trainer-deferral.service'
import { DEFERRED, deferredFollowUpAt } from '../../../src/application/trainer/deferral'
import { INTAKE_DEFER_NOTE_AR, intakeFollowUpAt } from '../../../src/application/trainer/intake-closed'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let deferral: TrainerDeferralService
let adminId: string
const savedEnv = process.env.TRAINER_INTAKE

/** يومُ الإغلاق — قبل موعد التواصل */
const OCT_20 = new Date('2026-10-20T09:00:00Z')

const base = {
  phoneCountryCode: '+962', phone: '771070000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة بيانات', specialties: ['البيانات'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

async function apply(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const done = await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['feb_apr'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  const row = await prisma.trainerApplication.findUniqueOrThrow({
    where: { reference: res.reference },
    include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
  })
  return { ...row, returned: done.status }
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_20)
  delete process.env.TRAINER_INTAKE
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  deferral = new TrainerDeferralService(prisma)
  const admin = await auth.register('admin-intake@test.local', 'Admin#12345', 'المديرة الأكاديميّة')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

afterAll(() => {
  if (savedEnv === undefined) delete process.env.TRAINER_INTAKE
  else process.env.TRAINER_INTAKE = savedEnv
  vi.useRealTimers()
})

describe('① الطلبُ يُرسَل فيؤجَّل وحدَه', () => {
  it('⚠️ يصير مؤجَّلا بموعد ٢١ ديسمبر — وتقوله الخدمةُ للشاشة', async () => {
    const a = await apply('intake-1@test.local', 'سلمى العمري')
    expect(a.status).toBe(DEFERRED)
    expect(a.returned, 'الشاشةُ تقرأ الحكمَ من هنا').toBe(DEFERRED)
    expect(a.deferredFollowUpAt?.toISOString()).toBe('2026-12-21T00:00:00.000Z')
    expect(a.deferredFollowUpAt?.getTime()).toBe(intakeFollowUpAt().getTime())
  })

  it('⚠️ وموعدُه موعدُ الإغلاق لا موعدُ التأجيل العاديّ — يفترقان من نوفمبر', async () => {
    /* في نوفمبر يحسب التأجيلُ العاديُّ «الذي بعد القادم» = الصيف. والوعدُ ديسمبر */
    vi.setSystemTime(new Date('2026-11-15T09:00:00Z'))
    try {
      const a = await apply('intake-nov@test.local', 'ريم الخطيب')
      expect(deferredFollowUpAt(new Date()).getTime()).not.toBe(intakeFollowUpAt().getTime())
      expect(a.deferredFollowUpAt?.getTime()).toBe(intakeFollowUpAt().getTime())
    } finally {
      vi.setSystemTime(OCT_20)
    }
  })

  it('⚠️ وسطرُ «اكتمل التقديم» يبقى قبله — والتأجيلُ بيد النظام', async () => {
    const a = await apply('intake-2@test.local', 'هدى ناصر')
    const rows = a.statusHistory.map((h) => ({ to: h.toStatus, note: h.note, actor: h.actorId }))
    expect(rows.map((r) => r.to)).toEqual(['draft', 'submitted', DEFERRED])
    expect(rows[2]).toEqual({ to: DEFERRED, note: INTAKE_DEFER_NOTE_AR, actor: null })
  })

  it('⚠️ ويُقال للفريق إنّه أُجّل وحده — لا «بانتظار الفرز»', async () => {
    const a = await apply('intake-3@test.local', 'منى سالم')
    const notes = await prisma.notification.findMany({
      where: { userId: adminId, templateKey: 'admin.trainer_application' },
      select: { body: true, data: true },
    })
    const mine = notes.find((n) => (n.data as { reference?: string } | null)?.reference === a.reference)
    expect(mine?.body).toMatch(/الاستقبال مغلق/)
    expect(mine?.body).not.toMatch(/بانتظار الفرز/)
  })
})

describe('② وصفحةُ حالته تعرفه', () => {
  it('⚠️ `intakeDeferred` لمن أُجّل بالإغلاق', async () => {
    const a = await apply('intake-4@test.local', 'نور حدّاد')
    const st = await apps.getPublicStatus(a.email, a.reference)
    expect(st.status).toBe(DEFERRED)
    expect(st.intakeDeferred).toBe(true)
  })

  it('⚠️ ولا لمن أجّله مراجعٌ بعدها — آخرُ دخولٍ في التأجيل هو الحَكَم', async () => {
    const a = await apply('intake-5@test.local', 'دانة يوسف')
    /* بعد أيّام كما يقع — والساعةُ المثبَّتةُ تُسوّي التوقيتَين فلا يُعرف أيُّهما الآخر */
    vi.setSystemTime(new Date('2026-10-27T09:00:00Z'))
    try {
      await prisma.trainerApplication.update({ where: { id: a.id }, data: { emailVerifiedAt: new Date() } })
      await review.decide(a.id, adminId, 'move_to_review')
      vi.setSystemTime(new Date('2026-10-28T09:00:00Z'))
      await review.decide(a.id, adminId, 'defer')
    } finally {
      vi.setSystemTime(OCT_20)
    }
    const st = await apps.getPublicStatus(a.email, a.reference)
    expect(st.status).toBe(DEFERRED)
    expect(st.intakeDeferred, 'يُقرأ له «توقفنا» وقد راجعناه').toBe(false)
  })
})

describe('③ والوعدُ يُوفى', () => {
  it('⚠️ في ٢١ ديسمبر يسأله العاملُ عن اهتمامه', async () => {
    const a = await apply('intake-6@test.local', 'لمى عيسى')
    expect((await deferral.askDue(new Date('2026-12-20T23:00:00Z'))).asked, 'سُئل قبل موعده').toBe(0)
    await deferral.askDue(intakeFollowUpAt())
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.deferredInterestAskedAt, 'حلّ ديسمبر ولم يُسأل').not.toBeNull()
  })
})

describe('④ والمفتاحُ يعمل', () => {
  it('⚠️ `TRAINER_INTAKE=open` يعيد الطريقَ العاديّ', async () => {
    process.env.TRAINER_INTAKE = 'open'
    try {
      const a = await apply('intake-open@test.local', 'رنا فارس')
      expect(a.status).toBe('submitted')
      expect(a.deferredFollowUpAt).toBeNull()
    } finally {
      delete process.env.TRAINER_INTAKE
    }
  })

  it('⚠️ ومضيُّ موعد التواصل يُنهي الإغلاق — لا يَعِد بديسمبرَ مضى', async () => {
    vi.setSystemTime(new Date('2026-12-22T09:00:00Z'))
    try {
      const a = await apply('intake-late@test.local', 'جنى حسن')
      expect(a.status).toBe('submitted')
    } finally {
      vi.setSystemTime(OCT_20)
    }
  })
})
