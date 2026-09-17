/* رسالةُ الإشعار — من نصٍّ خامٍّ إلى الهيئة التي ترثها بقيّةُ الرسائل (ط-١).

   ═══ ما كان ═══

   `ResendEmailProvider` كان يرسل `{ subject: title, text: body }` — **بلا
   HTML إطلاقا**. فبينما رسائلُ التوثيق وكلمةِ المرور وطلبِ الانضمام تخرج
   على قالبٍ له ترويسةٌ وحشوٌ وزرٌّ وتذييل، كان تيّارُ الإشعارات — وهو
   أكثرُها عددا بفارقٍ بعيد: كلُّ تذكيرِ جلسةٍ ودرجةٍ وإيصالٍ وشهادة — يصل
   سطرا أعزلَ يقرّر عميلُ البريد شكلَه.

   ═══ وما صار ═══

   المرورُ نفسُه على `mail-template`: ترويسةٌ واحدة، وحشوٌ واحد، وتذييلٌ
   واحد، والنصُّ الخامُّ يُولَّد من المصدر نفسِه فلا ينحرف عن الـHTML.

   وثلاثةُ أشياءَ تزيد على مجرّد التنسيق:

   ① **زرٌّ يذهب إلى الخبر** — «وصلت درجتك» بلا رابطٍ يترك صاحبَها يبحث.
      والوجهةُ في `destinations.ts` بحسب المفتاح **والجمهور**.
   ② **وزرٌّ لا يُخترَع** — ما لا وجهةَ له يخرج بلا زرّ. وزرٌّ يفتح شاشةً
      لا خبرَ فيها أسوأُ من لا زرّ.
   ③ **ورابطُ التفضيلات على ما يُكتَم وحدَه** — ومن لا يملك كتمَه لا يُعرض
      له بابٌ إلى قفل. وشاشةُ التفضيلات في بوّابة المتعلّم وحدَها اليوم،
      فلا يُوعَد بها من لا يبلغها.

   ═══ وسطرُ الرؤية؟ لا ═══

   اقترحتُ في ط-٤ سطرا يحمل رؤيةَ الأكاديميّة تحت كلِّ رسالة (م-١ إلى
   م-٢٢). وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): **لا جُمَل** — رسائلُ
   مهنيّةٌ حسنةُ الإخراج وكفى. فسقط البندُ كلُّه، ولا يُعاد بابا خلفيّا:
   ما يُضاف إلى الرسالة يكون خبرا أو فعلا، لا موعظة. */

import { renderMail, type MailBlock, type MailDoc } from './mail-template'
import { destinationFor, type MailAudience } from '../../src/application/notifications/destinations'
import { isSilenceable } from '../../src/application/notifications/categories'

export interface NotificationMailInput {
  title: string
  body: string
  templateKey?: string | null
  audience?: MailAudience
  /** جذرُ الموقع بلا شرطةٍ في آخره — `publicSiteUrl()` */
  siteUrl: string
  /** اسمُ صاحبِ الرسالة إن عُرف — «مرحبا فلان،» */
  greetingName?: string | null
}

/** مسارُ شاشةِ التفضيلات — وهي في بوّابة المتعلّم وحدَها اليوم */
const PREFS_PATH = '/student/notifications'

/* المتنُ فقراتٌ لا كتلةً واحدة: ما كتبه المُنتِجُ قد يحمل أسطرا، وسطرٌ
   مفصولٌ عن سطرٍ في المصدر يُقرأ مفصولا في الرسالة. */
function bodyBlocks(body: string): MailBlock[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text): MailBlock => ({ kind: 'p', text }))
}

/** يبني وصفَ الرسالة من إشعارٍ — ثمّ يولّد `mail-template` الصيغتَين منه */
export function notificationMailDoc(input: NotificationMailInput): MailDoc {
  const audience: MailAudience = input.audience ?? 'learner'
  const blocks: MailBlock[] = bodyBlocks(input.body)
  /* متنٌ فارغ: العنوانُ وحدَه خبرٌ ناقص، فيُعاد نصّا حتّى لا تخرج رسالةٌ جوفاء */
  if (blocks.length === 0) blocks.push({ kind: 'p', text: input.title })

  const dest = destinationFor(input.templateKey, audience)
  if (dest) {
    blocks.push({
      kind: 'cta',
      label: dest.ctaAr,
      href: `${input.siteUrl}${dest.path}`,
    })
  }

  /* ورابطُ التفضيلات لمن يملك كتمَ هذا الصنف فعلا — ولمن يبلغ الشاشةَ.
     ومن لا يُكتَم إشعارُه (إيصالٌ أو شهادةٌ أو تكليفُ عمل) لا يُعرض له بابٌ
     يظنّه مفتوحا ثمّ يجده مقفلا. */
  if (audience === 'learner' && isSilenceable(input.templateKey)) {
    blocks.push({
      kind: 'note',
      text: 'تصلك هذه الرسائلُ لأنّك مشترك في تنبيهاتها، ولك أن توقفها:',
      link: { label: 'غيّر تفضيلاتِ رسائلك', href: `${input.siteUrl}${PREFS_PATH}` },
    })
  }

  return {
    ...(input.greetingName ? { greetingName: input.greetingName } : {}),
    heading: input.title,
    blocks,
  }
}

/** الصيغتان معا — وهو ما يُسلَّم إلى `sendEmail` */
export function renderNotificationMail(input: NotificationMailInput): { text: string; html: string } {
  return renderMail(notificationMailDoc(input))
}
