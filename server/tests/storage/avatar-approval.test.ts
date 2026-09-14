/* صورةٌ يرفعها صاحبُها، ولا تُعرض للعامّة إلّا باعتمادِ الإدارة.

   ═══ القرارُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «everyone can put their picture and
   the admin approves it, but the system have conditions for the picture so
   it fits the design» — والاعتمادُ على **الصور العامّة وحدَها**: صورةُ
   الحساب تسري فورا في ترويسة صاحبها وشهاداته، ولا تنتظر أحدا.

   ═══ وثلاثةٌ تُحرَس هنا ═══

   ١) **المعلّقةُ لا تبلغ العامّة.** لو كُتب المرفوعُ في `photoUrl` مباشرةً
      لَظهر قبل أن يراه أحد — وهو نقضُ قاعدة المستودَع «لا صورةَ تُعرض حقيقةً
      قبل اعتماد نشرها». فالمعلّقةُ تسكن عمودَها، والمسارُ العامُّ لا يعرفها.

   ٢) **والبايتاتُ تُسأل، لا الترويسة.** `PUT /api/v1/uploads/:key` كان يأخذ
      النوعَ من `content-type` الذي يكتبه العميل حين لا يعرفه السجلّ. فمن ملك
      رابطَ رفعٍ موقّعا — وكلُّ مستخدمٍ مسجّلٍ يملكه لصورته — خزّن أيَّ بايتاتٍ
      تحت مفتاحِ صورة، ثمّ تُخدَم من نطاقنا بالنوع الذي ادّعاه. والتوقيعُ في
      أوّل البايتات يقطع ذلك.

   ٣) **والاعتمادُ ينقل ولا ينسخ.** بعده يخلو العمودُ المعلَّق، وإلّا بقي
      للصورة موضعان وظنّ قارئٌ أنّ ثمّة ما ينتظر قرارا وقد بُتّ فيه.

   ═══ ورابعٌ لم يكن في الحسبان: أيُرفع شيءٌ أصلا؟ ═══

   كُتب حارسُ البايتات أوّلا فاخضرّ، ثمّ نُقض الفحصُ في المسار فبقي أخضرَ.
   والسببُ أنّه كان يأخذ ٤١٥ من Fastify لا من فحصنا: لا محلّلَ مسجَّلا إلّا
   لـ`application/json`، فكلُّ رفعٍ يُردّ قبل المعالج
   بـ`FST_ERR_CTP_INVALID_MEDIA_TYPE`.

   **فرفعُ الملفّات لم يعمل في هذه المنصّة قطّ** — لا صورةٌ ولا سيرةٌ ذاتيّةٌ
   ولا مادّةُ شعبةٍ ولا تسجيل. ولم يكشفه اختبارٌ لأنّ الاختباراتِ كانت تنادي
   الخدماتِ مباشرةً، والمسارُ يُقاس بـ٤٠٤ و٤٠٣ لا بنجاحِ رفعٍ حقيقيّ. فسُجّل
   محلّلُ البايتات الخام في `app.ts`، وقُدّم هنا حارسُ **النجاح** قبل حارس
   الردّ — فما دام الرفعُ مردودا كان كلُّ ٤١٥ يبدو حراسةً وهو بابٌ مغلق.

   ═══ وكيف رُئي كلٌّ منها ساقطا ═══

   نُقض فصلُ المعلّقة بكتابة المفتاح في `photoUrl` معها، فقدّمه المسارُ
   العامُّ ٢٠٠ وسقط حارسان. ونُقض محلّلُ البايتات باسمِ نوعٍ لا يرد، فسقط
   حارسُ النجاح. ونُقض `kindRequiresImage` في المسار، فقُبلت بايتاتُ HTML
   ٢٠٠. ونُقض `photoPendingKey: null` من تحديث الاعتماد، فبقي العمودُ ممتلئا
   وسقط حارسان. ثمّ أُعيدت الأربعةُ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { putObject } from '../../services/object-store'
import {
  PHOTO_KEY_PREFIX, sniffImageMime, kindRequiresImage, resolveStorageOwner,
  signKey, SIGNED_URL_TTL_MS,
} from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance
let review: TrainerReviewService
let profileId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const PENDING_KEY = 'pending-photo-key-for-the-test-01'

/* رأسُ PNG الحقيقيُّ — ثمانيةُ بايتاتٍ تعرفها كلُّ مكتبة */
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  review = new TrainerReviewService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, {
    fullName: 'مدرّبةُ الصورة المعلّقة', email: 'pending-photo@test.local',
  })
  profileId = made.profileId
  /* تُعتمد للنشر أوّلا: فلو بقيت غيرَ معتمَدةٍ لَاخضرّ الحارسُ الأوّلُ لسببٍ
     خاطئ — يردّ المسارُ ٤٠٤ لأنّها غيرُ منشورةٍ لا لأنّ الصورةَ معلّقة. */
  await review.approvePublicVisibility(profileId, ACTOR)
  await putObject(PENDING_KEY, PNG_HEAD, { mime: 'image/png', originalName: 'p.png' })
  await prisma.trainerProfile.update({
    where: { id: profileId }, data: { photoPendingKey: PENDING_KEY },
  })
}, 240_000)

