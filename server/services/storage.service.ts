/* تخزين خاص لوثائق المتقدمين — في قاعدة البيانات لا على القرص،
   ولا تُقرأ إلا برابط موقّع HMAC قصير العمر.

   كانت على القرص، والقرص غير موجود حيث يعمل الموقع. الحزمة تُشغَّل من
   `/var/task/api/index.js`، والوحدة كانت تحسب جذرها بالصعود مستويين من
   موضعها — فتصير `/var/storage/private`: خارج النشر أصلا، وعلى نظام ملفات
   للقراءة فقط (Vercel لا يكتب إلا في `/tmp`). فكل رفع سيرة ذاتية كان يسقط
   عند `mkdirSync`. ولا يظهر ذلك محلّيا أبدا: هناك المسار موجود وقابل للكتابة.

   ولا يكفي تصحيح العمق: `/var/task` للقراءة فقط، و`/tmp` يذهب مع انتهاء
   الاستدعاء — فيُكتب الملفّ ولا يجده المراجع حين يفتحه. فالمحتوى صار في
   عمود `Bytes` بجانب سجلّ الوثيقة نفسه: يعمل على Vercel وعلى الاستضافة
   الذاتية معا، ويهاجر مع القاعدة.

   - المفتاح السري: STORAGE_SECRET في الإنتاج، وملفٌّ محلّيّ في التطوير وحده.
   - الرابط الموقع: /api/v1/documents/:key?exp=..&sig=.. — بلا جلسة، لكنه ينتهي.
   - الرفع عبر PUT برابط موقّع مماثل يُنشأ بعد تسجيل الوثيقة في القاعدة. */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { getObject } from './object-store'

/* التطوير وحده يبلغ هذا المسار. وcwd لا import.meta.url: الأخير يصير
   `/var/task/api` في الحزمة فيصعد فوق النشر. */
const DEV_SECRET_DIR = join(process.cwd(), 'storage', 'private')

let cachedSecret: Buffer | null = null

/* مفتاح توقيع الروابط — ثلاثة مصادر بترتيبٍ مقصود.

   ١) STORAGE_SECRET حين يُضبط: اختيارٌ صريح يُثبّت المفتاح ويُدوّر متى شئنا.

   ٢) وإلّا فمشتقٌّ من DATABASE_URL. وهذا هو الدرس الذي كلّفنا نشرةً كاملة:
      كان المفتاح — بلا المتغيّر — يُولَّد عشوائيا في كل استدعاء سحابيّ ويُكتب
      على قرصٍ يذهب معه. فيُوقَّع رابطُ الرفع في استدعاء، ويصل الرفعُ إلى
      استدعاءٍ آخر بمفتاحٍ آخر، فيُردّ «رابط الرفع غير صالح أو منتهي» — عطبٌ
      يبدو عشوائيا ولا يُشخَّص. والاشتقاق يجعله واحدا في كل استدعاء بلا أن
      يُخزَّن سرٌّ جديد في مكان: من يملك القاعدة يملك الوثائق نفسها أصلا،
      فالمفتاح لا يضيف له شيئا. وDATABASE_URL مضبوطٌ حيث يعمل الموقع دائما.

   ٣) وفي التطوير وحده: ملفٌّ محلّيّ يبقى بين الإقلاعات.

   ولا يُشتقّ من قيمةٍ عامة أبدا — الاشتقاق سرٌّ بقدر أصله. */
