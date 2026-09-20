/* تعميةُ رقم الحساب البنكيّ — الموضعُ **الوحيد** الذي يعمّي ويفكّ في المستودَع.

   ═══ ولمَ أُدخلت التعميةُ أصلا وليست في المستودَع ═══

   لا تعميةَ قابلةً للفكّ في هذه المنصّة كلِّها: `bcrypt` للكلمات (طريقٌ
   واحد)، و`sha256` للرموز (طريقٌ واحد)، و`HMAC` لتوقيع الروابط (توثيقٌ لا
   إخفاء). وكلُّها لا تصلح هنا: رقمُ الحساب **يُقرأ ثانيةً** لحظةَ الحوالة.

   ═══ ولمَ مفتاحٌ مستقلٌّ ولا اشتقاقَ من `DATABASE_URL` ═══

   `storage.service.ts` تشتقّ مفتاحَ توقيعها من `DATABASE_URL` حين لا يُضبط
   `STORAGE_SECRET`، وتُعلّل ذلك بقولها: «من يملك القاعدة يملك الوثائق نفسها
   أصلا، فالمفتاح لا يضيف له شيئا». وهي محقّةٌ **هناك**: تلك توقّع روابطَ
   لوثائقَ محفوظةٍ على القرص.

   وهنا العكسُ تماما: **النصُّ المعمّى هو البيانُ نفسُه**، لا رابطٌ إليه.
   فلو اشتُقّ المفتاحُ من وصلة القاعدة لَكان من نسخةُ القاعدةِ عنده — ومعه
   شيفرةُ الاشتقاق المكشوفةُ في هذا الملفّ — يفكّ كلَّ رقمِ حسابٍ فيها.
   أي أنّ التعميةَ تصير زينةً تُوهِم من يقرأ المخطَّطَ أنّ البيان محميّ.

   **فلا اشتقاقَ ولا ملفَّ تطويرٍ ولا توليدَ عشوائيّ.** المفتاحُ يُضبط صراحةً
   أو لا تعمل الخانةُ أصلا: `bankVaultEnabled()` تكذب لا تصدق، والكتابةُ
   تُردّ بـ٥٠١ ورسالةٍ عربيّةٍ تقول ما ينقص. **ولا يُخزَّن نصٌّ صريحٌ أبدا
   عند غياب المفتاح** — وهو العطبُ الذي يقع حين تُكتب «تعميةٌ اختياريّة».

   ولا تُولَّد قيمةٌ عشوائيّةٌ عند الإقلاع كما كان يفعل `storage.service` على
   Vercel: مفتاحٌ يتبدّل يعني رقمَ حسابٍ لا يُفكّ أبدا — والدرسُ مكتوبٌ في
   رأس ذلك الملفّ وكلّفَ نشرةً كاملة.

   ═══ والظرفُ يصف نفسَه ═══

   `v1.<iv>.<tag>.<ct>` كلُّها base64url. والإصدارُ في أوّله بقصد: يومَ
   يُدوَّر المفتاحُ أو يُبدَّل المعمّي، تُقرأ الصفوفُ القديمةُ بفرعها ولا
   تُفقَد. وبلا إصدارٍ في الظرف لا سبيلَ إلى معرفة أيِّ خوارزميّةٍ كُتب بها.

   و`AAD` يربط النصَّ المعمّى بصاحبه: نقلُ ظرفٍ من صفِّ مدرّبٍ إلى صفِّ آخرَ
   في القاعدة يُبطل الفكَّ بدل أن يُنتج رقمَ حسابِ رجلٍ باسم رجلٍ آخر. */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { AuthError } from './auth.service'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const ENVELOPE_VERSION = 'v1'
/** اسمُ المتغيّر — يُقرأ في `preflight-env.sh` بالاسم نفسِه */
export const BANK_KEY_ENV = 'BANK_ENC_KEY'
/** ٦٤ خانةً ستّ عشريّة = ٣٢ بايتا */
export const BANK_KEY_PATTERN = /^[0-9a-fA-F]{64}$/

