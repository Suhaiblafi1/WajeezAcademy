/* البند 21 — بنودٌ خاصّةٌ بمدرّبٍ بعينه، تُحفَظ وتُحمَل. بقاعدةٍ حقيقيّة.

   ═══ ما يحرسه ═══

   ① تُحفَظ في الصفّ وتُطبَع في المتن — سطرا لكلّ بند، بلا علامات القائمة.
   ② وكلُّ مسلكٍ يُعيد تصييرَ المتن من الصفّ يحملها: البديلُ بالاسم المصحَّح،
      وتحديثُ العروض المفتوحة. ومسلكٌ ينساها يمحو بندا مُلزِما وهو يحسب أنّه
      يُحدّث القالب. (والإعادةُ للتوقيع في `contract-resign-terms.test.ts`.)
   ③ والمعاينةُ هي المحفوظُ حرفا بحرف — وكانت تقرأ الأجرَ القائمَ لا المكتوبَ
      في الشاشة، فيرى الموظّفُ رقما ويُطبَع غيرُه.
   ④ والمسارُ يمرّرها — **ويمرّر ما كان يُسقطه**: اسمَ الطرف الثاني المكتوبَ
      في المركِّب، وتاريخَ جلسة التهيئة ورابطَها. كان مخطّطُ المسار لا يعرفها،
      و`z.object` يُسقط ما لا يعرفه بلا خطأ — وكلُّ اختبارٍ قبل هذا كان ينادي
      الخدمةَ مباشرةً فلا يمرّ بالمسار. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { SPECIAL_TERMS_MAX_CHARS, SPECIAL_TERMS_MAX_ITEMS } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''
let adminCookie = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-TERMS-101'
const DOCS = [{ kind: 'national_id', labelAr: 'الهويّة', required: true }]
const TERMS = '- يقدم المدرب دوراته بالإنجليزية عند طلب الأكاديمية\n\n2. وتعقد جلساته مساء الجمعة'
const ITEMS = ['يقدم المدرب دوراته بالإنجليزية عند طلب الأكاديمية', 'وتعقد جلساته مساء الجمعة']

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const password = 'Admin#12345'
  const admin = await auth.register('terms-admin@test.local', password, 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const { token } = await auth.login('terms-admin@test.local', password)
  adminCookie = `${SESSION_COOKIE}=${token}`
  app = await buildApp(prisma)
  await app.ready()
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

let seq = 0

/** مرشّحٌ مقبولٌ مشروطا، بملفٍّ ومؤهّلٍ وأتعاب — جاهزٌ لتركيب عقده */
async function candidate() {
  seq += 1
  const email = `terms-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'سهيب الخوالدة')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-TERMS-${Date.now()}-${seq}`, fullName: 'سهيب الخوالدة', email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  await new EarningsService(prisma).setRule(adminId, {
    profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0,
  })
  return { application, profile, email }
}

const compose = (applicationId: string, extra: Record<string, unknown> = {}) =>
  review.composeContract(applicationId, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية', requiredDocuments: DOCS, ...extra,
  })

describe('① تُحفَظ وتُطبَع', () => {
  it('في الصفّ سطورا نظيفة، وفي المتن البندَ 21 مرقّما', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, { specialTermsAr: TERMS })
    expect(c.specialTermsAr, 'لم تُحفَظ البنودُ في الصفّ').toBe(ITEMS.join('\n'))
    expect(c.bodyAr ?? '').toContain('البند 21 — بنود خاصة بالمدرب')
    expect(c.bodyAr ?? '').toContain(`21-2 ${ITEMS[0]}`)
    expect(c.bodyAr ?? '').toContain(`21-3 ${ITEMS[1]}`)
  })

  it('وبلا بنودٍ لا يُحفَظ نصٌّ فارغ ولا يُطبَع بند', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, { specialTermsAr: '  \n - \n' })
    expect(c.specialTermsAr).toBeNull()
    expect(c.bodyAr ?? '').not.toContain('البند 21 —')
  })

  it('وسقفُها يُقال بالعربيّة — عددا وطولا', async () => {
    const { application } = await candidate()
    const many = Array.from({ length: SPECIAL_TERMS_MAX_ITEMS + 1 }, (_, i) => `بندٌ ${i + 1}`).join('\n')
    await expect(compose(application.id, { specialTermsAr: many }))
      .rejects.toMatchObject({ code: 'special_terms_too_many', status: 422 })
    await expect(compose(application.id, { specialTermsAr: 'ب'.repeat(SPECIAL_TERMS_MAX_CHARS + 1) }))
      .rejects.toMatchObject({ code: 'special_terms_too_long', status: 422 })
  })

  it('والتعبئةُ تملأ الخانةَ من أحدث عقوده — فمن أُلغي عرضُه لا تُكتب بنودُه من جديد', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, { specialTermsAr: TERMS })
    await review.revokeContract(c.id, adminId, 'يُعاد بأتعابٍ أخرى')
    const pre = await review.contractPrefill(application.id)
    expect(pre.lastSpecialTermsAr).toBe(ITEMS.join('\n'))
  })
})

