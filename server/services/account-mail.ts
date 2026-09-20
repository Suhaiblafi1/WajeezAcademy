/* رسائل الحساب — توثيق البريد واستعادة كلمة المرور.

   لماذا ملفّ منفصل: المسارات لا ينبغي أن تعرف نصّ الرسالة ولا شكل الرابط،
   وخدمة المصادقة لا ينبغي أن تعرف قناة الإرسال. هذا الملفّ يجمع بينهما في
   مكان واحد يُقرأ ويُختبر ويُغيَّر نصّه بلا مساس بالمنطق.

   ولا يبتلع الفشل: يعيد حالة الإرسال إلى المُنادي ليقرر ماذا يقول للمستخدم.
   «أُرسلت» حين لا بريد كذبةٌ تجعل المستخدم ينتظر رسالة لن تصل. */

import type { PrismaClient } from '@prisma/client'
import { sendDirectEmail, publicSiteUrl, type DirectMailResult } from './notification.service'
import { renderMail } from './mail-template'
import { MAIL_LINK_WINDOW_AR, RESET_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'

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
        { kind: 'cta', label: 'وثّق بريدي الآن', href: link },
        { kind: 'callout', text: `الرابط صالحٌ ${MAIL_LINK_WINDOW_AR}.` },
        { kind: 'p', text: 'ويمكنك الدخول وتصفّح المنصّة والتشخيص من غير هذه الخطوة — التوثيق مطلوبٌ للشراء والشهادة فقط.' },
        { kind: 'note', text: 'إن لم تكن أنت من أنشأ الحساب فتجاهل هذه الرسالة.' },
      ],
    }),
  })
}

/* ═══ تذكيرُ التوثيق — اثنان ثمّ صمتٌ دائم (ي-٥) ═══

   ولمَ رسالةٌ أخرى ولا يُعاد إرسالُ رسالةِ التوثيق نفسِها: لأنّ الثانيةَ
   يجب أن **تقول إنّها الأخيرة**. ومن لم يُقَل له ذلك يبقى يتوقّع ثالثةً
   ورابعةً، أو — وهو الأسوأ — يتعلّم أنّ رسائلنا تتكرّر فيتوقّف عن قراءتها.
   والوعدُ بالكفّ يُشترى بكلمةٍ واحدة، ويُوفى.

   والنبرةُ لا تُلام ولا تُلحّ: التوثيقُ ليس واجبا على أحد، وإنّما هو شرطُ
   شراءٍ وشهادةٍ يُقال كما هو. */
export async function sendVerifyReminderEmail(
  prisma: PrismaClient,
  input: { to: string; displayName: string; token: string; last: boolean },
): Promise<DirectMailResult> {
  const link = verifyEmailLink(input.token)
  return sendDirectEmail(prisma, {
    to: input.to,
    subject: input.last ? 'تذكيرٌ أخير بتوثيق بريدك — أكاديمية وجيز' : 'بقي توثيقُ بريدك — أكاديمية وجيز',
    ...renderMail({
      greetingName: input.displayName,
      preheader: `رابطٌ جديدٌ صالحٌ ${MAIL_LINK_WINDOW_AR}.`,
      heading: input.last ? 'تذكيرٌ أخير: بريدُك غيرُ موثَّقٍ بعد' : 'بريدُك غيرُ موثَّقٍ بعد',
      blocks: [
        { kind: 'p', text: 'أنشأتَ حسابَك عندنا ولم تُكمل توثيقَ بريدك. والرابطُ الأوّلُ انتهت صلاحيّتُه، فهذا رابطٌ جديد.' },
        { kind: 'cta', label: 'وثّق بريدي الآن', href: link },
        { kind: 'callout', text: `الرابط صالحٌ ${MAIL_LINK_WINDOW_AR}.` },
        { kind: 'p', text: 'والدخولُ والتصفّحُ والتشخيصُ تعمل كلُّها من غير هذه الخطوة — التوثيقُ مطلوبٌ للشراء والشهادة فقط.' },
        /* وهذا هو السطرُ الذي من أجله كُتبت هذه الرسالةُ منفصلةً */
        input.last
          ? { kind: 'note' as const, text: 'وهذا آخرُ تذكيرٍ نرسله في هذا الشأن. ويبقى بابُ التوثيق مفتوحا في إعدادات حسابك متى شئت.' }
          : { kind: 'note' as const, text: 'إن لم تكن أنت من أنشأ الحساب فتجاهل هذه الرسالة.' },
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
        { kind: 'cta', label: 'عيّن كلمة مرور جديدة', href: link },
        { kind: 'callout', text: `الرابط صالحٌ ${RESET_LINK_WINDOW_AR}، وتعيينُ كلمةٍ جديدة يُخرجك من كلّ الأجهزة.` },
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
        { kind: 'cta', label: 'فعّل حسابك وعيّن كلمتك', href: link },
        { kind: 'callout', text: `الرابط صالحٌ ${MAIL_LINK_WINDOW_AR}. فإن انتهى فاطلب إعادةَ إرسال الدعوة، أو استعمل «نسيت كلمة المرور» ببريدك هذا.` },
        { kind: 'note', text: 'ولا كلمةَ مرورٍ في هذه الرسالة: تختارها بنفسك من الرابط. وإن لم تكن تتوقّع الدعوة فلا تفتحه، وأبلغ من أرسلها إليك.' },
      ],
    }),
  })
}

