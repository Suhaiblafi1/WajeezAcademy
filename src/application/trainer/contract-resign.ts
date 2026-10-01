/* «حُدّث النصُّ — أعِدْه للتوقيع» — ما يتقاسمه الخادمُ والشاشة.
 *
 * ═══ السؤالُ الذي يجيب عنه ═══
 *
 * مدرّبٌ وقّع إصدارا سابقا من المتن ولم نعتمده بعد. فنسحب عرضَه ونعرض عليه
 * الحاضر — برسالةٍ **يكتبها صاحبُ المنصّة لكلّ مدرّبٍ كما يشاء**. وقولُه
 * (١ أكتوبر ٢٠٢٦): «اعطني فرصة تعديل النص وعنوانها كما اشاء فهناك اضافات قد
 * اضيفها لكل مدرب خصيصا بحسب ما اريده ان يركز عليه».
 *
 * فالعنوانُ والنصُّ هنا **مسوّدتان** تُملآن بهما الخانتان ثمّ تُحرَّران.
 * وما لا يُحرَّر قائمةُ التغييرات وحدَها — تُلحق بالرسالة في الخادم
 * (`contractResignMail`)، وعلّتُها هناك.
 */

import type { ChangeGroup } from './contract-changelog'
import { feeBasisAr, type ContractCompensation } from './contract-body'

export const RESIGN_SUBJECT_MIN = 3
export const RESIGN_SUBJECT_MAX = 200
export const RESIGN_BODY_MIN = 10
export const RESIGN_BODY_MAX = 6000

/** سببُ الإغلاق. ولا يبدأ بـ«رُفض التوقيع» بقصد: شاشةُ العقود تبني لوحَ رفض
 *  التوقيع على تلك البادئة، وهذا سحبٌ لا رفض. ولا يحمل رمزَي الإصدارين
 *  (١ أكتوبر ٢٠٢٦: «no need») — فهو يُعرَض، والإصداران في الأثر
 *  (`fromVersion` و`toVersion`). */
export const RESIGN_REVOKE_REASON_AR = 'أُعيد للتوقيع على نصٍّ محدَّث'

/** عنوانُ القسم الذي لا يُحذَف من الرسالة */
export const RESIGN_CHANGES_HEADING_AR = 'ما تغيّر في نصّ عقدك'

export const DEFAULT_RESIGN_SUBJECT_AR = 'شكرا لتوقيعك — وعقدُك عاد إليك محدَّثا'

/** النصُّ المقترَح. والفقرةُ الأخيرةُ تبقى فيه بقصد: تقول للمدرّب إنّ له
 *  أن يعتذر بلا تبعة (البند 2-11) — وهي ما يحمي الأكاديميّةَ من قولٍ بعدُ
 *  إنّه حُمل على التوقيع ثانيةً. */
export function defaultResignBodyAr(title: string, hasChanges = true): string {
  return [
    `شكرا لك على توقيع «${title}». ولم تكن الأكاديميّةُ قد اعتمدت توقيعَها بعد، فلم تصر الاتفاقيّةُ نافذةً بيننا (البند 2-6). ولا شيءَ في توقيعك: هو صحيحٌ ومسجَّلٌ عندنا بتاريخه.`,
    /* ═══ ومن وقّع الإصدارَ الحاضرَ لا يُوعَد بقائمة (١ أكتوبر ٢٠٢٦) ═══

       كان النصُّ يقول «وما تغيّر فيها مبيَّنٌ أدناه» لكلّ مدرّب، فمن وقّع
       الإصدارَ الحاضرَ نفسَه قرأ وعدا بقائمةٍ لا تأتي — إذ لا تغييرَ بين
       نصّه والحاضر. بلاغُ صاحب المنصّة: «ولا يوجد أيُّ شيءٍ أدناه». فيُقال
       له ما يصدق، وتقول الرسالةُ تحته إنّ عقده لم يتغيّر. */
    hasChanges
      ? 'وقد راجعنا نصَّ الاتفاقيّة على ملاحظاتٍ وصلتنا من مدرّبين ومن مختصّين، فحدّثناه ليكون أوضحَ للطرفين. ونعرض عليك النسخةَ المحدَّثةَ لتوقّعها، وما تغيّر فيها مبيَّنٌ أدناه.'
      : 'ونعرض عليك عقدَك لتوقّعه من جديدٍ برابطٍ جديد.',
    hasChanges
      ? 'ولك أن توقّع المحدَّثةَ أو تعتذر عنها، ولا يترتّب على أيٍّ منهما شيءٌ عليك ولا لنا (البند 2-11). ورابطُها في آخر هذه الرسالة.'
      : 'ولك أن توقّعه أو تعتذر عنه، ولا يترتّب على أيٍّ منهما شيءٌ عليك ولا لنا (البند 2-11). ورابطُه في آخر هذه الرسالة.',
  ].join('\n\n')
}

