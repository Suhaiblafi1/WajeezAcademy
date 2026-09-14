/* ملفُّ شعبةٍ — من يرفع ومن يقرأ (ع-٢ · د-٣).

   ═══ وأثقلُ ما هنا القراءة ═══

   التخزينُ خاصّ. فلو قُرئ بمفتاحه وحدَه لصار كلُّ من نال مفتاحا — من سجلٍّ
   أو من شاشةٍ أو من زميلٍ — يقرأ محتوى شعبةٍ لم يشترِها. والحارسُ التحاقُه.

   ومن لا يملكه يُردّ **بأربعمئةٍ وأربعة** لا بثلاثمئةٍ وثلاثة: «ممنوع» تُثبت
   أنّ ثمّة ملفّا هناك، و«غيرُ موجود» لا تقول شيئا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortFileService } from '../../services/cohort-file.service'
import { resolveStorageOwner } from '../../services/storage.service'
import { MAX_BODY_FILE_BYTES } from '../../../src/application/trainer/module-body'

const PDF = 'application/pdf'

let prisma: PrismaClient
let bodies: CohortFileService
let cohortId: string
let trainerUserId: string
let learnerId: string
let strangerId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  bodies = new CohortFileService(prisma)
  const auth = new AuthService(prisma)
  process.env.FILE_UPLOADS = 'on'

  const t = await auth.register('mb-trainer@test.local', 'Trainer#12345', 'مدرّبُ الشعبة')
  const l = await auth.register('mb-learner@test.local', 'Learner#12345', 'متعلّمٌ ملتحق')
  const s = await auth.register('mb-stranger@test.local', 'Learner#12345', 'غريبٌ عن الشعبة')
  trainerUserId = t.userId; learnerId = l.userId; strangerId = s.userId

  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: { courseId: course.id, title: 'شعبةُ ملفِّ المتن', status: 'active', capacity: 20 },
  })
  cohortId = cohort.id

  /* المدرّبُ يُربط بملفِّ تقدُّمٍ معلَّقٍ بحسابه — فالخدمةُ تسأل عنه بهذا */
  const app = await prisma.trainerApplication.create({
    data: {
      reference: 'WJ-TR-MB-1', email: 'mb-trainer@test.local', fullName: 'مدرّبُ الشعبة',
      phoneCountryCode: '+962', phone: '779000111', country: 'الأردن', status: 'approved',
    },
  })
  /* والرابطُ عمودُ `userId` على الملفّ — هو ما تقرؤه المنصّةُ كلُّها
     (`ownedCohort`). وكان الحارسُ يربطه بـ`application.userId` وحدَه فمرّ
     على وصلٍ خاطئ. */
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: app.id, userId: trainerUserId },
  })
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })
  await prisma.enrollment.create({ data: { cohortId, userId: learnerId, status: 'enrolled' } })
}, 180_000)

