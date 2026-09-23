/* المرحلةُ الخامسة — نهايةُ العقد ومصيرُ أثره.

   ═══ وأربعةُ أعطابٍ تقع صامتةً ولا يشتكي منها أحد ═══

   ① **أثرُ العقد يُقلَّم بعد سنتين في دورةِ عاملٍ ليلا.** لا شاشةَ تُنبِّه،
      ولا رسالةَ تُكتب — ويُكتشف يومَ يُسأل عن توقيعٍ عمرُه ثلاث سنوات فلا
      يُوجَد. ومُدَدُ التقادم العقديّة تتجاوز السنتين بكثير.
   ② **ومن وقّع ثمّ انسحب يصير `withdrawn`**، وهي حالةٌ يجوز محوُها —
      فيُمحى عقدُه النافذُ معه بضغطة، وفيه توقيعُه هو لا سجلُّنا وحدَه.
   ③ **ومن رحل يبقى عقدُه نافذا عليه**: تقريرُ «بلا عقد» يقول إنّه مغطّى،
      وحارسُ المحو يحبس ملفَّه أبدا، والملحقُ (أ) يعدّد دوراتٍ لا يدرّسها.
   ④ **وعرضٌ مفتوحٌ ينتظر جوابَ من رحل** بابٌ يُفتح على إسنادٍ لا يقع.

   والفحصُ على **الأثر في القاعدة** لا على ورودِ نصٍّ في ملفّ: تُشاخ الصفوفُ
   بتواريخَ حقيقيّة، ويُشغَّل التقليمُ فعلا، ويُقاس من بقي ومن ذهب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { enforceRetention, RETENTION_DAYS } from '../../worker/jobs'
import { isPermanentAuditAction, PERMANENT_AUDIT_PREFIXES } from '../../../src/application/audit/retention'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let offers: TrainerOfferService
let apps: TrainerApplicationService
let departures: TrainerDepartureService
let adminId = ''

const DAY = 86_400_000
const COURSE = 'C-P5-101'
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  offers = new TrainerOfferService(prisma)
  apps = new TrainerApplicationService(prisma)
  departures = new TrainerDepartureService(prisma)

  const admin = await auth.register('p5-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورةُ المرحلة الخامسة', totalHours: 10 } })
}, 240_000)

let seq = 0

/** مدرّبٌ نشطٌ بعقدٍ نافذٍ معتمَد — الحالُ التي تُقاس منها كلُّ نهاية */
async function mkContracted(opts: { qualify?: boolean } = {}) {
  seq += 1
  const email = `p5-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-P5-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةٌ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, signerEmail: email,
      signerLegalName: `الاسمُ القانونيُّ ${seq}`, signedAt: new Date(),
      gatesActivation: true,
    },
  })
  /* والعرضُ المشروطُ يُختَم في لحظة التفعيل نفسِها منذ ٢٣ سبتمبر ٢٠٢٦
     (§٨-٧)، فلا ختمَ بيدٍ قبله — ويُتمّ الطريقُ صراحةً */
  await makeReadyForApproval(prisma, app.id, adminId)
  await review.decide(app.id, adminId, 'approve')
  if (opts.qualify !== false) {
    await prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId: profile.id, courseId: COURSE } },
      update: { status: 'qualified' },
      create: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
    })
  }
  return { app, profile, contract, userId: user.userId }
}

/* ═══════════ ① أثرُ العقد لا يُقلَّم ═══════════ */

describe('أثرُ العقود والعروض يبقى بعد التقادم', () => {
  /** صفُّ أثرٍ مشيَّخٌ بتاريخٍ حقيقيّ — و`recordAudit` تختم الآنَ دائما فلا تصلح */
  async function agedAudit(action: string, days: number) {
    return prisma.auditEvent.create({
      data: {
        action, entityType: 'trainer_contract', entityId: `p5-${action}-${days}-${seq += 1}`,
        createdAt: new Date(Date.now() - days * DAY),
      },
    })
  }

  it('⚠️ يُقلَّم الأثرُ العاديُّ ويبقى أثرُ العقد — في الدورة نفسِها', async () => {
    const old = RETENTION_DAYS.audit + 100
    const contractRow = await agedAudit('trainer.contract.countersign', old)
    const offerRow = await agedAudit('trainer.offer.accept', old)
    /* ═══ والشاهدُ أثرٌ مثلُه لا صفٌّ من جدولٍ آخر ═══

       لو كان الشاهدُ «محاولةَ دخولٍ» لَمرّ الحارسُ ولو حُذف تقليمُ الأثر
       كلُّه: تلك تُقلَّم في نداءٍ آخر. فالشاهدُ من الجدول نفسِه وبالعمر
       نفسِه — فلا يفرّق بينهما إلّا الاستثناءُ المقيس. */
    const controlRow = await agedAudit('trainer.qualify', old)

    await enforceRetention(prisma)

    expect(
      await prisma.auditEvent.findUnique({ where: { id: contractRow.id } }),
      'قُلِّم أثرُ عقدٍ — وهو دليلٌ في نزاعٍ قد يقع بعد سنتين',
    ).toBeTruthy()
    expect(
      await prisma.auditEvent.findUnique({ where: { id: offerRow.id } }),
      'قُلِّم أثرُ عرضٍ — وقبولُه التزامٌ بوقتٍ ومال',
    ).toBeTruthy()
    expect(
      await prisma.auditEvent.findUnique({ where: { id: controlRow.id } }),
      'لم يُقلَّم الشاهدُ — فالتقليمُ نفسُه معطَّلٌ ولا شيءَ يُقاس',
    ).toBeNull()
  })

  it('وما لم يبلغِ المدّةَ يبقى على كلّ حال', async () => {
    const fresh = await agedAudit('trainer.qualify', 10)
    await enforceRetention(prisma)
    expect(await prisma.auditEvent.findUnique({ where: { id: fresh.id } })).toBeTruthy()
  })

  it('والعائلةُ بالبادئة تشمل ما يُضاف بعدُ — لا قائمةً تُعَدّ', () => {
    expect(isPermanentAuditAction('trainer.contract.a_new_act_added_next_year')).toBe(true)
    expect(isPermanentAuditAction('trainer.offer.anything')).toBe(true)
    expect(isPermanentAuditAction('trainer.qualify')).toBe(false)
    expect(isPermanentAuditAction('cohort.trainer.assign')).toBe(false)
    expect(PERMANENT_AUDIT_PREFIXES.every((p) => p.endsWith('.')), 'بادئةٌ بلا نقطةٍ تبتلع أفعالا تشبه اسمَها').toBe(true)
  })
})

/* ═══════════ ② لا يُمحى من له عقدٌ نافذ ═══════════ */

describe('مانعُ المحو — والعقدُ وثيقةُ الطرف الآخر', () => {
  it('⚠️ من وقّع ثمّ انسحب لا يُمحى طلبُه', async () => {
    const t = await mkContracted()
    /* والانسحابُ هو المنفذُ بعينه: `withdrawn` في `PURGEABLE_STATUSES` */
    await prisma.trainerApplication.update({ where: { id: t.app.id }, data: { status: 'withdrawn' } })
    await expect(
      apps.purge(t.app.reference, adminId, 'حذفُ اختبارٍ من قاعدة الإنتاج'),
    ).rejects.toThrow(/عقد/)
    expect(
      await prisma.trainerApplication.findUnique({ where: { id: t.app.id } }),
      'مُحي طلبُ من وقّع عقدا نافذا',
    ).toBeTruthy()
    expect(await prisma.trainerContract.count({ where: { profileId: t.profile.id } })).toBe(1)
  })

  it('ومن لا عقدَ نافذَ له يُمحى كما كان — فالحارسُ لا يوسّع نفسَه', async () => {
    seq += 1
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-P5N-${Date.now()}-${seq}`, fullName: `مرفوضٌ ${seq}`,
        email: `p5n-${seq}-${Date.now()}@test.local`,
        status: 'rejected', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    await apps.purge(app.reference, adminId, 'حذفُ اختبارٍ من قاعدة الإنتاج')
    expect(await prisma.trainerApplication.findUnique({ where: { id: app.id } })).toBeNull()
  })

  it('⚠️ وبعد الفسخ يُمحى — والأثرُ الدائمُ يبقى شاهدا بعد أن يذهب الصفّ', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    await prisma.trainerApplication.update({ where: { id: t.app.id }, data: { status: 'withdrawn' } })
    await apps.purge(t.app.reference, adminId, 'حذفُ اختبارٍ من قاعدة الإنتاج')
    expect(await prisma.trainerApplication.findUnique({ where: { id: t.app.id } })).toBeNull()
    /* وهذا هو التعاشقُ بين الحارسَين: الصفُّ يذهب، والأثرُ الذي لا يُقلَّم
       يبقى يقول إنّ عقدا وُقّع واعتُمد وفُسخ — فلا يضيع الدليلُ بالمحو. */
    const trail = await prisma.auditEvent.count({
      where: { action: { startsWith: 'trainer.contract.' }, entityId: t.contract.id },
    })
    expect(trail, 'ذهب أثرُ العقد مع الصفّ').toBeGreaterThan(0)
  })
})