describe('② وكلُّ مسلكٍ يُعيد التصييرَ يحملها', () => {
  it('البديلُ بالاسم المصحَّح', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, { specialTermsAr: TERMS })
    await review.sendContract(c.id, adminId)
    const out = await review.reissueWithCorrectedName(c.id, adminId, { legalNameAr: 'سهيب عبد الله الخوالدة' })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: out.contractId } })
    expect(next.specialTermsAr, 'سقطت البنودُ من صفّ البديل').toBe(ITEMS.join('\n'))
    expect(next.bodyAr ?? '', 'سقط البندُ 21 من متن البديل').toContain(`21-2 ${ITEMS[0]}`)
  })

  it('وتحديثُ العروض المفتوحة إلى القالب الحاضر', async () => {
    const { application } = await candidate()
    const c = await compose(application.id, { specialTermsAr: TERMS })
    await review.sendContract(c.id, adminId)
    /* والقديمُ نصّا لا إصدارا وحدَه — وإلّا تخطّاه المسلكُ بحقّ («نصُّه هو نفسُه») */
    const stale = `${c.bodyAr}\n\nسطرٌ من إصدارٍ قديم.`
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { bodyVersion: 'v1-قديم', bodyAr: stale, bodyHash: sha256(stale) },
    })
    await review.refreshOpenContracts(adminId, { notify: false })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.bodyAr, 'لم يُحدَّث النصّ — فالفحصُ يقيس لا شيء').not.toBe(stale)
    expect(after.bodyAr ?? '', 'محا التحديثُ البندَ 21').toContain(`21-3 ${ITEMS[1]}`)
  })
})

describe('③ والمعاينةُ هي المحفوظُ حرفا بحرف', () => {
  it('بالبنود الخاصّة وبالأجر المكتوب في الشاشة — لا بالقاعدة القائمة', async () => {
    const { application } = await candidate()
    const input = {
      title: 'اتفاقية تقديم خدمات تدريبية', requiredDocuments: DOCS,
      specialTermsAr: TERMS,
      compensation: { type: 'per_seat', rate: 40, minSeats: 0 },
    }
    const shown = await review.previewContract(application.id, input)
    const c = await review.composeContract(application.id, adminId, input)
    expect(String(c.compensationRate), 'لم يُكتب الأجرُ المكتوب — فالمقابلةُ تقيس القاعدةَ القديمة').toBe('40')
    expect(shown, 'رأى الموظّفُ في المعاينة غيرَ ما حُفظ').toBe(c.bodyAr)
  })
})

describe('④ والمسارُ يمرّر ما يكتبه الموظّف', () => {
  it('البنودَ الخاصّة، واسمَ الطرف الثاني، وجلسةَ التهيئة ورابطَها', async () => {
    const { application, profile } = await candidate()
    const at = new Date(Date.now() + 3 * 86_400_000)
    at.setUTCSeconds(0, 0)
    const res = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${application.id}/contracts/compose`,
      headers: { cookie: adminCookie },
      payload: {
        title: 'اتفاقية تقديم خدمات تدريبية', requiredDocuments: DOCS,
        trainerLegalNameAr: 'سهيب عبد الله محمد الخوالدة',
        orientationAt: at.toISOString(), orientationUrl: 'https://meet.example.com/x',
        specialTermsAr: TERMS,
      },
    })
    expect(res.statusCode, `رُدّ التركيبُ عبر المسار: ${res.body}`).toBe(201)
    const id = (res.json() as { id: string }).id
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id } })
    expect(row.specialTermsAr, 'أسقط المسارُ البنودَ الخاصّة').toBe(ITEMS.join('\n'))
    expect(row.bodyAr ?? '', 'أسقط المسارُ الاسمَ المكتوب').toContain('الطرف الثاني: سهيب عبد الله محمد الخوالدة')
    expect(row.orientationAt?.toISOString(), 'أسقط المسارُ تاريخَ الجلسة').toBe(at.toISOString())
    expect(row.orientationUrl, 'أسقط المسارُ رابطَ الجلسة').toBe('https://meet.example.com/x')
    const saved = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(saved.legalNameAr, 'لم يُثبَّت الاسمُ في الملفّ').toBe('سهيب عبد الله محمد الخوالدة')
  })

  it('واسمٌ أقصرُ من أربعة أحرفٍ يُردّ — فلا يُثبَّت في الملفّ اسمٌ من حرفين', async () => {
    const { application } = await candidate()
    await expect(compose(application.id, { trainerLegalNameAr: 'سه' }))
      .rejects.toMatchObject({ code: 'no_name', status: 422 })
  })
})
