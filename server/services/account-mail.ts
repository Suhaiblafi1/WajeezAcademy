/* رسائل الحساب — توثيق البريد واستعادة كلمة المرور.

   لماذا ملفّ منفصل: المسارات لا ينبغي أن تعرف نصّ الرسالة ولا شكل الرابط،
   وخدمة المصادقة لا ينبغي أن تعرف قناة الإرسال. هذا الملفّ يجمع بينهما في
   مكان واحد يُقرأ ويُختبر ويُغيَّر نصّه بلا مساس بالمنطق.

   ولا يبتلع الفشل: يعيد حالة الإرسال إلى المُنادي ليقرر ماذا يقول للمستخدم.
   «أُرسلت» حين لا بريد كذبةٌ تجعل المستخدم ينتظر رسالة لن تصل. */

import type { PrismaClient } from '@prisma/client'
import { sendDirectEmail, publicSiteUrl, type DirectMailResult } from './notification.service'

export function verifyEmailLink(token: string): string {
  return `${publicSiteUrl()}/auth/verify?token=${encodeURIComponent(token)}`
}

export function resetPasswordLink(token: string): string {
  return `${publicSiteUrl()}/auth/reset?token=${encodeURIComponent(token)}`
}

/** رابطُ الدعوة — الصفحةُ نفسُها، والنصُّ الذي حولَه هو ما يفترق */
export function inviteLink(token: string): string {
  return resetPasswordLink(token)
}

export async function sendVerifyEmail(
  prisma: PrismaClient,
  input: { to: string; displayName: string; token: string },
): Promise<DirectMailResult> {
  const link = verifyEmailLink(input.token)
  return sendDirectEmail(prisma, {
    to: input.to,
    subject: 'وثّق بريدك — أكاديمية وجيز',
    text:
      `مرحبا ${input.displayName.trim() || 'بك'},\n\n` +
      `لتفعيل الشراء واستلام الشهادة نحتاج أن نتأكّد أن هذا البريد يصلك.\n` +
      `افتح هذا الرابط خلال ٤٨ ساعة:\n${link}\n\n` +
      `يمكنك الدخول وتصفّح المنصّة والتشخيص من غير هذه الخطوة — التوثيق مطلوب للشراء والشهادة فقط.\n\n` +
      `إن لم تكن أنت من أنشأ الحساب فتجاهل هذه الرسالة.\n— أكاديمية وجيز`,
  })
}

export async function sendPasswordResetEmail(
  prisma: PrismaClient,
  input: { to: string; token: string },
): Promise<DirectMailResult> {
  const link = resetPasswordLink(input.token)
  return sendDirectEmail(prisma, {
    to: input.to,
    subject: 'استعادة كلمة المرور — أكاديمية وجيز',
    text:
      `وصلنا طلب استعادة كلمة المرور لحسابك.\n\n` +
      `عيّن كلمة مرور جديدة من هذا الرابط خلال ساعة:\n${link}\n\n` +
      `تعيين كلمة مرور جديدة يُخرجك من كل الأجهزة.\n` +
      `إن لم تطلب هذا فتجاهل الرسالة — كلمتك الحالية باقية كما هي.\n— أكاديمية وجيز`,
  })
}

/* ─────────── دعوةُ حسابٍ إداريّ ───────────

   قرارُ صاحب المنصّة: «أضف مسارا ينشئ حسابا جديدا مباشرة (بريد + دور)،
   ويرسل بريدا تلقائيا للمستخدم الجديد **يوضّح دوره ووظيفته على المنصّة**
   وخطوة تفعيل حسابه».

   والرسالةُ تقول ثلاثة لا واحدا: مَن أنشأ الحساب، وما الدورُ وماذا يفتح،
   وكيف يُفعَّل. فمن يصله رابطٌ بلا سياقٍ يظنّه تصيّدا — وأخطرُ ما في دعوةٍ
   إداريّة أن تُقرأ رسالةً مشبوهة فتُتجاهل أو يُبلَّغ عنها.

   ولا كلمةَ مرورٍ في الرسالة: يُنشأ الحسابُ بكلمةٍ عشوائيّة لا يعرفها أحد،
   ويعيّن صاحبُه كلمتَه من رابطٍ مؤقّت. فكلمةٌ تُرسَل بالبريد تبقى فيه. */
export async function sendStaffInviteEmail(
  prisma: PrismaClient,
  input: { to: string; displayName: string; token: string; roleNamesAr: string[]; invitedByAr: string; dutiesAr: string[] },
): Promise<DirectMailResult> {
  const link = resetPasswordLink(input.token)
  const roles = input.roleNamesAr.join('، ')
  const duties = input.dutiesAr.length > 0
    ? `\nوهذا ما يفتحه لك:\n${input.dutiesAr.map((d) => `· ${d}`).join('\n')}\n`
    : ''
  return sendDirectEmail(prisma, {
    to: input.to,
    subject: `حسابك في أكاديمية وجيز — ${roles}`,
    text:
      `مرحبا ${input.displayName.trim() || 'بك'},\n\n` +
      `أنشأ لك ${input.invitedByAr} حسابا في منصّة أكاديمية وجيز بدور: ${roles}.\n` +
      duties +
      `\nلتفعيل حسابك عيّن كلمة مرورك من هذا الرابط:\n${link}\n\n` +
      `الرابط صالحٌ سبعةَ أيّام. فإن انتهى فاطلب من مُنشئ حسابك إعادةَ إرسال الدعوة، أو استعمل «نسيت كلمة المرور» ببريدك هذا.\n\n` +
      `إن لم تكن تتوقّع هذه الدعوة فلا تفتح الرابط، وأبلغ من أرسلها إليك.\n— أكاديمية وجيز`,
  })
}