/** ما يُقال لمن لا تغييرَ بين نصّه والحاضر — في الرسالة، ومعاينتُه في الشاشة */
export const RESIGN_NO_CHANGES_AR = 'لم يتغيّر شيءٌ في بنود عقدك منذ آخر توقيعٍ لك.'

/* ═══ ومن طلب تعديلا لم يوقّع شيئا (١ أكتوبر ٢٠٢٦) ═══

   صار قبولُ طلب التعديل يمرّ من باب الإعادة للتوقيع نفسِه (#400)، فورث جملتَه
   حين لا تغيير: «منذ آخر توقيعٍ لك» — ومن طلب تعديلا لم يوقّع. رآها صاحبُ
   المنصّة في معاينة نافذة القبول، وأمر بإصلاحها. فلكلّ بابٍ جملتُه، والتغييرُ
   في الثاني يُقاس ممّا قرأه قبل طلبه (`versionReadByRequester`) — فجملتُه تقول
   ذلك بعينه. */
export const AMENDMENT_NO_CHANGES_AR = 'لم يتغيّر شيءٌ في بنود العقد عمّا قرأتَه قبل طلبك.'

/** بابا النافذة: الإعادةُ للتوقيع، وقبولُ طلب التعديل */
export type ReissueMode = 'resign' | 'amendment'

/** جملةُ «لا تغيير» لكلّ باب — يقرؤها الخادمُ لما يُرسَل والشاشةُ لما تُعاينه */
export function noChangesLineAr(mode: ReissueMode): string {
  return mode === 'amendment' ? AMENDMENT_NO_CHANGES_AR : RESIGN_NO_CHANGES_AR
}