let cached: Buffer | null = null
let cachedFrom = ''

/** يُفرَّغ الخبيءُ بين الاختبارات — على نمط `resetSecretCacheForTests` */
export function resetBankKeyCacheForTests(): void {
  cached = null
  cachedFrom = ''
}

function readKey(): Buffer | null {
  const raw = (process.env[BANK_KEY_ENV] ?? '').trim()
  if (!BANK_KEY_PATTERN.test(raw)) return null
  if (cached && cachedFrom === raw) return cached
  cached = Buffer.from(raw, 'hex')
  cachedFrom = raw
  return cached
}

/** أتعمل الخانةُ أصلا؟ — تُقرأ في الشاشة قبل أن تُعرض، فلا يُطلب ما لا يُحفَظ */
export function bankVaultEnabled(): boolean {
  return readKey() !== null
}

/** يُردّ الطلبُ بعربيّةٍ تقول ما ينقص — لا «خطأ داخليّ» */
export function assertBankVaultEnabled(): void {
  if (bankVaultEnabled()) return
  throw new AuthError(
    'bank_vault_unavailable',
    'خزانةُ الحسابات البنكيّة غيرُ مهيّأةٍ على هذا الخادم — ولا يُحفَظ رقمُ حسابٍ بلا تعمية. '
    + `اضبطْ ${BANK_KEY_ENV} ثمّ أعِدْ المحاولة.`,
    501,
  )
}

/** يُعمّى الرقمُ في ظرفٍ يصف نفسَه — ولا يُنادى إلّا بعد `assertBankVaultEnabled` */
export function sealBankValue(plain: string, aad: string): string {
  const key = readKey()
  if (!key) {
    /* حارسُ العمق: من نادى بلا فحصٍ يُردّ ولا يُكتب نصٌّ صريحٌ في عمود */
    throw new AuthError('bank_vault_unavailable', 'لا مفتاحَ للتعمية — ولا يُحفَظ رقمُ حسابٍ صريحا', 501)
  }
  const value = plain.trim()
  if (!value) throw new AuthError('empty_value', 'لا قيمةَ لتُعمّى', 422)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    ENVELOPE_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join('.')
}

/** يُفكّ الظرفُ — ويُردّ بوضوحٍ إن بُدّل تحته أو نُقل من صفٍّ إلى صفّ */
export function openBankValue(sealed: string, aad: string): string {
  const key = readKey()
  if (!key) {
    throw new AuthError(
      'bank_vault_unavailable',
      `خزانةُ الحسابات البنكيّة غيرُ مهيّأةٍ على هذا الخادم — اضبطْ ${BANK_KEY_ENV}`,
      501,
    )
  }
  const parts = String(sealed ?? '').split('.')
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new AuthError('bad_envelope', 'ظرفُ التعمية غيرُ مفهوم — لا يُقرأ هذا الصفّ', 500)
  }
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(parts[1], 'base64url'))
    decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    /* فشلُ الوسم: مفتاحٌ آخر، أو ظرفٌ بُدّل، أو نُقل من صاحبه إلى غيره.
       ولا يُفرَّق بينها في الرسالة — من يجرّب لا يُعان على التمييز. */
    throw new AuthError(
      'bank_open_failed',
      'تعذّر فكُّ رقم الحساب — إمّا أنّ المفتاح تبدّل أو أنّ الصفَّ مسّه شيء. لا يُصرَف على هذا قبل مراجعته.',
      500,
    )
  }
}

/** رباطُ الظرف بصاحبه — يُبنى في موضعٍ واحدٍ فلا يفترق بين الكتابة والقراءة */
export function bankAad(profileId: string): string {
  return `wajeez:bank:${ENVELOPE_VERSION}:${profileId}`
}

/** أهذان الظرفان لقيمةٍ واحدة؟ — بلا فكٍّ، وبمقارنةٍ ثابتةِ الزمن */
export function sameSealedBytes(a: string, b: string): boolean {
  const x = Buffer.from(String(a ?? ''), 'utf8')
  const y = Buffer.from(String(b ?? ''), 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}
