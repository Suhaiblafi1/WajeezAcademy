/* وثائق المتقدّم تعيش في القاعدة لا على القرص.

   كانت على القرص، وسقط بها رفعُ السيرة الذاتية في الإنتاج سقوطا صامتا: الحزمة
   تُشغَّل من `/var/task/api/index.js`، ووحدةُ التخزين كانت تحسب جذرها بالصعود
   مستويين من موضعها — فتقصد `/var/storage/private`، خارج النشر وعلى نظام ملفات
   للقراءة فقط. ولم يمسكه اختبارٌ واحد: الاختبارات تشغّل الملفات في مواضعها،
   حيث المسار موجود وقابل للكتابة، فيمرّ الرفع أخضرَ وهو ميّت عند المستخدم.

   ولا يكفي تصحيح العمق: `/var/task` للقراءة فقط، و`/tmp` يذهب مع الاستدعاء —
   فتُكتب الوثيقة ولا يجدها المراجع. فالحارس هنا لا يفحص «هل نجح الرفع» (نجح
   قبلا وهو معطوب)، بل يفحص أين استقرّ المحتوى: في عمود القاعدة، وبلا أثرٍ
   لقرصٍ في مسار الطلب أصلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { buildApp } from '../../http/app'
import {
  MAX_UPLOAD_ANY, MAX_UPLOAD_BYTES, signKey, verifySignature, resetSecretCacheForTests,
} from '../../services/storage.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/* سقفُ جسم الطلب الذي يمرّ فعلا — أيّ حدٍّ معلَنٍ فوقه وعدٌ لا يُوفى.

   ⚠️ ورقمُه ٤٫٥ ميغا لأنّه كان سقفَ دالّة Vercel، وقد زال ذلك السقفُ بزوالها:
   الخادمُ اليومَ عمليّةُ Node في حاويةٍ نملكها، وحدُّها ما نضعه نحن. فالرقمُ
   يبقى **قرارَنا لا قيدَ مضيف** — الوثائقُ تُخزَّن في عمود `Bytes` بجانب
   السجلّ (`storage.service.ts`)، فرفعُ السقف يرفع حجمَ القاعدة وذاكرةَ
   الطلب معا. رفعُه قرارُ منتَجٍ يُتّخذ عمدا، لا أثرٌ جانبيٌّ لتغيير مضيف. */
const HOST_BODY_LIMIT = 4.5 * 1024 * 1024

let prisma: PrismaClient
let apps: TrainerApplicationService
let reference: string
let candidateToken: string

const phase1 = {
  fullName: 'مدرب تخزين الوثائق', email: 'doc-storage@test.local',
  specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const, trainingYears: 'workshops',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation: 'أدرّب تحليل البيانات منذ ثماني سنوات وأبني تماريني من بيانات حقيقية لا أمثلة مفتعلة تُنسى بعد الجلسة.',
  privacyConsent: true as const, password: 'Docs#12345',
}