/* ═══ رسالةُ آخرِ العهد — حسابٌ يُمحى أو يُعمّى (ي-٤) ═══

   ═══ ولمَ بريدٌ لا جرس، ولمَ قبل الفعل لا بعده ═══

   صفُّ `Notification` معلَّقٌ بصاحبه بـ`onDelete: Cascade`: فإشعارٌ يُكتب قبل
   المحو أو بعده **يُحذف مع صاحبه** في الحالَين. والمؤرشَفُ لا يبلغه جرسٌ
   أصلا لأنّ الدخولَ ممنوعٌ على غير `active`. فما يبلغ الإنسانَ في هذين
   البابَين بريدٌ مباشرٌ وحدَه — وهذا هو الحاملُ للحكم.

   ويُرسَل **قبل أن يقع الفعل**، على عرف الأثر نفسِه («الأثرُ قبل المحو»).
   ولا يُدّعى أكثرُ من ذلك: العنوانُ مُلتقَطٌ في متغيّرٍ قبلَه، فلو أُخِّر
   لخرجت الرسالةُ كذلك. لكنّ التقديمَ يمنع أن يعتمد يوما على صفٍّ يوشك أن
   يزول — أو على بريدٍ تُعمّيه المعاملةُ إلى `archived+<id>@wajeez.invalid`
   وهي تجري.

   وهي آخرُ ما يصله منّا على هذا العنوان — فتقول ما جرى ومن يُراجَع، ولا
   تحيله إلى شاشةٍ لم تعد تُفتح له. */
export type AccountErasureKind = 'purge' | 'purge_with_history' | 'reset_purge' | 'reset_archive'

const ERASURE_COPY: Record<AccountErasureKind, { subject: string; heading: string; whatAr: string }> = {
  purge: {
    subject: 'حُذف حسابُك في أكاديمية وجيز',
    heading: 'حُذف حسابُك في أكاديمية وجيز',
    whatAr: 'حُذف حسابُك حذفا نهائيّا، فلم يبقَ لك فيه دخولٌ ولا بيانات.',
  },
  purge_with_history: {
    subject: 'حُذف حسابُك وسجلُّه في أكاديمية وجيز',
    heading: 'حُذف حسابُك وسجلُّه في أكاديمية وجيز',
    whatAr: 'حُذف حسابُك بسجلّه كلِّه: تسجيلاتُك وطلباتُك وشهاداتُك مُحيت معه ولا تُستعاد.',
  },
  reset_purge: {
    subject: 'حُذف حسابُك ضمن إعادة ضبط الحسابات',
    heading: 'حُذف حسابُك في أكاديمية وجيز',
    whatAr: 'تُعيد الأكاديميةُ ضبطَ حساباتها، وحسابُك ضمن ما يُمحى: لا يبقى لك دخولٌ ولا تسجيلاتٌ ولا شهادات.',
  },
  reset_archive: {
    subject: 'أُرشف حسابُك ضمن إعادة ضبط الحسابات',
    heading: 'أُرشف حسابُك في أكاديمية وجيز',
    whatAr: 'أُرشف حسابُك ضمن إعادة ضبط الحسابات: سقط دخولُك وعُمّيت هويّتُك، وبقيت سجلّاتُك محفوظةً للمُحاسَبة.',
  },
}

export interface AccountErasedMailInput {
  to: string
  displayName?: string | null
  reasonAr?: string | null
  kind: AccountErasureKind
}

/* ═══ الصياغةُ تُفصَل عن الإرسال (ي-٦) ═══

   الرسالةُ الواحدةُ تخرج من بابَين: حذفٌ مفردٌ يُرسِل في حينه، ودفعةٌ تكتب
   في طابور البريد ليُفرّغه العاملُ مُمَهَّلا. ولو صيغت في كلٍّ منهما على حدة
   لَافترقتا بعد شهرٍ — وهي رسالةٌ لا يُقرأ خطؤها إلّا عند من لا حسابَ له
   يشكو منه. فالصياغةُ هنا مرّةً واحدة، والبابان يأخذان منها. */
export function accountErasedMail(input: AccountErasedMailInput): { subject: string; text: string; html: string } {
  const copy = ERASURE_COPY[input.kind]
  return {
    subject: copy.subject,
    ...renderMail({
      greetingName: input.displayName ?? undefined,
      heading: copy.heading,
      blocks: [
        { kind: 'p', text: copy.whatAr },
        ...(input.reasonAr?.trim()
          ? [{ kind: 'facts' as const, rows: [{ label: 'السببُ المسجَّل', value: input.reasonAr.trim() }] }]
          : []),
        /* ولا زرٌّ يُخترَع: ما من شاشةٍ تُفتح له بعد هذا. والردُّ على الرسالة
           يصل الدعمَ — وهو البابُ الوحيدُ الباقي، فيُقال صراحةً. */
        { kind: 'callout', text: 'وهذه آخرُ رسالةٍ تصلك منّا على هذا العنوان. فإن كان في الأمر خطأٌ فردَّ عليها وسيصل ردُّك إلى الدعم.' },
      ],
    }),
  }
}

/** الإرسالُ في حينه — للحذف المفرد. والدفعةُ تكتب في الطابور (`outbox.service.ts`). */
export async function sendAccountErasedEmail(
  prisma: PrismaClient,
  input: AccountErasedMailInput,
): Promise<DirectMailResult> {
  return sendDirectEmail(prisma, { to: input.to, ...accountErasedMail(input) })
}