function secret(): Buffer {
  if (cachedSecret) return cachedSecret
  if (process.env.STORAGE_SECRET) {
    cachedSecret = Buffer.from(process.env.STORAGE_SECRET, 'utf8')
    return cachedSecret
  }
  const db = process.env.DATABASE_URL
  if (db) {
    cachedSecret = createHmac('sha256', db).update('wajeez:storage:url-signing:v1').digest()
    return cachedSecret
  }
  try {
    mkdirSync(DEV_SECRET_DIR, { recursive: true })
    const secretPath = join(DEV_SECRET_DIR, '.secret')
    if (existsSync(secretPath)) {
      cachedSecret = readFileSync(secretPath)
      return cachedSecret
    }
    const generated = randomBytes(32)
    writeFileSync(secretPath, generated, { mode: 0o600 })
    cachedSecret = generated
    return generated
  } catch {
    throw new AuthError('storage_secret_missing', 'تخزين الوثائق غير مهيّأ — اضبط STORAGE_SECRET', 500)
  }
}

/** لأجل الاختبار وحده: نسيان المفتاح المخزَّن مؤقتا بين الحالات */
export function resetSecretCacheForTests(): void {
  cachedSecret = null
}

export function signKey(storageKey: string, exp: number, purpose: 'read' | 'write'): string {
  return createHmac('sha256', secret()).update(`${purpose}:${storageKey}:${exp}`).digest('base64url')
}

export function verifySignature(storageKey: string, exp: number, sig: string, purpose: 'read' | 'write'): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = Buffer.from(signKey(storageKey, exp, purpose))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/* السقف أربعة ميغابايت لا خمسة وعشرين ولا ثلاثمئة.

   الدالة السحابية لا تستقبل جسم طلبٍ أكبر من ٤٫٥MB — فالثلاثمئة كانت رقما
   في الشيفرة لا في الواقع: الفيديو يُردّ من المنصّة قبل أن يصل الخادم. وسقفٌ
   معلَنٌ لا يُوفى أسوأ من سقفٍ صغير معلوم. والفيديو له طريقه: حقلُ الرابط. */
/* ─────────── رفعُ الملفّات: مفتاحٌ واحدٌ يقول الحقيقة ───────────

   ── ما كان، ولماذا أُطفئ ──

   كان التخزينُ عمودَ `Bytes` بجانب سجلّ وثيقةِ المتقدّم، وهو **النموذجُ
   الوحيدُ** الذي يحمل ذلك العمود. وستّةُ نماذجَ تُصدر روابطَ رفعٍ إلى المسار
   نفسِه (موادُّ الشعبة، والتسجيلات، وملفُّ التسليم، وإجابةُ التقييم، والسيرةُ
   الذاتيّة) — فكلُّ رابطٍ منها كان يقود إلى ٤٠٤ «الوثيقة غير مسجلة»: لا
   مكانَ تُكتب فيه بايتاتُها. وثبت ذلك بالتجربة لا بالاستنتاج: رفعُ تسجيلِ
   جلسةٍ رُدّ فعلا، ورفعُ السيرة الذاتيّة لم يُرسل الملفَّ وقال للطالب «رُفعت».

   فأُطفئ المفتاحُ كي لا نُصدر وعدا لا نُوفيه.

   ── وما صار (البند ⑤) ──

   المانعُ زال: للخادم حجمُ `storage` دائم، والبايتاتُ تُكتب عليه
   (`object-store.ts`)، و`resolveStorageOwner` أدناه يعرف مالكَ أيِّ مفتاحٍ من
   **الستّة جميعا** — فلم يبقَ رابطٌ يقود إلى لا شيء.

   ⚠️ **والمفتاحُ يبقى مطفأً افتراضيّا بقصد.** لا لأنّ المخزنَ ناقصٌ بل لأنّ
   إشعالَه قرارُ تشغيلٍ لا قرارُ شيفرة: يُضبط `FILE_UPLOADS=on` في
   `deploy/.env.production` **بعد** أن تجريَ هجرةُ الوثائق القائمة
   (`npm run storage:migrate`) وبعد أن تُؤخذ نسخةٌ يدخلها حجمُ التخزين. */
export function fileUploadsEnabled(): boolean {
  return process.env.FILE_UPLOADS === 'on'
}

