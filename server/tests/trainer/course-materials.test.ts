/* موادُّ الدورات في طور العرض المشروط — بقاعدةٍ حقيقيّة.

   ═══ ما يُحرَس ═══

   ① **لها موضع**: من اعتُمد توقيعُه يرى دوراته قيد الإعداد بمحاور كتالوجها،
      ويكتب موادَّها ويحفظها — وهو ما يَعِد به البندُ 2-8 ولم يكن له مكان.
   ② **والمحفوظُ ما نُظّف**: رابطٌ لا يبدأ بـhttps:// لا يُحفظ، والمحورُ بلا
      عنوانٍ يسقط، وما ينقص يُقال.
   ③ **ولا يُعلَن اكتمالُ ما لم يُكتب**: «أعلنتُ اكتمالها» يُردّ ودورةٌ قيد
      الإعداد ناقصة، ويُسمّيها — ويُقبل حين تكتمل.
   ④ **وما عند التقييم لا يُعدَّل**، ولا يكتب أحدٌ موادَّ دورةٍ ليست له. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerMaterialsService } from '../../services/trainer-materials.service'
import { contractAcks } from '../../../src/application/trainer/contract-body'
import { missingAcademyLegalFields } from '../../../src/data/academy-legal'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let materials: TrainerMaterialsService
let academicId = ''
const COURSE = 'C-MAT-101'
const COURSE_B = 'C-MAT-102'
const DOCS = [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }]
let seq = 0

/** مرشّحٌ اعتُمد توقيعُه — في طور الموادّ ومهلتُه تجري */
async function countersigned() {
  seq += 1
  const email = `mat-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MAT-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'academic_review', motivation: 'اختبار', privacyConsentAt: new Date(),
      teachableCourseIds: [COURSE], userId: user.userId,
    },
  })
  await review.decide(app.id, academicId, 'conditionally_approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  const made = await review.composeContract(app.id, academicId, { title: 'عرضٌ مشروط', requiredDocuments: DOCS })
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
  const sent = await review.sendContract(made.id, academicId)
  await prisma.trainerContractDocument.create({
    data: { contractId: made.id, kind: 'national_id', storageKey: `mat-${made.id}`, originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024 },
  })
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: 'الاسمُ القانونيّ', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
    bodyHash: sha256(row.bodyAr!), acks: contractAcks(true).map((a) => a.key),
  })
  await review.approveSignature(made.id, academicId)
  return { userId: user.userId, profileId: profile.id }
}

const FULL = {
  modules: [{ titleAr: 'المحورُ الأوّل', outcomeAr: 'يكتب خلاصةً في جملة' }],
  materialsUrl: 'https://drive.example.com/folder',
  taskAr: 'مذكّرةُ تحضير', sourcesAr: 'كتابٌ واحد', noteAr: '',
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  materials = new TrainerMaterialsService(prisma)
  const academic = await auth.register('mat-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])
  for (const [id, title] of [[COURSE, 'دورةُ الموادّ'], [COURSE_B, 'دورةٌ ثانية']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: title, totalHours: 10 } })
  }
  const mod = await prisma.courseModule.create({ data: { id: `${COURSE}-M1`, courseId: COURSE, status: 'published' } })
  await prisma.courseModuleVersion.create({
    data: { moduleId: mod.id, version: 1, sequence: 1, titleAr: 'محورُ الكتالوج', outcomeAr: 'مخرجُ الكتالوج', hours: 2 },
  })
}, 240_000)

describe('① لها موضعٌ في البوّابة', () => {
  it('دوراتُه قيد الإعداد تُعرض بمحاور كتالوجها', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    const out = await materials.mine(t.userId)
    const row = out.courses.find((c) => c.courseId === COURSE)
    expect(row, 'دورةُ طلبه لا تظهر في لوح الموادّ').toBeTruthy()
    expect(row!.status).toBe('pending')
    expect(row!.catalogModules[0], 'المحاورُ لا تبدأ من الكتالوج').toEqual({ titleAr: 'محورُ الكتالوج', outcomeAr: 'مخرجُ الكتالوج' })
    expect(row!.materials).toBeNull()
    expect(row!.missingAr.length).toBeGreaterThan(0)
    expect(out.underReview).toBe(false)
  })
})

describe('② المحفوظُ ما نُظّف', () => {
  it('الرابطُ غيرُ الآمن لا يُحفظ، والمحورُ بلا عنوانٍ يسقط، والناقصُ يُسمّى', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    const res = await materials.save(t.userId, COURSE, {
      ...FULL, materialsUrl: 'http://insecure.example.com', modules: [...FULL.modules, { titleAr: '   ', outcomeAr: 'x' }],
    })
    expect(res.missingAr).toContain('رابطُ الموادّ (الكرّاسات والعروض)')
    const q = await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, courseId: COURSE } })
    const saved = q.materials as { materialsUrl: string | null; modules: unknown[] }
    expect(saved.materialsUrl).toBeNull()
    expect(saved.modules).toHaveLength(1)
  })
})

describe('③ لا يُعلَن اكتمالُ ما لم يُكتب', () => {
  it('يُردّ الإعلانُ ودورةٌ ناقصة — ويسمّيها', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    await expect(review.declareMaterialsComplete(t.userId)).rejects.toThrow(/دورةُ الموادّ/)
    const c = await prisma.trainerContract.findFirstOrThrow({ where: { profileId: t.profileId } })
    expect(c.conditionPausedAt, 'جُمّدت المهلةُ على إعلانٍ مردود').toBeNull()
  })

  it('ويُقبل حين تكتمل', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    await materials.save(t.userId, COURSE, FULL)
    const out = await review.declareMaterialsComplete(t.userId)
    expect(out.pausedAt).toBeInstanceOf(Date)
  })
})

describe('④ ما عند التقييم لا يُعدَّل، ولا يكتب أحدٌ لغيره', () => {
  it('بعد الإعلان يُردّ الحفظ', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    await materials.save(t.userId, COURSE, FULL)
    await review.declareMaterialsComplete(t.userId)
    await expect(materials.save(t.userId, COURSE, FULL)).rejects.toThrow(/للتقييم/)
    expect((await materials.mine(t.userId)).underReview).toBe(true)
  })

  it('ودورةٌ ليست من دوراته تُردّ', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    await expect(materials.save(t.userId, COURSE_B, FULL)).rejects.toThrow(/ليست من دوراتك/)
  })

  it('وما اعتُمدت موادُّه يُقرأ ولا يُعدَّل هنا', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const t = await countersigned()
    await review.qualifyForCourse(t.profileId, COURSE, academicId)
    await expect(materials.save(t.userId, COURSE, FULL)).rejects.toThrow(/اعتُمدت موادُّ/)
  })
})