/* ═══════════ ③ الرحيلُ يفسخ ═══════════ */

describe('الرحيلُ يفسخ العقدَ ويسحب العروض', () => {
  it('⚠️ العقدُ النافذُ يصير مفسوخا — في المعاملة نفسِها', async () => {
    const t = await mkContracted()
    const r = await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    expect(r.terminatedContracts).toBe(1)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    expect(after.status).toBe('terminated')
    expect(after.terminatedAt).toBeTruthy()
    expect(after.terminatedBy).toBe(adminId)
    expect(after.terminateReasonAr).toContain('انتقل إلى جهةٍ أخرى')
  })

  it('⚠️ ولا يُمحى دليلُه — التوقيعُ والاسمُ والاعتمادُ تبقى', async () => {
    const t = await mkContracted()
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    expect(after.signedAt?.getTime()).toBe(before.signedAt?.getTime())
    expect(after.signerLegalName).toBe(before.signerLegalName)
    expect(after.countersignedAt?.getTime()).toBe(before.countersignedAt?.getTime())
    expect(after.academySignatoryName).toBe(before.academySignatoryName)
  })

  it('⚠️ والعروضُ المفتوحةُ تُسحب، ولكلٍّ أثرُه باسمه', async () => {
    const t = await mkContracted()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    const r = await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    expect(r.withdrawnOffers).toBe(1)
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status).toBe('withdrawn')
    expect(after.withdrawReasonAr).toContain('رحيل')
    /* والأثرُ بالفعل نفسِه الذي تكتبه خدمةُ العروض — فخطُّ الزمن لا يفرّق */
    const trail = await prisma.auditEvent.findMany({
      where: { action: 'trainer.offer.withdraw', entityId: t.profile.id },
    })
    expect(trail.length, 'سُحب عرضٌ بلا أثرٍ باسمه — فيختفي من خطّ زمنه').toBe(1)
    expect((trail[0].meta as Record<string, unknown>).offerId).toBe(o.id)
  })

  it('وما قُبِل لا يُسحب — فالمقبولُ إسنادٌ قائمٌ لا عرضٌ معلَّق', async () => {
    const t = await mkContracted()
    const o = await offers.offer({ profileId: t.profile.id, courseId: COURSE }, adminId)
    await offers.accept(o.id, t.userId)
    const r = await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    expect(r.withdrawnOffers).toBe(0)
    const after = await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })
    expect(after.status).toBe('accepted')
  })

  it('ورحيلٌ ثانٍ لا يكتب فسخا ثانيا — ولا يُبدَّل فاعلُ الأوّل', async () => {
    const t = await mkContracted()
    await departures.open(adminId, t.profile.id, 'انتقل إلى جهةٍ أخرى')
    const first = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    const again = await departures.open(adminId, t.profile.id, 'ملفٌّ ثانٍ بالخطإ')
    expect(again.terminatedContracts).toBe(0)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    expect(after.terminatedAt?.getTime()).toBe(first.terminatedAt?.getTime())
    expect(after.terminateReasonAr).toBe(first.terminateReasonAr)
  })
})