describe('ع-٢ · من يرفع', () => {
  it('مدرّبُ الشعبة يرفع — ويُنشأ الصفُّ قبل الرابط ليعرفه المخزن', async () => {
    const r = await bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M1', {
      mime: PDF, originalName: 'النظريّة.pdf',
    })
    expect(r.uploadUrl).toContain('/api/v1/uploads/')
    expect(r.maxBytes).toBe(MAX_BODY_FILE_BYTES)

    /* ولولا الصفُّ لَرُدّ الرفعُ: مفتاحٌ لا يعرفه أحدٌ لا سقفَ له */
    const owner = await resolveStorageOwner(prisma, r.storageKey)
    expect(owner, 'المخزنُ لا يعرف مفتاحَ ملفِّ المتن — فيُردّ رفعُه').toBeTruthy()
    expect(owner!.kind).toBe('cohort_file')
    expect(owner!.maxBytes).toBe(MAX_BODY_FILE_BYTES)
  })

  it('ولا يرفع من ليس مدرّبَها', async () => {
    await expect(
      bodies.startUpload(strangerId, cohortId, 'module_body', 'M2', { mime: PDF, originalName: 'x.pdf' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('ولا تُقبل صيغةٌ ليست متنا — والصورةُ بابُها «المصادر»', async () => {
    await expect(
      bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M3', { mime: 'image/png', originalName: 'a.png' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('ع-٢ · ومن يقرأ', () => {
  let key = ''
  beforeAll(async () => {
    const r = await bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M9', {
      mime: PDF, originalName: 'درسٌ.pdf',
    })
    key = r.storageKey
  })

  it('من التحق بالشعبة يقرأ', async () => {
    const row = await bodies.assertCanRead(key, { userId: learnerId, permissions: [] })
    expect(row.mime).toBe(PDF)
  })

  it('ومدرّبُها يقرأ', async () => {
    await expect(
      bodies.assertCanRead(key, { userId: trainerUserId, permissions: [] }),
    ).resolves.toBeTruthy()
  })

  it('ومن يعتمد الخطّةَ يقرأ — وإلّا اعتُمدت وثيقةٌ لم يفتحها أحد', async () => {
    await expect(
      bodies.assertCanRead(key, { userId: strangerId, permissions: ['cohort.plan.approve'] }),
    ).resolves.toBeTruthy()
  })

  it('والغريبُ يُردّ — بـ٤٠٤ لا ٤٠٣: وجودُ الملفّ خبرٌ لا يُعطاه', async () => {
    await expect(
      bodies.assertCanRead(key, { userId: strangerId, permissions: [] }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('ع-٢ · والحذف', () => {
  it('يُفكّ الملفُّ ويُمحى صفُّه — فلا يبقى في المخزن ما لا يُشار إليه', async () => {
    const r = await bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M7', {
      mime: PDF, originalName: 'قديم.pdf',
    })
    await bodies.detach(trainerUserId, cohortId, r.storageKey)
    const row = await prisma.cohortFile.findUnique({ where: { storageKey: r.storageKey } })
    expect(row, 'الصفُّ باقٍ بعد الحذف').toBeNull()
    await expect(
      bodies.assertCanRead(r.storageKey, { userId: learnerId, permissions: [] }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('ولا يحذف من ليس مدرّبَها', async () => {
    const r = await bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M8', {
      mime: PDF, originalName: 'محميّ.pdf',
    })
    await expect(bodies.detach(strangerId, cohortId, r.storageKey)).rejects.toMatchObject({ status: 403 })
  })
})

/* ═══ د-٣ · والغرضان يتقاسمان الحارسَ ويفترقان في المقبول ═══

   وهذا سببُ الجدول الواحد: قاعدةُ الوصول واحدةٌ، ونسخُها في موضعَين أخطرُ
   من سطرٍ مكرَّر — تُشدَّد في أحدهما وتُنسى في الآخر. */
describe('د-٣ · ملفُّ المصدر', () => {
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  let key = ''

  it('يُقبل ما لا يُقبل متنا — شرائحُ مصدرٌ لا درس', async () => {
    const r = await bodies.startUpload(trainerUserId, cohortId, 'plan_resource', 'r0', {
      mime: PPTX, originalName: 'عرض.pptx',
    })
    key = r.storageKey
    expect(r.storageKey).toBeTruthy()

    await expect(
      bodies.startUpload(trainerUserId, cohortId, 'module_body', 'M5', {
        mime: PPTX, originalName: 'عرض.pptx',
      }),
      'شريحةٌ مرّت متنا',
    ).rejects.toMatchObject({ status: 422 })
  })

  it('وحارسُ القراءة هو هو — لا قاعدةٌ ثانيةٌ للمصادر', async () => {
    await expect(
      bodies.assertCanRead(key, { userId: learnerId, permissions: [] }),
    ).resolves.toBeTruthy()
    await expect(
      bodies.assertCanRead(key, { userId: strangerId, permissions: [] }),
      'الغريبُ يقرأ ملفَّ مصدرٍ وإن رُدّ عن متنٍ — قاعدتان',
    ).rejects.toMatchObject({ status: 404 })
  })

  it('ولا يرفع مصدرا من ليس مدرّبَها', async () => {
    await expect(
      bodies.startUpload(strangerId, cohortId, 'plan_resource', 'r1', {
        mime: PPTX, originalName: 'x.pptx',
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