/** يُرفض الوعدُ بالرفع قبل أن يُصدَر رابطُه — بعربيّةٍ تقول البديل */
export function assertFileUploadsEnabled(altAr: string): void {
  if (fileUploadsEnabled()) return
  throw new AuthError('uploads_unavailable', `رفعُ الملفّات غيرُ مفعّلٍ بعد على هذه المنصّة. ${altAr}`, 501)
}

export const MAX_UPLOAD_BYTES: Record<string, number> = {
  cv: 4 * 1024 * 1024,
  certificate: 4 * 1024 * 1024,
  evidence: 4 * 1024 * 1024,
  reference_letter: 4 * 1024 * 1024,
  other: 4 * 1024 * 1024,
}
export const MAX_UPLOAD_ANY = 4 * 1024 * 1024

/* مواد الشعبة وتسجيلاتها ليست وثائق متقدّم: حجمها حجم محاضرة، ومسار رفعها
   مسألة قائمة لم تُحسم بعد (رابطها الموقّع يقصد مسارا لا يخدم إلا وثائق
   المتقدّمين). فحدُّها يبقى كما كان حتى يُحسم مخزنها — ولا يُخلط بحدّ هذه. */
export const MAX_COHORT_MEDIA_BYTES = 300 * 1024 * 1024
/* الأنواع التي تُرفع ملفا. والفيديو ليس منها — يُوضع رابطه في النموذج. */
export const UPLOADABLE_KINDS = ['cv', 'certificate', 'evidence', 'reference_letter', 'other'] as const

export const SIGNED_URL_TTL_MS = 10 * 60 * 1000 // عشر دقائق

export function newStorageKey(): string {
  return randomBytes(24).toString('base64url')
}

/* ═══ من يملك هذا المفتاح؟ — ستّةُ نماذجَ ومساران ═══

   المساران (`PUT /api/v1/uploads/:key` و`GET /api/v1/documents/:key`) كانا
   يسألان `trainerApplicationDocument` وحدَه، فيردّان ٤٠٤ «الوثيقة غير مسجلة»
   لكلّ ما سواه. وستّةُ نماذجَ تُصدر روابطَ رفعٍ إليهما فعلا: موادُّ الشعبة
   وتسجيلاتُها وملفُّ التسليم وإجابةُ التقييم والسيرةُ الذاتيّة ووثيقةُ
   المتقدّم. أي أنّ خمسةً منها كانت **تَعِد برابطٍ لا يقود إلى شيء**.

   والتحقّقُ من أنّ المفتاحَ مسجَّلٌ في نموذجٍ ما ليس تزيّدا على التوقيع:
   التوقيعُ يُثبت أنّ المنصّةَ أصدرت الرابط، وهذا يمنع أن يُكتب كائنٌ لا
   يملكه سجلٌّ — فلا يبقى على القرص ما لا يعرفه أحد ولا يحذفه أحد. */
export type StorageOwnerKind =
  | 'trainer_document' | 'cv' | 'recording' | 'material' | 'submission' | 'assessment_response'

export interface StorageOwner {
  kind: StorageOwnerKind
  maxBytes: number
  /* ما تعرفه القاعدةُ عنه — وثلاثةٌ من الستّة لا تعرف نوعا ولا اسما */
  mime?: string
  originalName?: string
}

