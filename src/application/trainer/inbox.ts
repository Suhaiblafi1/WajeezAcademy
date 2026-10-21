/* «الرسائل والتنبيهات» في بوّابة المدرّب — قسمةُ ما يصله (٢١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «لم أُعجب بطريقة النوتيفيكيشن في منصّة المدرّب، فهو لا يقرؤها ولا يوجد فيها
   أكشن.. يجب أن تكون منفصلةً وواضحة»، ثمّ «لها لسانان: الرسائلُ السابقة التي أرسلناها له، والتنبيهات..
   ويمكنه الردّ عن طريق الواتساب أو الإيميل». وعُرضت عليه ثلاثةُ مواضع بالصور فاختار «A»: صفحةٌ لها
   بندٌ في القائمة، والجرسُ يفتحها. ثمّ سُئل عمّا في «الرسائل» — وبريدُ المدرّب لا تُحفظ منه نسخة،
   وواتسابُه يُرسَل من الهواتف — فاختار «الإعلانات وحدها».

   فالقسمةُ هنا، نقيّةً تُفحص:
   · **يحتاج منك إجراء** — غيرُ مقروءٍ من صنفٍ ينتظر فعلَه (`ACTION_KEYS`).
   · **للعلم** — غيرُ مقروءٍ لا ينتظر شيئا.
   · **قرأتها** — ما قرأه، أحدثُه أوّلا.
   وإعلانُ الإدارة لا يقع في أيٍّ منها: له لسانُ «الرسائل» يُقرأ فيه كاملا ويُردّ عليه. */

import { ACADEMY_CONTACT_EMAIL } from '@/data/academy-email'
import { ANNOUNCEMENT_TEMPLATE_KEY } from '@/application/trainer/announcement'

/** خانةُ رقم واتساب الردّ في «التكاملات» — وما خلا منها رجع إلى رقم المستشار */
export const TRAINER_REPLY_SPOT = 'trainer_reply'

/* ═══ ما ينتظر فعلَه ═══
   كلُّ مفتاحٍ هنا بابُه فعلٌ يُتمّه هو: يصحّح، أو يقرّر، أو يجيب، أو يوافق. وما سواه خبرٌ يُعلَم:
   لقاءٌ غدا، ومستحقّاتٌ صُرفت، وشعبةٌ أُسندت. والجهلُ بمفتاحٍ يضعه في «للعلم» لا في «يحتاج منك»:
   شارةُ «إجراء» على ما لا إجراءَ فيه تُعلّمه ألّا يصدّقها. */
export const ACTION_KEYS: ReadonlySet<string> = new Set([
  'submission.queued',
  'cohort.plan.submitted',
  'cohort.plan.decision',
  'cohort.session.rejected',
  'trainer.offer.received',
  'trainer.prep.reminder',
  'trainer.poster.submitted',
  'trainer.course_proposal.question',
  'trainer.suggestion.proposed',
  'trainer.contract.materials_returned',
])

export interface InboxAlert {
  id: string
  title: string
  body: string
  status: string
  templateKey?: string | null
  sentAt?: string | null
  createdAt: string
}

export interface SplitAlerts<T> {
  action: T[]
  info: T[]
  read: T[]
}

export const isUnread = (a: { status: string }): boolean => a.status === 'sent'

/** أيحتاج هذا الإشعارُ فعلا منه؟ — بصنفه، لا بنصّه */
export const needsAction = (a: { templateKey?: string | null }): boolean =>
  !!a.templateKey && ACTION_KEYS.has(a.templateKey)

/** القسمةُ الثلاث — والإعلانُ خارجها، وكلُّ قسمٍ أحدثُه أوّلا */
export function splitAlerts<T extends InboxAlert>(items: readonly T[]): SplitAlerts<T> {
  const at = (a: T) => new Date(a.sentAt ?? a.createdAt).getTime()
  const sorted = items
    .filter((a) => a.templateKey !== ANNOUNCEMENT_TEMPLATE_KEY)
    .slice()
    .sort((x, y) => at(y) - at(x))
  return {
    action: sorted.filter((a) => isUnread(a) && needsAction(a)),
    info: sorted.filter((a) => isUnread(a) && !needsAction(a)),
    read: sorted.filter((a) => !isUnread(a)),
  }
}

/* ═══ الردّ — بعنوان الرسالة ═══
   «ويمكنه الردّ عن طريق الواتساب أو الإيميل». والعنوانُ يسبق الردّ جاهزا: من يصله «شكرا، تمّ» على
   واتساب الأكاديميّة لا يعرف عن أيّ إعلانٍ يتكلّم صاحبُه. */
export const replySubjectAr = (title: string): string => `بخصوص: ${title.trim()}`

/** رابطُ البريد — إلى العنوان الواحد الذي يراه الناس (`academy-email.ts`) */
export function replyMailHref(title: string): string {
  return `mailto:${ACADEMY_CONTACT_EMAIL}?subject=${encodeURIComponent(replySubjectAr(title))}`
}

/** نصُّ واتساب الأوّل — العنوانُ وسطرٌ فارغٌ يكتب بعده */
export const replyWhatsAppTextAr = (title: string): string => `${replySubjectAr(title)}\n\n`
