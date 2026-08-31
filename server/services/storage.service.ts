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

/* التطوير وحده يبلغ هذا المسار — والإنتاج يضبط STORAGE_SECRET. وcwd لا
   import.meta.url: الأخير يصير `/var/task/api` في الحزمة فيصعد فوق النشر. */
const DEV_SECRET_DIR = join(process.cwd(), 'storage', 'private')

let cachedSecret: Buffer | null = null

function secret(): Buffer {
  if (cachedSecret) return cachedSecret
  if (process.env.STORAGE_SECRET) {
    cachedSecret = Buffer.from(process.env.STORAGE_SECRET, 'utf8')
    return cachedSecret
  }
  /* بلا متغيّر: ملفٌّ محلّيّ. وإن تعذّرت الكتابة فالخطأ يسمّي دواءه بدل أن
     يظهر EROFS خاما في سجلّ لا يقرؤه أحد. */
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

/* المحتوى يُكتب بجانب سجلّه ويُقرأ منه — لا قرص في مسار الطلب أصلا */
export async function writeDocumentContent(
  prisma: PrismaClient, storageKey: string, content: Buffer,
): Promise<number> {
  await prisma.trainerApplicationDocument.update({
    where: { storageKey },
    data: { content: new Uint8Array(content), sizeBytes: content.length },
  })
  return content.length
}

export async function readDocumentContent(
  prisma: PrismaClient, storageKey: string,
): Promise<Buffer | null> {
  const row = await prisma.trainerApplicationDocument.findUnique({
    where: { storageKey }, select: { content: true },
  })
  if (!row?.content) return null
  return Buffer.from(row.content)
}