export async function resolveStorageOwner(
  prisma: PrismaClient, storageKey: string,
): Promise<StorageOwner | null> {
  const doc = await prisma.trainerApplicationDocument.findUnique({
    where: { storageKey }, select: { kind: true, mime: true, originalName: true },
  })
  if (doc) {
    return {
      kind: 'trainer_document',
      maxBytes: MAX_UPLOAD_BYTES[doc.kind] ?? MAX_UPLOAD_ANY,
      mime: doc.mime, originalName: doc.originalName,
    }
  }

  /* السيرةُ الذاتيّةُ لا تحمل `@unique` على المفتاح — كالتسليم والإجابة */
  const cv = await prisma.cvSubmission.findFirst({
    where: { storageKey }, select: { mime: true, originalName: true },
  })
  if (cv) return { kind: 'cv', maxBytes: MAX_UPLOAD_ANY, mime: cv.mime, originalName: cv.originalName }

  /* ⚠️ والتسجيلُ والمادّةُ لا يأخذان `MAX_COHORT_MEDIA_BYTES` (٣٠٠MB) هنا.

     المسارُ يقرأ الجسمَ **كاملا في الذاكرة** (`req.body as Buffer`) وحدُّه
     `bodyLimit: MAX_UPLOAD_ANY`. فلو أعلنّا ثلاثَمئةٍ لَردّ Fastify الطلبَ
     عند أربعةٍ قبل أن يبلغ فحصُنا أصلا: رسالةٌ عامّةٌ بدل رسالتنا، وسقفٌ
     معلَنٌ لا يُوفى — وهو أسوأُ من سقفٍ صغيرٍ معلوم، بنصّ ما هو مكتوبٌ أعلاه.

     ورفعُ الحدّ ليس رفعَ رقم: ثلاثُمئةٍ في الذاكرة لكلّ طلبٍ متزامن تُسقط
     الحاوية. فالطريقُ **البثُّ إلى القرص** لا مخزنٌ أكبر — وذلك بندٌ مستقلٌّ
     يُفتح حين تُطلب محاضرةٌ كاملة، لا اليوم. والفيديو رابطٌ أصلا بقرار. */
  const rec = await prisma.recording.findUnique({
    where: { storageKey }, select: { mime: true, title: true },
  })
  if (rec) {
    return { kind: 'recording', maxBytes: MAX_UPLOAD_ANY, mime: rec.mime ?? undefined, originalName: rec.title }
  }

  const mat = await prisma.learningMaterial.findUnique({
    where: { storageKey }, select: { title: true },
  })
  if (mat) return { kind: 'material', maxBytes: MAX_UPLOAD_ANY, originalName: mat.title }

  const sub = await prisma.assignmentSubmission.findFirst({ where: { storageKey }, select: { id: true } })
  if (sub) return { kind: 'submission', maxBytes: MAX_UPLOAD_ANY }

  const res = await prisma.assessmentResponse.findFirst({ where: { storageKey }, select: { id: true } })
  if (res) return { kind: 'assessment_response', maxBytes: MAX_UPLOAD_ANY }

  return null
}

/* الحجمُ يبقى في سجلّ وثيقة المتقدّم — تقرؤه شاشةُ المراجعة. والبايتاتُ
   لم تعد معه: صارت على القرص (`object-store.ts`)، والعمودُ يخلو بالهجرة. */
export async function recordDocumentSize(
  prisma: PrismaClient, storageKey: string, sizeBytes: number,
): Promise<void> {
  await prisma.trainerApplicationDocument.update({ where: { storageKey }, data: { sizeBytes } })
}

/* ═══ القراءةُ: القرصُ أوّلا، ثمّ العمودُ لما لم يُهاجر بعد ═══

   وثائقُ المتقدّمين المكتوبةُ قبل المخزن تسكن عمودَ `content`. والهجرةُ
   (`scripts/migrate-documents-to-disk.ts`) تنقلها، لكنّ التراجعَ إلى العمود
   يبقى **حتّى تجريَ الهجرةُ على الإنتاج** — فنشرةٌ تسبق الهجرةَ لا تُخفي
   وثيقةً عن مراجعها. ويُحذف هذا التراجعُ يومَ يخلو العمود. */
export async function readDocumentContent(
  prisma: PrismaClient, storageKey: string,
): Promise<Buffer | null> {
  const onDisk = await getObject(storageKey)
  if (onDisk) return onDisk
  const row = await prisma.trainerApplicationDocument.findUnique({
    where: { storageKey }, select: { content: true },
  })
  if (!row?.content) return null
  return Buffer.from(row.content)
}