/* ═══════════ ④ تقريرُ «بلا عقد» ═══════════ */

describe('تقريرُ من يعمل بلا عقدٍ نافذ', () => {
  it('⚠️ من عقدُه نافذٌ لا يظهر، ومن فُسخ عقدُه يظهر بحاله', async () => {
    const { ReportsService } = await import('../../services/reports.service')
    const reports = new ReportsService(prisma)

    const covered = await mkContracted()
    const departed = await mkContracted()
    await departures.open(adminId, departed.profile.id, 'انتقل إلى جهةٍ أخرى')
    /* والرحيلُ لا يغيّر حالةَ الطلب، فيبقى `active` — وهو بيتُ الداء:
       نشطٌ في الشاشة، وبلا عقدٍ نافذٍ في الحقيقة. */

    const { rows } = await reports.run('trainers-without-contract', {})
    const refs = rows.map((r) => r.reference)
    expect(refs, 'ظهر من عقدُه نافذ').not.toContain(covered.app.reference)
    expect(refs, 'غاب من فُسخ عقدُه').toContain(departed.app.reference)
    const row = rows.find((r) => r.reference === departed.app.reference)!
    expect(String(row.state)).toContain('فُسخ')
    expect(String(row.nextStepAr).length, 'حالٌ بلا خطوةٍ تالية يُقرأ ويُترك').toBeGreaterThan(5)
  })

  it('ومن لا عقدَ له قطّ يُميَّز — فسبقُه المرحلةَ ليس مخالفة', async () => {
    const { ReportsService } = await import('../../services/reports.service')
    const reports = new ReportsService(prisma)
    seq += 1
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-P5OLD-${Date.now()}-${seq}`, fullName: `قديمٌ ${seq}`,
        email: `p5old-${seq}-${Date.now()}@test.local`,
        status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    await prisma.trainerProfile.create({ data: { applicationId: app.id } })

    const { rows } = await reports.run('trainers-without-contract', {})
    const row = rows.find((r) => r.reference === app.reference)
    expect(row, 'غاب من هو نشطٌ بلا عقدٍ قطّ').toBeTruthy()
    expect(String(row!.state)).toContain('لا عقدَ قطّ')
  })
})
