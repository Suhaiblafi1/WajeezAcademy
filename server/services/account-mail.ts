/* رسائل الحساب — توثيق البريد واستعادة كلمة المرور.

   لماذا ملفّ منفصل: المسارات لا ينبغي أن تعرف نصّ الرسالة ولا شكل الرابط،
   وخدمة المصادقة لا ينبغي أن تعرف قناة الإرسال. هذا الملفّ يجمع بينهما في
   مكان واحد يُقرأ ويُختبر ويُغيَّر نصّه بلا مساس بالمنطق.

   ولا يبتلع الفشل: يعيد حالة الإرسال إلى المُنادي ليقرر ماذا يقول للمستخدم.
   «أُرسلت» حين لا بريد كذبةٌ تجعل المستخدم ينتظر رسالة لن تصل. */

import type { PrismaClient } from '@prisma/client'
import { sendDirectEmail, publicSiteUrl, type DirectMailResult } from './notification.service'
import { renderMail } from './mail-template'

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
    ...renderMail({
      greetingName: input.displayName,
      heading: 'خطوةٌ واحدة لتوثيق بريدك',
      blocks: [
        { kind: 'p', text: 'لتفعيل الشراء واستلام الشهادة نحتاج أن نتأكّد أن هذا البريد يصلك.' },
        { kind: 'cta', label: 'وثّق بريدي الآن', href: link, caption: 'أو انسخ الرابط:' },
        { kind: 'callout', text: 'الرابط صالحٌ ثمانيَ وأربعين ساعة.' },
        { kind: 'p', text: 'ويمكنك الدخول وتصفّح المنصّة والتشخيص من غير هذه الخطوة — التوثيق مطلوبٌ للشراء والشهادة فقط.' },
        { kind: 'note', text: 'إن لم تكن أنت من أنشأ الحساب فتجاهل هذه الرسالة.' },
      ],
    }),
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
    ...renderMail({
      heading: 'استعادةُ كلمة المرور',
      blocks: [
        { kind: 'p', text: 'وصلنا طلبُ استعادة كلمة المرور لحسابك.' },
        { kind: 'cta', label: 'عيّن كلمة مرور جديدة', href: link, caption: 'أو انسخ الرابط:' },
        { kind: 'callout', text: 'الرابط صالحٌ ساعةً واحدة، وتعيينُ كلمةٍ جديدة يُخرجك من كلّ الأجهزة.' },
        { kind: 'note', text: 'إن لم تطلب هذا فتجاهل الرسالة — كلمتك الحالية باقيةٌ كما هي.' },
      ],
    }),
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
  return sendDirectEmail(prisma, {
    to: input.to,
    subject: `حسابك في أكاديمية وجيز — ${roles}`,
    ...renderMail({
      greetingName: input.displayName,
      heading: `أُنشئ لك حسابٌ في منصّة أكاديمية وجيز`,
      blocks: [
        { kind: 'facts', rows: [
          { label: 'من أنشأه', value: input.invitedByAr },
          { label: 'دورك', value: roles },
        ] },
        ...(input.dutiesAr.length > 0
          ? ([{ kind: 'h', text: 'وهذا ما يفتحه لك' }, { kind: 'list', items: input.dutiesAr }] as const)
          : []),
        { kind: 'cta', label: 'فعّل حسابك وعيّن كلمتك', href: link, caption: 'أو انسخ الرابط:' },
        { kind: 'callout', text: 'الرابط صالحٌ سبعةَ أيّام. فإن انتهى فاطلب إعادةَ إرسال الدعوة، أو استعمل «نسيت كلمة المرور» ببريدك هذا.' },
        { kind: 'note', text: 'ولا كلمةَ مرورٍ في هذه الرسالة: تختارها بنفسك من الرابط. وإن لم تكن تتوقّع الدعوة فلا تفتحه، وأبلغ من أرسلها إليك.' },
      ],
    }),
  })
}
