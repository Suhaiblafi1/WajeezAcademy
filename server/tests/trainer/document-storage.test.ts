/* وثائقُ المتقدّم: أين يستقرّ محتواها — والجوابُ تغيّر مرّتَين.

   ── الأولى: من القرص إلى القاعدة ──

   كانت على القرص، وسقط بها رفعُ السيرة الذاتية في الإنتاج سقوطا صامتا: الحزمة
   تُشغَّل من `/var/task/api/index.js`، ووحدةُ التخزين كانت تحسب جذرها بالصعود
   مستويين من موضعها — فتقصد `/var/storage/private`، خارج النشر وعلى نظام ملفات
   للقراءة فقط. ولم يمسكه اختبارٌ واحد: الاختبارات تشغّل الملفات في مواضعها،
   حيث المسار موجود وقابل للكتابة، فيمرّ الرفع أخضرَ وهو ميّت عند المستخدم.

   ── والثانية: من القاعدة إلى حجمٍ دائم (البند ⑤) ──

   ذلك المانعُ كان **مانعَ مضيفٍ لا مانعَ تصميم**، وقد زال بزوال Vercel:
   للخادم اليومَ حجمُ `storage` يبقى بين النشرات. فعادت البايتاتُ إلى القرص —
   لا إلى قرصٍ يُحسب مسارُه من موضع الوحدة، بل إلى جذرٍ يُقرأ من `STORAGE_ROOT`
   أو من مجلّد التشغيل.

   ⚠️ **وهذا الملفُّ كان سيبقى أخضرَ والقرارُ انقلب**: كان يفحص منعَ
   `createReadStream` و`import.meta.url` في وحدةِ التخزين ومسارِها، والمخزنُ
   الجديدُ وحدةٌ ثالثةٌ لا تمسّها تلك الفحوص. فحارسٌ يقيس ما لم يعد الموضعَ
   يطمئنّ بلا حقّ — ولذلك نُقل الفحصُ إلى حيث انتقل المحتوى. */

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
import { getObject } from '../../services/object-store'

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

  it('المحتوى يستقرّ على الحجم الدائم، ويُقرأ منه كما رُفع', async () => {
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
    const stored = await getObject(doc.storageKey)
    expect(stored, 'المحتوى ليس على الحجم — فأين ذهب؟').not.toBeNull()
    expect(stored!.equals(content)).toBe(true)

    /* ولا يُكتب في العمود بعد اليوم: نسخةُ القاعدة كانت تحمل البايتاتِ كلَّها،
       وكلُّ `pg_dump` ينفخ بها. فالعمودُ يبقى لما لم يُهاجر لا لما يُكتب. */
    const row = await prisma.trainerApplicationDocument.findUniqueOrThrow({
      where: { storageKey: doc.storageKey },
      select: { content: true, sizeBytes: true },
    })
    expect(row.content, 'البايتاتُ عادت إلى عمود القاعدة').toBeNull()
    /* والحجمُ يبقى في السجلّ — تقرؤه شاشةُ المراجعة */
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

  it('ولا مسارَ يُحسب من موضع الوحدة — وهو عينُ ما أسقط الرفعَ أوّلَ مرّة', () => {
    /* التعليقات تشرح العطل فتذكر أسماءه — والفحص على الشيفرة لا على شرحها */
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    /* ⚠️ الفحصُ على **المخزن** لا على وحدةِ التوقيع: المحتوى انتقل إليه.
       وهذا هو السطرُ الذي كان سيبقى يفحص بيتا هُجر. */
    const store = strip(read('server/services/object-store.ts'))
    expect(store, 'الجذرُ يُحسب من موضع الوحدة — وهو ما قصد `/var/storage` في الإنتاج')
      .not.toContain('import.meta.url')
    expect(store, 'الجذرُ لا يُقرأ من البيئة ولا من مجلّد التشغيل').toContain('process.cwd()')

    for (const f of ['server/services/storage.service.ts', 'server/http/routes/trainer-applications.routes.ts']) {
      expect(strip(read(f)), `مسارُ ملفٍّ يُبنى في ${f} — مكانُه المخزن`).not.toContain('import.meta.url')
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
