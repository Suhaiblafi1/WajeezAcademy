/* عرضُ الدورة على المدرّب يصل بريدا مع الجرس (٨ نوفمبر ٢٠٢٦) — قرارُ صاحب المنصّة «A». والعلّةُ في `TrainerOfferService`.

   العرضُ له مهلةُ ردٍّ ثمّ يُغلق وحدَه، وكان يصل جرسا وحدَه: فمن لم يدخل في أسبوعه لا يعلم أنّه عُرض عليه ولا أنّه انقضى.
   فالعرضُ وسحبُه وانقضاؤه تصل بريدا أيضا — صفُّ بريدٍ بجانب صفّ الجرس، بجمهور المدرّب. والإعدادُ من
   `offer-and-countersign.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let offers: TrainerOfferService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'
const DAY = 86_400_000
const COURSE = 'C-OFM-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  offers = new TrainerOfferService(prisma)

  const admin = await auth.register('ofm-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  for (const [id, t] of [[COURSE, 'دورةُ العرض']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

let seq = 0

/** مرشّحٌ له حسابٌ وملفٌّ وعقدٌ موقَّع — الحالُ التي ينطلق منها الاعتماد.

    والحسابُ يُنشأ ويُربط بالطلب كما يقع في الواقع: المتقدّمُ يسجّل ثمّ
    يتقدّم، و`decide('activate')` تربط حسابَه بالملفّ وتمنحه الدور. */
async function mkSigned(opts: { status?: string; gatesActivation?: boolean; withUser?: boolean } = {}) {
  seq += 1
  const status = opts.status ?? 'contract_pending'
  const email = `ofm-${seq}-${Date.now()}@test.local`
  const user = opts.withUser === false ? null : await auth.register(email, 'Pass#12345', `مرشّحٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-OFM-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user?.userId ?? null,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
      signerEmail: email, signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(),
      gatesActivation: opts.gatesActivation ?? (status !== 'active'),
    },
  })
  return { app, profile, contract, userId: user?.userId ?? null, email }
}

/** مدرّبٌ نشطٌ مؤهَّلٌ لدورةٍ — نقطةُ انطلاق العروض */
async function mkActiveTrainer(courseIds: string[] = [COURSE]) {
  const made = await mkSigned()
  for (const courseId of courseIds) {
    await prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId: made.profile.id, courseId } },
      update: { status: 'qualified' },
      create: { profileId: made.profile.id, courseId, status: 'qualified' },
    })
  }
  /* ═══ والختمُ في لحظة التفعيل منذ ٢٣ سبتمبر ٢٠٢٦ (§٨-٧) ═══

     كان السطرُ `countersignContract` هنا يسبق الاعتماد. وصار العرضُ المشروطُ
     يُختَم **في `decide('approve')` نفسِها**: توقيعُنا في آخر الطور لا في
     أوّله، فما بين توقيعه واعتمادِنا لا وثيقةَ نافذةً على أحد. وزرُّ
     الاعتماد في شاشة العقود يمرّ من `decide('activate')` نفسِها منذ ٢٦
     سبتمبر ٢٠٢٦ — فالمسلكُ واحدٌ وإن تعدّد بابُه، وناقصُ التجهيز يُردّ من
     كليهما (أوّلُ describe في هذا الملفّ).

     والعرضُ لا يُقدَّم إلّا على مدرّبٍ نشطٍ يفتح بوّابتَه ليراه. */
  await makeReadyForApproval(prisma, made.app.id, adminId)
  await review.decide(made.app.id, adminId, 'approve')
  return made
}

const rows = (userId: string, templateKey: string) =>
  prisma.notification.findMany({ where: { userId, templateKey }, select: { channel: true, audience: true }, orderBy: { channel: 'asc' } })

describe('عرض الدورة يصل بريدا مع الجرس', () => {
  it('⚠️ العرض: جرس وبريد للمدرب', async () => {
    const t = await mkActiveTrainer()
    await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    expect(await rows(t.userId!, 'trainer.offer.received'), 'وصل العرض جرسا وحده').toEqual([
      { channel: 'email', audience: 'trainer' }, { channel: 'in_app', audience: 'trainer' },
    ])
  })

  it('⚠️ وسحبه وانقضاؤه كذلك', async () => {
    const a = await mkActiveTrainer()
    const o1 = await offers.offer({ profileId: a.profile.id, courseId: COURSE }, adminId)
    await offers.withdraw(o1.id, adminId, 'تغيرت خطة الفصل')
    expect((await rows(a.userId!, 'trainer.offer.withdrawn')).map((r) => r.channel)).toEqual(['email', 'in_app'])

    const b = await mkActiveTrainer()
    const o2 = await offers.offer({ profileId: b.profile.id, courseId: COURSE }, adminId)
    await prisma.trainerAssignmentOffer.update({ where: { id: o2.id }, data: { expiresAt: new Date(Date.now() - DAY) } })
    await offers.lapseExpiredOffers()
    expect((await rows(b.userId!, 'trainer.offer.lapsed')).map((r) => r.channel)).toEqual(['email', 'in_app'])
  })
})
