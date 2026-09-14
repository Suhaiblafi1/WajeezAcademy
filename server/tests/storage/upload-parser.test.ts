/* البابُ مفتوحٌ للبايتات — لكلّ نوعٍ يرفعه أحدٌ في هذه المنصّة.

   ═══ العطبُ الذي كُتب له، وقد عاش شهورا ═══

   `server/http/app.ts` لم يكن يسجّل محلّلَ أجسامٍ إلّا لـ`application/json`.
   وFastify يردّ كلَّ نوعٍ سواه **قبل أن يبلغ المعالجَ أصلا** بـ٤١٥
   `FST_ERR_CTP_INVALID_MEDIA_TYPE`.

   ═══ وحدُّ العطب — قِيس ولم يُستنتَج ═══

   بإزالة المحلّل بالكامل يُقاس ما يبلغ المعالجَ وما يُردّ قبله:

     · `application/octet-stream` → يبلغ (٤٠٤)  — لـFastify ٥ محلّلٌ له أصلا
     · `image/png` · `image/jpeg` · `image/webp` → ٤١٥
     · `application/pdf` · `video/mp4`           → ٤١٥

   فالشاشاتُ التي ترسل `application/octet-stream` كانت تعمل: وثيقةُ المتقدّم
   (`JoinTrainer.tsx`) والسيرةُ الذاتيّة (`MyCv.tsx`) ومادّةُ الشعبة
   (`CohortMaterials.tsx`) والتسجيل (`SessionsAndAttendance.tsx`).

   **والمكسورُ ما أعلن نوعَه الحقيقيّ**: `TrainerRunOps.tsx` يرسل
   `content-type: file.type` — أي `image/jpeg` وأخواتِها — فكان رفعُ صورة
   المدرّب يُردّ ٤١٥ عند الإطار، ولا يُشغَّل سطرٌ ممّا كُتب له. وهو العطبُ
   الذي شُكي منه.

   ⚠️ **وقد قيل في رسالة الالتزام وفي #159 إنّ الرفعَ كلَّه كان معطَّلا.**
   وذلك أوسعُ من الحقّ: عُمّم من حالةِ الصور على الستّة، قبل أن يُقاس
   `octet-stream` وحدَه. والمقيسُ ما في الجدول أعلاه.

   ولم يكشف الصورَ اختبارٌ لأنّ الاختباراتِ تنادي الخدماتِ مباشرةً، والمسارُ
   كان يُقاس بـ٤٠٤ و٤٠٣ — وكلاهما يأتي **قبل** قراءة الجسم في حالة، أو
   بنوعٍ يعرفه الإطارُ في أخرى.

   ═══ ولمَ هذا الحارسُ لا حارسُ كلِّ نوعٍ على حدة ═══

   ما يُحرَس هنا شيءٌ واحد: **أنّ الطلبَ يبلغ معالجَنا**. فإن بلغه صار الحكمُ
   لشيفرتنا — توقيعا وسقفا ومالكا — وتلك حرّاسُها في `avatar-approval.test.ts`
   وأخواتِه. وإن لم يبلغه فلا شيءَ من ذلك يُشغَّل أصلا.

   والفرقُ يُقرأ في الرمز نفسِه: **٤١٥ يعني أنّ الإطارَ ردّه**، و٤٠٤ «الوثيقة
   غير مسجلة» يعني أنّه بلغ `resolveStorageOwner` — أي أنّ الجسمَ قُرئ وأنّ
   الطريقَ سالك. فيُقاس البلوغُ بمفتاحٍ لا مالكَ له عمدا: لا فخّ فيه ولا
   تجهيزَ صفوفٍ لستّة نماذج.

   ═══ وكيف رُئي ساقطا ═══

   نُقض المحلّلُ مرّتَين: بتسميةٍ لا ترد (`application/x-nope`)، ثمّ بإزالته
   بالكامل. وفي الحالتَين سقطت خمسةٌ وبقي `octet-stream` أخضرَ — وهو الذي
   كشف أنّ للإطار محلّلا له، فصُحّح رأسُ هذا الملفّ على القياس. ثمّ أُعيد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { signKey, SIGNED_URL_TTL_MS } from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance

/* مفتاحٌ صحيحُ الشكل بلا مالكٍ بقصد: يعبر التوقيعَ، ويقف عند «لا مالك» */
const ORPHAN_KEY = 'orphan-key-with-no-owner-row-0001'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
}, 240_000)

const put = (contentType: string) => {
  const exp = Date.now() + SIGNED_URL_TTL_MS
  return app.inject({
    method: 'PUT',
    url: `/api/v1/uploads/${ORPHAN_KEY}?exp=${exp}&sig=${signKey(ORPHAN_KEY, exp, 'write')}`,
    headers: { 'content-type': contentType },
    payload: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
  })
}

/* الأنواعُ التي ترسلها شاشاتُ المنصّة فعلا، ونوعٌ لم يُتوقّع بعد */
const SENT_BY_SCREENS = [
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'video/mp4',
]

describe('كلُّ نوعٍ يبلغ المعالجَ — والإطارُ لا يردّه قبله', () => {
  for (const mime of SENT_BY_SCREENS) {
    it(`«${mime}» يبلغ الشيفرةَ لا الإطار`, async () => {
      const res = await put(mime)
      expect(
        res.statusCode,
        `رُدّ «${mime}» بـ٤١٥ قبل المعالج: لا محلّلَ لهذا النوع، فلا يعمل رفعُه في المنصّة كلِّها.`,
      ).not.toBe(415)
      /* والدليلُ الموجَب: بلغ `resolveStorageOwner` فقال «لا مالك» */
      expect(res.statusCode).toBe(404)
    })
  }

  it('والردُّ عربيٌّ من شيفرتنا لا رسالةُ إطارٍ إنجليزيّة', async () => {
    const body = JSON.parse((await put('application/octet-stream')).body) as {
      error?: { code?: string; message_ar?: string }
    }
    expect(body.error?.code).toBe('not_found')
    expect(body.error?.message_ar).toContain('الوثيقة')
  })
})