describe('المعلّقةُ لا تبلغ الصفحةَ العامّة', () => {
  it('المسارُ العامُّ لا يعرف مفتاحا معلَّقا — ولو كان صاحبُه معتمَدَ النشر', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${PENDING_KEY}` })
    expect(
      res.statusCode,
      'قُدّمت صورةٌ لم تُعتمد بعد: الرفعُ وحدَه صار عرضا، وهو نقضُ قاعدة اعتماد النشر.',
    ).toBe(404)
  })

  it('والعمودُ العامُّ ما زال فارغا — الرفعُ لم يكتب فيه', async () => {
    const p = await prisma.trainerProfile.findUniqueOrThrow({
      where: { id: profileId }, select: { photoUrl: true, photoPendingKey: true },
    })
    expect(p.photoUrl, 'المرفوعُ كُتب في العمود العامّ رأسا').toBeNull()
    expect(p.photoPendingKey).toBe(PENDING_KEY)
  })

  it('ومع ذلك يُعرف مالكُ المفتاح — وإلّا رُدّت بايتاتُه عند الرفع', async () => {
    const owner = await resolveStorageOwner(prisma, PENDING_KEY)
    expect(owner?.kind).toBe('trainer_photo')
  })
})

describe('البايتاتُ تُسأل لا الترويسة', () => {
  it('توقيعُ الصيغِ الثلاثِ يُقرأ من أوّل البايتات', () => {
    expect(sniffImageMime(PNG_HEAD)).toBe('image/png')
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageMime(Buffer.concat([
      Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'),
    ]))).toBe('image/webp')
  })

  it('وما ليس صورةً يُردّ — ولو سُمّي صورةً', () => {
    expect(sniffImageMime(Buffer.from('<html><script>alert(1)</script>'))).toBeNull()
    expect(sniffImageMime(Buffer.from('%PDF-1.7'))).toBeNull()
  })

  /* ═══ وقبل الفحصِ: أيبلغ الرفعُ المعالجَ أصلا؟ ═══

     هذا الحارسُ كُتب بعد أن اخضرّ حارسُ الفحص **وهو معطَّل**: كان يتوقّع ٤١٥
     ويأخذها من Fastify لا من فحصنا — إذ لا محلّلَ مسجَّلا لأنواع الصور، فكلُّ
     رفعٍ يُردّ قبل المعالج بـ`FST_ERR_CTP_INVALID_MEDIA_TYPE`.

     ومعنى ذلك أنّ رفعَ الملفّات لم يعمل في هذه المنصّة قطّ — لا صورةٌ ولا
     سيرةٌ ذاتيّةٌ ولا مادّةُ شعبة. فيُقاس النجاحُ أوّلا، وإلّا صار كلُّ ٤١٥
     دليلا على حراسةٍ وهي دليلُ بابٍ مغلق. */
  it('رفعُ صورةٍ صحيحةٍ ينجح — وإلّا فالحارسُ التالي يخضرّ لبابٍ مغلق', async () => {
    const exp = Date.now() + SIGNED_URL_TTL_MS
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/uploads/${PENDING_KEY}?exp=${exp}&sig=${signKey(PENDING_KEY, exp, 'write')}`,
      headers: { 'content-type': 'image/png' },
      payload: PNG_HEAD,
    })
    expect(
      res.statusCode,
      'رُدّ رفعٌ صحيحٌ: لا محلّلَ للبايتات الخام، فلا يعمل رفعٌ في المنصّة كلِّها.',
    ).toBe(200)
  })

  /* والفحصُ يُقاس في المسار لا في الدالّة وحدَها: الدالّةُ قد تكون صائبةً
     ولا يناديها أحد. فتُرفع بايتاتُ HTML برابطٍ موقّعٍ صحيح. */
  it('ومسارُ الرفع يردّ بايتاتِ HTML تحت مفتاحِ صورة', async () => {
    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(PENDING_KEY, exp, 'write')
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/uploads/${PENDING_KEY}?exp=${exp}&sig=${sig}`,
      headers: { 'content-type': 'image/png' },
      payload: Buffer.from('<html><script>alert(1)</script></html>'),
    })
    expect(
      res.statusCode,
      'قُبلت بايتاتٌ ليست صورةً تحت مفتاحِ صورة: تُخدَم بعدها من نطاقنا بالنوع الذي ادّعاه رافعُها.',
    ).toBe(415)
  })

  it('والأنواعُ التي يلزمها ذلك مُعلَنةٌ بنيةً لا بالاسم', () => {
    expect(kindRequiresImage('trainer_photo')).toBe(true)
    expect(kindRequiresImage('avatar')).toBe(true)
    expect(kindRequiresImage('cv')).toBe(false)
    expect(kindRequiresImage('recording')).toBe(false)
  })
})

describe('الاعتمادُ ينقل ولا ينسخ', () => {
  it('بعده تصير الصورةُ عامّةً ويخلو العمودُ المعلَّق', async () => {
    await review.approvePendingPhoto(profileId, ACTOR)
    const p = await prisma.trainerProfile.findUniqueOrThrow({
      where: { id: profileId }, select: { photoUrl: true, photoPendingKey: true },
    })
    expect(p.photoUrl).toBe(`${PHOTO_KEY_PREFIX}${PENDING_KEY}`)
    expect(
      p.photoPendingKey,
      'بقي المعلَّقُ بعد الاعتماد: يظنّ قارئٌ أنّ ثمّة قرارا لم يُتّخذ وقد اتُّخذ.',
    ).toBeNull()
  })

  it('وعندها يقدّمها المسارُ العامُّ — هو المفتاحُ نفسُه لا نسخةٌ منه', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${PENDING_KEY}` })
    expect(res.statusCode).toBe(200)
  })

  it('واعتمادُ ما لا ينتظر شيئا يُردّ بلا أثر', async () => {
    await expect(review.approvePendingPhoto(profileId, ACTOR)).rejects.toThrow()
  })
})