/** نصُّ الموظّف فقراتٍ — يفصل بينها سطرٌ فارغ، كما يُكتب في الخانة */
export function resignParagraphs(bodyAr: string): string[] {
  return bodyAr.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/* ═══ وما تغيّر في شروطه هو — لا في القالب وحدَه (١ أكتوبر ٢٠٢٦) ═══

   صارت الإعادةُ تقبل تغييرَ أتعابه ودوراتِه وبنودِه الخاصّة. والقسمُ الذي لا
   يُحذَف من الرسالة («ما تغيّر في نصّ عقدك») كان يعدّ تغييرَ القالب وحدَه —
   فلو خُفّض أجرُه في الإعادة لَوصلته رسالةٌ تعدّ تحسينَ الصياغة وتسكت عن
   أجره. وهي العلّةُ نفسُها التي جعلت القسمَ لا يُحذَف أصلا.

   فيُحسب هنا ما تغيّر **فيه هو** ويتقدّم القائمة. والدالّةُ خالصةٌ يقرؤها
   الخادمُ لما يُرسَل والشاشةُ لما تُعاينه — فما يُعايَن هو ما يُرسَل. */

export interface ResignTerms {
  compensation: ContractCompensation | null
  courses: readonly { courseId: string; titleAr: string }[]
  specialTermsAr: string | null
}

/* والأجرُ يُقابَل بأرقامه لا بنصّه: «25» و«25.00» أجرٌ واحد */
function sameFee(a: ContractCompensation | null, b: ContractCompensation | null): boolean {
  if (!a || !b) return a === b
  return a.type === b.type
    && Number(a.rate) === Number(b.rate)
    && a.currency === b.currency
    && (a.minSeats ?? 0) === (b.minSeats ?? 0)
    && Number(a.referralRate ?? 0) === Number(b.referralRate ?? 0)
}

const NO_FEE_AR = 'بلا أجرٍ متّفقٍ عليه'

/** ما تغيّر في شروطه هو — جملةً لكلّ تغيير، و`[]` لما لم يتغيّر فيه شيء */
export function personalChangesAr(before: ResignTerms, after: ResignTerms): string[] {
  const out: string[] = []
  if (!sameFee(before.compensation, after.compensation)) {
    const was = before.compensation ? feeBasisAr(before.compensation) : NO_FEE_AR
    const now = after.compensation ? feeBasisAr(after.compensation) : NO_FEE_AR
    out.push(`تغيّر أساسُ أتعابك (الملحق ب) — كان: ${was} وصار: ${now}`)
  }
  const had = new Set(before.courses.map((c) => c.courseId))
  const has = new Set(after.courses.map((c) => c.courseId))
  const added = after.courses.filter((c) => !had.has(c.courseId)).map((c) => c.titleAr)
  const removed = before.courses.filter((c) => !has.has(c.courseId)).map((c) => c.titleAr)
  if (added.length > 0) out.push(`أُضيف إلى الدورات المؤهَّل لها (الملحق أ): ${added.join('، ')}.`)
  if (removed.length > 0) out.push(`ورُفع من الدورات المؤهَّل لها (الملحق أ): ${removed.join('، ')}.`)
  const sb = (before.specialTermsAr ?? '').trim()
  const sa = (after.specialTermsAr ?? '').trim()
  if (!sb && sa) out.push('وأُضيفت إلى عقدك بنودٌ خاصّةٌ بك (البند 21) — اقرأها في العقد.')
  else if (sb && !sa) out.push('ورُفعت من عقدك البنودُ الخاصّةُ بك (البند 21).')
  else if (sb !== sa) out.push('وتغيّرت البنودُ الخاصّةُ بك (البند 21) — اقرأها في العقد.')
  return out
}

/* ═══ وشروطُه هو بطاقةٌ أولى قبل أبواب القالب ═══

   ما تغيّر فيه هو (أتعابُه ودوراتُه وبنودُه الخاصّة) يتقدّم ما تغيّر في
   القالب — علّتُه فوق `personalChangesAr`. وبعد أن صارت أبوابُ القالب
   بطاقاتٍ تحت بنودها صار هذا بطاقةً باسمها، تُقرأ أوّلا. والدالّةُ واحدةٌ
   للخادم والشاشة، فما يُعايَن هو ما يُرسَل. */
export const PERSONAL_CHANGES_TITLE_AR = 'شروطُك أنت'

export function resignChangeGroups(
  personalAr: readonly string[], templateGroups: readonly ChangeGroup[],
): readonly ChangeGroup[] {
  return personalAr.length > 0
    ? [{ titleAr: PERSONAL_CHANGES_TITLE_AR, itemsAr: personalAr }, ...templateGroups]
    : templateGroups
}

/* ═══════════ قبولُ طلب التعديل — عقدُه المصحَّحُ في الرسالة نفسِها ═══════════

   أمرُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): «محمّد لم يستلم شيئا وأريدك أن تفعّل
   الأولى» — أي أن يصل من قُبل طلبُ تعديله **جوابُنا وعقدُه المصحَّحُ معا**:
   نصٌّ يكتبه الموظّفُ كما يشاء، ثمّ ما تغيّر بطاقاتٍ تحت بنودها، ثمّ زرُّ
   التوقيع. وكان قبلها رسالتان: «قبلنا طلبك ويصلك عقدٌ مصحَّح» بلا رابط، ثمّ
   بريدُ العقد العامُّ بلا قائمةٍ حين يُنشئه أحدٌ بيده — إن تذكّر.

   فالبابُ هو بابُ الإعادة للتوقيع نفسُه (`requestResign`) بمسوّدةٍ أخرى. */

export const DEFAULT_AMENDMENT_ACCEPT_SUBJECT_AR = 'قبلنا ملاحظاتِك — وهذا عقدُك المصحَّح'

/** ما يُكتب في مسوّدة النصّ ليُستبدَل — ولا يخرج إلى مدرّبٍ وهو فيها.
 *  فمن نسي أن يكتب ما قبله وصلت المدرّبَ جملةٌ تقول «اكتب هنا»؛ والخادمُ
 *  والشاشةُ يردّانه بها (`hasAmendmentPlaceholder`). */
export const AMENDMENT_PLACEHOLDER_AR = '[اكتب هنا ما قبلتَه من ملاحظاته — وما لم تقبله ولماذا]'

export function hasAmendmentPlaceholder(bodyAr: string): boolean {
  return bodyAr.includes(AMENDMENT_PLACEHOLDER_AR)
}

/** المسوّدة. و`replyAr` ما كتبه الموظّفُ في لوح الطلب قبل أن يفتح النافذة —
 *  يحلّ محلّ السطر الذي يُستبدَل، فلا يُكتب الجوابُ مرّتين. */
export function defaultAmendmentAcceptBodyAr(title: string, replyAr?: string | null): string {
  const reply = (replyAr ?? '').trim()
  return [
    `شكرا لك على ملاحظاتك على «${title}». قرأناها كلَّها، وهذا جوابُنا:`,
    reply.length > 0 ? reply : AMENDMENT_PLACEHOLDER_AR,
    'وأعددنا لك العقدَ مصحَّحا بما قبلناه، ورابطُه في آخر هذه الرسالة. والنسخةُ السابقةُ أُلغيت ورابطُها بطل — فوقّع هذه وحدَها.',
    'ولك أن توقّعه أو تعتذر عنه، ولا يترتّب على أيٍّ منهما شيءٌ عليك ولا لنا (البند 2-11).',
  ].join('\n\n')
}

/** سببُ إغلاق العرض القديم. ويبدأ بما كان يبدأ به («قُبل طلبُ التعديل»):
 *  هو ما تقرؤه الشاشةُ والأثرُ منذ ٢٦ سبتمبر. */
export const AMENDMENT_ACCEPT_REVOKE_REASON_AR = 'قُبل طلبُ التعديل، وأُرسل عقدٌ مصحَّح'

/* ═══ وأيَّ إصدارٍ قرأ صاحبُ الطلب؟ ═══

   «حدِّث نصَّ العروض المفتوحة» يكتب المتنَ الحاضرَ فوق عرضٍ طُلب تعديلُه —
   فبعد التحديث يقول صفُّه `bodyVersion = الحاضر`، وصاحبُه قرأ ما قبله.
   ولو قيست التغييراتُ من `bodyVersion` لَقالت الرسالةُ «لا تغيير» عن نصٍّ
   تغيّر تحته: وهو بعينه حالُ محمّد (١ أكتوبر ٢٠٢٦) — طلب تعديلا على v21
   ثمّ حُدّث عرضُه إلى v22.

   فما قرأه: `bodyPrevVersion` إن حُدّث بعد طلبه، وإلّا `bodyVersion`.
   وحدُّه: تحديثان بعد الطلب يُبقيان أحدثَ السابقَين وحدَه — فتسقط نقاطُ
   الأوّل. والتحديثُ يقع عند تغيّر الإصدار، أي نادرا؛ ويُقرأ النصُّ كاملا
   قبل التوقيع على كلّ حال. */
export function versionReadByRequester(row: {
  bodyVersion: string | null
  bodyPrevVersion?: string | null
  bodyUpdatedAt?: Date | string | null
  amendmentRequestedAt?: Date | string | null
}): string | null {
  const updated = row.bodyUpdatedAt ? new Date(row.bodyUpdatedAt).getTime() : null
  const asked = row.amendmentRequestedAt ? new Date(row.amendmentRequestedAt).getTime() : null
  if (updated !== null && asked !== null && updated > asked && row.bodyPrevVersion) {
    return row.bodyPrevVersion
  }
  return row.bodyVersion
}
