/* صورةُ المدرّب — عمودٌ كان لا يكتبه شيء، ومسارٌ عامٌّ يحرسه النشرُ لا التوقيع.

   ═══ العطبُ الذي كُتب له ═══

   `TrainerProfile.photoUrl` موجودٌ في المخطَّط منذ أوّله، ويخرج إلى صفحة
   الفريق وإلى بطاقة الدورة — **ولا سطرَ في الشيفرة كلِّها يكتبه**. فصفحةُ
   الفريق تعرض أحرفَ الاسم أبدا، ولا سبيلَ إلى صورةٍ إلّا بيدٍ في القاعدة.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): تُرفع الصورة، وأمرُ التخزين بيده —
   «اجعل الموقعَ مستعدّا لهذا فورا».

   ═══ وما يُحرَس هنا ═══

   ١) **الحارسُ النشرُ لا التوقيع.** الصورةُ `<img src>` في صفحةٍ عامّة، فلا
      تصلح لرابطٍ ينتهي بعد عشر دقائق. فبديلُه أنّ المسارَ لا يقدّم صورةً
      إلّا لملفٍّ يجتاز `PUBLIC_TRAINER_WHERE` بعينها. ولو سقط هذا لَظهرت
      صورةُ من لم يُعتمد نشرُه — وهو ما تمنعه قاعدةُ المستودع نصّا.
   ٢) **وإيقافُ المدرّبِ يُخفي صورتَه في اللحظة نفسِها** التي يُخفي اسمَه.
   ٣) والعمودُ لا يقبل إلّا `https://` أو مفتاحَ مخزنٍ أصدرناه — فما يخرج إلى
      `src` في صفحةٍ عامّةٍ لا يكون `javascript:`.
   ٤) والرفعُ مطفأٌ حتّى يُشعله قرارُ تشغيل، ويقول البديلَ حين يُردّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { putObject } from '../../services/object-store'
import { PHOTO_KEY_PREFIX, photoPublicUrl, photoStorageKey } from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance
let review: TrainerReviewService
let profileId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const KEY = 'photo-key-for-the-test-0001'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  review = new TrainerReviewService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, {
    fullName: 'مدرّبةُ الصورة', email: 'photo-trainer@test.local',
  })
  profileId = made.profileId
  /* بايتاتٌ حقيقيّةٌ على القرص — فالمسارُ يُقاس وهو يقدّم لا وهو يردّ ٤٠٤ */
  await putObject(KEY, Buffer.from('\x89PNG\r\n\x1a\n'), { mime: 'image/png', originalName: 'p.png' })
  await prisma.trainerProfile.update({
    where: { id: profileId }, data: { photoUrl: `${PHOTO_KEY_PREFIX}${KEY}` },
  })
}, 240_000)