describe('تخزين وثائق المتقدّم', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    apps = new TrainerApplicationService(prisma)
    const res = await apps.submitPhase1(phase1)
    reference = res.reference
    candidateToken = res.candidateToken
    expect(candidateToken).not.toBe('')
  })

  it('المحتوى يستقرّ في عمود القاعدة، ويُقرأ منه كما رُفع', async () => {
    const content = Buffer.from('%PDF-1.4 سيرة ذاتية — محتوى خاص لا يُقدَّم إلا برابط موقّع')
    const doc = await apps.requestDocumentUpload(reference, candidateToken, {
      kind: 'cv', originalName: 'سيرتي.pdf', mime: 'application/pdf', sizeBytes: content.length,
    })

    const app = await buildApp(prisma)
    const put = await app.inject({
      method: 'PUT', url: doc.uploadUrl,
      headers: { 'content-type': 'application/octet-stream' }, payload: content,
    })
    expect(put.statusCode).toBe(200)

    /* هنا الفحص الذي كان غائبا: أين استقرّ المحتوى */
    const row = await prisma.trainerApplicationDocument.findUniqueOrThrow({
      where: { storageKey: doc.storageKey },
      select: { content: true, sizeBytes: true },
    })
    expect(row.content, 'المحتوى ليس في القاعدة — فهو على قرصٍ لا يوجد في الإنتاج').not.toBeNull()
    expect(Buffer.from(row.content!).equals(content)).toBe(true)
    expect(row.sizeBytes).toBe(content.length)

    const urls = apps.signedDocumentUrls([{ storageKey: doc.storageKey }])
    const get = await app.inject({ method: 'GET', url: urls[doc.storageKey] })
    expect(get.statusCode).toBe(200)
    expect(get.headers['content-type']).toContain('application/pdf')
    expect(Buffer.from(get.rawPayload).equals(content)).toBe(true)
    await app.close()
  })

  it('ما فوق الحدّ يُردّ ٤١٣ برسالة تسمّي الحدّ', async () => {
    const doc = await apps.requestDocumentUpload(reference, candidateToken, {
      kind: 'certificate', originalName: 'big.pdf', mime: 'application/pdf', sizeBytes: 10,
    })
    const app = await buildApp(prisma)
    const put = await app.inject({
      method: 'PUT', url: doc.uploadUrl,
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.alloc(MAX_UPLOAD_ANY + 1024),
    })
    expect(put.statusCode).toBe(413)
    await app.close()
  })

  it('المفتاح واحدٌ في كل استدعاء سحابيّ — لا عشوائيّ يذهب معه', () => {
    /* هذا ما كسر الرفع في الإنتاج بلا أثرٍ يُقرأ: بلا STORAGE_SECRET كان
       المفتاح يُولَّد عشوائيا لكل استدعاء، فيُوقَّع الرابط هنا ويُفحص هناك
       فيُردّ «غير صالح». والاشتقاق من DATABASE_URL يجعله واحدا. */
    const prevSecret = process.env.STORAGE_SECRET
    const prevDb = process.env.DATABASE_URL
    try {
      delete process.env.STORAGE_SECRET
      process.env.DATABASE_URL = 'postgresql://u:p@host/db'
      resetSecretCacheForTests()
      const exp = Date.now() + 60_000
      const sig = signKey('key-abcdefghij', exp, 'write')
      /* «استدعاءٌ آخر»: ذاكرةٌ منسيّة والبيئة نفسها — التوقيع يجب أن يطابق */
      resetSecretCacheForTests()
      expect(verifySignature('key-abcdefghij', exp, sig, 'write'), 'المفتاح تغيّر بين استدعاءين').toBe(true)

      /* وقاعدةٌ أخرى تعني مفتاحا آخر — لا ثابتا مكتوبا في الشيفرة */
      process.env.DATABASE_URL = 'postgresql://u:p@other/db'
      resetSecretCacheForTests()
      expect(verifySignature('key-abcdefghij', exp, sig, 'write'), 'المفتاح لا يعتمد على شيء').toBe(false)
    } finally {
      if (prevSecret === undefined) delete process.env.STORAGE_SECRET
      else process.env.STORAGE_SECRET = prevSecret
      if (prevDb === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prevDb
      resetSecretCacheForTests()
    }
  })

  it('لا قرصَ في مسار الوثيقة — ولا مسارَ يُحسب من موضع الوحدة', () => {
    const svc = read('server/services/storage.service.ts')
    /* التعليقات تشرح العطل فتذكر أسماءه — والفحص على الشيفرة لا على شرحها */
    const code = svc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const banned of ['createWriteStream', 'createReadStream', 'import.meta.url', 'STORAGE_DIR']) {
      expect(code, `${banned} عاد إلى مسار الوثيقة`).not.toContain(banned)
    }
    const routes = read('server/http/routes/trainer-applications.routes.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const banned of ['createReadStream', 'createWriteStream', 'filePathFor', 'existsSync']) {
      expect(routes, `${banned} عاد إلى مسار الوثيقة`).not.toContain(banned)
    }
  })

  it('كلّ حدٍّ معلَنٍ يمرّ فعلا، والواجهة تعلن حدّ الخادم نفسه', () => {
    for (const [kind, max] of Object.entries(MAX_UPLOAD_BYTES)) {
      expect(max, `حدّ ${kind} فوق ما يمرّ من جسم الطلب — وعدٌ لا يُوفى`).toBeLessThanOrEqual(HOST_BODY_LIMIT)
    }
    expect(MAX_UPLOAD_ANY).toBeLessThanOrEqual(HOST_BODY_LIMIT)

    /* سقف Fastify هو السقف نفسه: أكبرُ منه يقبل ما يُردّ لاحقا، وأصغرُ يقطع
       الاتّصال قبل أن تصل رسالة ٤١٣ إلى المتقدّم. */
    const routes = read('server/http/routes/trainer-applications.routes.ts')
    expect(routes).toContain('bodyLimit: MAX_UPLOAD_ANY')

    /* والواجهة تفحص قبل الرحلة بالحدّ نفسه لا برقمٍ يتقادم وحده.

       والحدُّ انتقل إلى `join-trainer/options.ts` حين فُكّكت الصفحةُ (كانت
       ألفا وثلاثَ مئةِ سطر)، وتُعيد الصفحةُ تصديرَه. فيُقرأ الملفّان معا:
       الضمانُ لم يتغيّر — تغيّر بيتُه. */
    const ui = /export const MAX_DOC_BYTES = (\d+) \* 1024 \* 1024;/
      .exec(read('src/pages/JoinTrainer.tsx') + read('src/pages/join-trainer/options.ts'))?.[1]
    expect(ui, 'حدّ الواجهة مفقود').toBeTruthy()
    expect(Number(ui) * 1024 * 1024, 'الواجهة تعد بحدٍّ يخالف الخادم').toBe(MAX_UPLOAD_ANY)
  })
})
