/* «المدربون» لمن وقّع عقدَه واعتمدنا توقيعَه — ومن قبله في «طلبات المدربين» و«العقود» وحدَهما (٢٤ أكتوبر ٢٠٢٦).

   «لماذا يوجد هنا في قسم التشغيل الذين لم أرسل لهم العقد ولم أوقع معهم العقد؟ فلا يجب أن يكونوا هنا. يجب أن
   يكونوا في القسم الآخر. عندما يقوم المدرب بتوقيع عقد هنا يصبح مدربا في قسم التشغيل» (صاحب المنصّة).

   ① القائمةُ: من اعتمدنا توقيعَه (اعتُمد · وُقّع من الطرفين · انتهى عقدُه بعد أن عمل)، ومن عمل بلا عقد (النشطُ
      و«تهيئة»)، ومن أُوقف بعد أن عمل. ولا أحدَ قبل ذلك: لا مقبولٌ داخليّا بلا عقد، ولا من أُرسل إليه أو طلب تعديله —
      ولا من وقّع وينتظر اعتمادَنا، فهو في «العقود» وشارتُها تعدّه، ولا يكون في موضعين.
   ② و«دورات قيد الإعداد» في الشاشة نفسِها بالحدّ نفسِه — وطلبُ تأهيلٍ لشعبةٍ يبقى، فهو قرارُ شعبةٍ لا ملفُّ متقدّم.
   ③ و«اعتمد كلّ الصور المعلّقة» لا يعتمد إلّا ما تعدّه الشاشة: صورَ من في القائمة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

const STAMP = Date.now()
let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let courseId = ''
let cohortId = ''
const ids: Record<string, string> = {}

/** ملفُّ مدرّبٍ بحال طلبه، وعقدٌ إن كان، وأثرُ حالٍ سابقة إن كان */
async function trainer(key: string, status: string, opts: { contract?: string; history?: { from: string | null; to: string }[] } = {}) {
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-OPS-${key}-${STAMP}`, fullName: `مدرب ${key}`, email: `ops-${key}-${STAMP}@test.local`,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
      statusHistory: opts.history ? { create: opts.history.map((h) => ({ fromStatus: h.from, toStatus: h.to })) } : undefined,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, photoPendingKey: `ops-${key}-${STAMP}.jpg` } })
  if (opts.contract) await prisma.trainerContract.create({ data: { profileId: profile.id, title: `عقد ${key}`, status: opts.contract } })
  ids[key] = profile.id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  adminId = (await new AuthService(prisma).register(`ops-admin-${STAMP}@test.local`, 'Admin#12345', 'مدير')).userId
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
  cohortId = (await prisma.cohort.create({ data: { courseId, title: `شعبة ${STAMP}`, status: 'draft', registrationOpen: false } })).id

  /* قبل التوقيع */
  await trainer('accepted', 'conditionally_approved')
  await trainer('sent', 'contract_pending', { contract: 'sent' })
  await trainer('amend', 'contract_pending', { contract: 'amendment_requested' })
  await trainer('declined', 'conditionally_approved', { contract: 'declined' })
  /* موقوفٌ لم يعمل قطّ */
  await trainer('stopped', 'suspended', { history: [{ from: 'conditionally_approved', to: 'suspended' }] })
  /* وقّع وينتظر اعتمادَنا — موضعُه «العقود» */
  await trainer('signed', 'contract_pending', { contract: 'signed' })

  /* بعد اعتماد توقيعه */
  await trainer('approvedSig', 'onboarding', { contract: 'signature_approved' })
  await trainer('sealed', 'active', { contract: 'countersigned' })
  /* ومن عمل بلا عقد: عُيّن مباشرة، أو نشطٌ قبل العقود */
  await trainer('direct', 'active', { history: [{ from: null, to: 'active' }] })
  await trainer('legacy', 'active')
  /* ومن أُوقف بعد أن عمل */
  await trainer('paused', 'suspended', { history: [{ from: 'active', to: 'suspended' }] })

  /* دورةٌ يعدّها كلٌّ من المقبول بلا عقد ومن وقّع — وطلبُ تأهيلٍ لشعبةٍ على المقبول */
  await prisma.trainerCourseQualification.create({ data: { profileId: ids.accepted, courseId, status: 'pending' } })
  await prisma.trainerCourseQualification.create({ data: { profileId: ids.approvedSig, courseId, status: 'pending' } })
  const other = (await prisma.course.findFirstOrThrow({ where: { status: 'published', id: { not: courseId } }, select: { id: true } })).id
  await prisma.trainerCourseQualification.create({
    data: { profileId: ids.accepted, courseId: other, status: 'pending', requestedCohortId: cohortId, requestedBy: adminId, requestedAt: new Date() },
  })
}, 240_000)

describe('① القائمة لمن اعتمدنا توقيعه', () => {
  it('⚠️ لا أحد قبل اعتماد توقيعه — مقبول داخليا، وعقد أرسل أو طلب تعديله أو اعتذر عنه أو وقعه ولم نعتمده، وموقوف لم يعمل', async () => {
    const listed = new Set((await review.listForOps()).map((r) => r.profileId))
    for (const k of ['accepted', 'sent', 'amend', 'declined', 'signed', 'stopped']) {
      expect(listed.has(ids[k]), `${k} في «المدربون» ولم يعتمد توقيعه`).toBe(false)
    }
  })

  it('⚠️ ومن اعتمدنا توقيعه أو عمل فيها — ولو بلا عقد، ولو أوقف بعد أن عمل', async () => {
    const listed = new Set((await review.listForOps()).map((r) => r.profileId))
    for (const k of ['approvedSig', 'sealed', 'direct', 'legacy', 'paused']) {
      expect(listed.has(ids[k]), `${k} غاب عن «المدربون»`).toBe(true)
    }
  })
})

describe('② دورات قيد الإعداد بالحد نفسه', () => {
  it('⚠️ دورة المقبول بلا عقد لا تظهر، ودورة من وقع تظهر — وطلب الشعبة يبقى', async () => {
    const rows = await review.pendingQualifications()
    const of = (k: string, kind: string) => rows.some((r) => r.profileId === ids[k] && r.kind === kind)
    expect(of('accepted', 'preparing'), 'دورة مقبول لم يوقع في التشغيل').toBe(false)
    expect(of('approvedSig', 'preparing')).toBe(true)
    expect(of('accepted', 'request'), 'سقط طلب تأهيل لشعبة').toBe(true)
  })
})

describe('③ اعتماد كل الصور المعلقة', () => {
  it('⚠️ يمس صور من في القائمة وحدهم', async () => {
    await review.approveAllPendingPhotos(adminId)
    const left = new Set((await prisma.trainerProfile.findMany({
      where: { id: { in: Object.values(ids) }, photoPendingKey: { not: null } }, select: { id: true },
    })).map((p) => p.id))
    for (const k of ['accepted', 'sent', 'amend', 'declined', 'signed', 'stopped']) {
      expect(left.has(ids[k]), `اعتمدت صورة ${k} ولم يعتمد توقيعه`).toBe(true)
    }
    for (const k of ['sealed', 'direct']) expect(left.has(ids[k]), `لم تعتمد صورة ${k}`).toBe(false)
  })
})