const get = () => app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${KEY}` })

describe('المفتاحُ والعنوان', () => {
  it('البادئةُ تفرّق المخزَّنَ عن الرابط الخارجيّ', () => {
    expect(photoStorageKey(`${PHOTO_KEY_PREFIX}abc`)).toBe('abc')
    expect(photoStorageKey('https://cdn.example.com/a.png')).toBeNull()
    expect(photoStorageKey(null)).toBeNull()
  })

  it('والخارجُ عنوانٌ يفتح لا مفتاحٌ تفكّه الشاشة', () => {
    expect(photoPublicUrl(`${PHOTO_KEY_PREFIX}abc`)).toBe('/api/v1/trainer-photos/abc')
    expect(photoPublicUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(photoPublicUrl(null)).toBeNull()
  })
})

describe('المسارُ العامُّ يحرسه النشرُ لا التوقيع', () => {
  it('مدرّبٌ لم يُعتمد نشرُه: لا صورة', async () => {
    expect((await get()).statusCode).toBe(404)
  })

  it('فإذا اعتُمد نشرُه قُدّمت بلا توقيعٍ ولا جلسة', async () => {
    await review.approvePublicVisibility(profileId, ACTOR)
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('image/png')
  })

  it('وإيقافُه يُخفيها في اللحظة نفسِها التي يُخفي اسمَه', async () => {
    await review.suspendTrainer(profileId, ACTOR, 'اختبار')
    expect((await get()).statusCode).toBe(404)
    /* ويعود الحالُ لبقيّة الفحوص — والإيقافُ ينقل الطلبَ أيضا، فيُردّ معه */
    await prisma.trainerProfile.update({
      where: { id: profileId },
      data: { suspendedAt: null, suspendedBy: null, publicVisibility: true },
    })
    const prof = await prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { applicationId: true },
    })
    await prisma.trainerApplication.update({
      where: { id: prof!.applicationId }, data: { status: 'active' },
    })
    expect((await get()).statusCode).toBe(200)
  })
})

describe('ما يُكتب في العمود', () => {
  it('لا يُقبل إلّا https أو مفتاحُ مخزنٍ أصدرناه', async () => {
    await expect(
      review.savePublicProfile(profileId, ACTOR, { photoUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(/https/)
    await expect(
      review.savePublicProfile(profileId, ACTOR, { photoUrl: 'http://cdn.example.com/a.png' }),
    ).rejects.toThrow(/https/)
  })

  it('ورابطٌ خارجيٌّ يُحفظ ويخرج كما هو', async () => {
    const r = await review.savePublicProfile(profileId, ACTOR, {
      photoUrl: 'https://cdn.example.com/a.png', headline: 'عنوانٌ جديد',
    })
    expect(r.photoUrl).toBe('https://cdn.example.com/a.png')
    expect(r.headline).toBe('عنوانٌ جديد')
  })

  it('والعنوانُ والنبذةُ يُحرَّران — وكانا يُبذران مرّةً ولا يُعدَّلان أبدا', async () => {
    const r = await review.savePublicProfile(profileId, ACTOR, { bioPublic: '  نبذةٌ محرَّرة  ' })
    expect(r.bioPublic).toBe('نبذةٌ محرَّرة')
  })

  it('وفراغٌ يمحو ولا يحفظ فراغا', async () => {
    const r = await review.savePublicProfile(profileId, ACTOR, { headline: '   ' })
    expect(r.headline).toBeNull()
  })
})

describe('الرفعُ مطفأٌ حتّى يُشعله قرارُ تشغيل', () => {
  it('يُردّ بـ٥٠١ ويقول البديلَ — لصقُ الرابط', async () => {
    const saved = process.env.FILE_UPLOADS
    delete process.env.FILE_UPLOADS
    try {
      await expect(review.startPhotoUpload(profileId, ACTOR, 'image/png')).rejects.toThrow(/ألصِق رابطَ الصورة/)
    } finally {
      if (saved === undefined) delete process.env.FILE_UPLOADS
      else process.env.FILE_UPLOADS = saved
    }
  })

  it('وحين يُشعَل: المفتاحُ يُكتب في العمود قبل أن تُرفع البايتات', async () => {
    const saved = process.env.FILE_UPLOADS
    process.env.FILE_UPLOADS = 'on'
    try {
      const r = await review.startPhotoUpload(profileId, ACTOR, 'image/png')
      const p = await prisma.trainerProfile.findUnique({ where: { id: profileId }, select: { photoUrl: true } })
      expect(
        photoStorageKey(p?.photoUrl),
        'العمودُ لم يُكتب — فمسارُ الرفع سيردّ «لا مالك» لمفتاحٍ أصدرناه توّا',
      ).toBe(r.storageKey)
      expect(r.uploadUrl).toContain(`/api/v1/uploads/${r.storageKey}`)
    } finally {
      if (saved === undefined) delete process.env.FILE_UPLOADS
      else process.env.FILE_UPLOADS = saved
    }
  })

  it('ولا تُقبل صيغةٌ غيرُ صيغِ الصور', async () => {
    const saved = process.env.FILE_UPLOADS
    process.env.FILE_UPLOADS = 'on'
    try {
      await expect(review.startPhotoUpload(profileId, ACTOR, 'application/pdf')).rejects.toThrow(/JPEG/)
    } finally {
      if (saved === undefined) delete process.env.FILE_UPLOADS
      else process.env.FILE_UPLOADS = saved
    }
  })
})
