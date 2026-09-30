/* نهاياتُ صفحة التوقيع — ثلاثٌ لا اثنتان.

   ═══ العلّة ═══

   كانت النهايتان اثنتين: يوقّع، أو يعتذر. فمن قرأ العقدَ وأراد تغييرَ بندٍ
   واحدٍ — سطرَ أتعابٍ، أو مدّةَ إخطار — لم يجد إلّا أن **يعتذر عن العرض
   كلِّه** أو **يوقّع على ما لا يرضاه**. وكلاهما خسارة: الأوّلُ يُخرج مدرّبا
   كفئا لأجل فاصلة، والثاني يوقّع وفي نفسه شيءٌ يظهر أوّلَ خلاف.

   والعقدُ **عرضٌ يُفاوَض**، وصفحةُ التوقيع كانت تعامله وثيقةَ إذعان.

   ═══ ولمَ الحالةُ توقف التوقيع ═══

   طلبُ التعديل لا يُغلق العقدَ — الصفُّ باقٍ ينتظر نسخةً مصحّحة. لكنّه
   **يوقف التوقيع** ما دام قائما: فلو جاز أن يوقّع بعده لَجاز أن يوقّع على
   ما طلب تغييرَه بنقرةٍ ثانيةٍ في التبويب نفسِه، ولَما أوقف الطلبُ شيئا.

   والقائمةُ هنا **مصدرُ الحقيقة الوحيد**: الخادمُ والشاشةُ يقرآنها معا، فلا
   يُكرَّر الشرطُ في موضعين ثمّ يفترقان بتعديلٍ في أحدهما. */

import { REVIEW_OPEN_STATUSES } from './approval'

/** الحالةُ الوحيدةُ التي يُقبل فيها ردٌّ من المدرّب على الرابط */
export const CONTRACT_OPEN_STATUSES = ['sent'] as const

/** أيُقبل من المدرّب ردٌّ (توقيعٌ أو اعتذارٌ أو طلبُ تعديل)؟ */
export function canRespondToContract(status: string): boolean {
  return (CONTRACT_OPEN_STATUSES as readonly string[]).includes(status)
}

/** الحالةُ التي يقف عندها العقدُ بانتظارنا نحن لا بانتظاره هو */
export const CONTRACT_AMENDMENT_REQUESTED = 'amendment_requested'

export function isAmendmentRequested(status: string): boolean {
  return status === CONTRACT_AMENDMENT_REQUESTED
}

/** أطولُ ما يُقبل من نصِّ طلب التعديل — يُقتطع ولا يُردّ، فلا يضيع كلامُه */
export const AMENDMENT_TEXT_MAX = 4000

/* ═══ وما أُغلق لا قرارَ فيه (٢٦ سبتمبر ٢٠٢٦) ═══

   عطبٌ شُحن ذلك اليوم: لوحةُ مقابلة الاسمَين في شاشة العقود ترسم على كلِّ
   عقدٍ موقَّعٍ نصيحةً واحدة — «فاردُدِ التوقيعَ، ويُركَّب بديلٌ باسمه» —
   **بما فيه المغلَق**. وفي عقدٍ ملغًى أو مفسوخٍ لا توقيعَ يُردّ: الفرقُ
   بين الاسمَين يبقى سجلّا يُقرأ بعد سنة، والأمرُ الذي معه خطأ.

   ─────────── ولمَ هنا لا في الشاشة ───────────

   هذا السؤالُ ليس سؤالَ `isUntouchableContract`: ذاك يسأل «أمسَّه توقيعٌ؟»
   فيمنع المحوَ، وهذا يسأل «أبقي فيه قرار؟» فيمنع الأمرَ والزرّ. ويفترقان
   في الطرفين: عقدٌ **ملغًى** لم يوقّعه أحدٌ يُحذَف وهو مغلَق، وعقدٌ
   **موقَّعٌ** ينتظر اعتمادَنا لا يُحذَف وهو مفتوح.

   فهما حكمان لا حكمٌ في موضعَين — ويسكنان معا حيث تسكن قوائمُ الحالات:
   في هذا الملفّ، «مصدرُ الحقيقة الوحيد» كما يقول رأسُه. ولا تُكتب قائمةُ
   حالاتٍ باليد في شاشة، فنسختان تفترقان يوما. */

/** ما لا يُتَّخذ فيه قرارٌ بعدُ — أُغلق بابُه بأيِّ وجه */
export const CONTRACT_CLOSED_STATUSES = [
  'revoked', 'terminated', 'declined', 'expired', 'superseded',
] as const

/** أأُغلق هذا العقدُ فلا إجراءَ عليه؟ */
export function isContractClosed(status: string): boolean {
  return (CONTRACT_CLOSED_STATUSES as readonly string[]).includes(status)
}

/* ═══ ومن يُركَّب له عقدٌ جديد — وما يمنعه (٣٠ سبتمبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عن العقود المفسوخة: «ألا يمكن إعادةُ إنشاء عقدٍ آخرَ
   لهم؟». ويمكن: الرحيلُ يفسخ العقدَ ولا يمسّ حالةَ الطلب، فمن رحل يبقى نشطا
   ويظهر في «من ينتظر عقدا». لكنّ البابَ كان في رأس الشاشة، والسؤالُ يُسأل
   عند الصفّ المفسوخ نفسِه — ولا زرَّ هناك.

   ومن أُوقف مع رحيله كان أسوأ: «ركِّبْ عقدا جديدا» في خطوات تجهيزه يركّب
   مسودّةً، ثمّ يُردّ إرسالُها بـ«لا يمكن الانتقال من «suspended» إلى
   «contract_pending»» — رموزٌ لا يقرؤها أحد، ومسودّةٌ يتيمةٌ لا تُرسَل.

   فالحكمُ هنا مرّةً واحدة: الخادمُ يسأله قبل التركيب وعند الإرسال، والشاشةُ
   تسأله لتقول المخرجَ قبل أن يُضغط شيء.

   ويُرسَل العقدُ من كلّ حالةٍ حيّة — ومنها يُنقل الطلبُ إلى «عقد قيد
   التوقيع» — ومن «نشط»، بندا يُوثَّق بلا نقل. وما سواها نهايةٌ لها بابُها
   المسمّى، والمنعُ يسمّيه. وقائمةُ الحيّة مصدرُها `REVIEW_OPEN_STATUSES`،
   وتُقابَل بخريطة الانتقالات في الخادم في اختبار. */
const CONTRACT_SENDABLE: readonly string[] = [...REVIEW_OPEN_STATUSES, 'active']

/** لماذا لا يُركَّب لصاحب هذا الطلب عقدٌ ولا يُرسَل — `null` إن لم يمنعه شيء */
export function contractBlockedAr(applicationStatus: string, profileSuspended: boolean): string | null {
  if (profileSuspended || applicationStatus === 'suspended') {
    return 'هذا المدرّبُ موقوف — ارفعِ الإيقافَ أوّلا («ارفع الإيقاف» في طلبه)، ثمّ يُركَّب له عقدٌ ويُرسَل'
  }
  if (CONTRACT_SENDABLE.includes(applicationStatus)) return null
  if (applicationStatus === 'rejected') return 'طلبُه مردود — «تراجَعْ عن الرفض» أوّلا، ثمّ يُركَّب له عقد'
  if (applicationStatus === 'withdrawn') return 'طلبُه مسحوب — «تراجَعْ عن السحب» أوّلا، ثمّ يُركَّب له عقد'
  if (applicationStatus === 'draft') return 'لم يُكمل طلبَه بعد — لا يُرسَل عقدٌ لمسودّة'
  return 'طلبُه في حالةٍ لا يُرسَل منها عقد — أعِدْه إلى المراجعة أوّلا'
}

/** ما يُعرض على رأسِ سلسلةِ عقودِ مدرّبٍ **أُغلق**:
 *
 *  · زرُّ التركيب إن كان صاحبُه ممّن ينتظر عقدا — والخادمُ قائلُ ذلك في
 *    `candidates`، فلا يُعاد حكمُه هنا؛
 *  · أو سببُ المنع مسمّى المخرج؛
 *  · أو أنّ القبولَ الداخليَّ يسبقه — حالةٌ حيّةٌ لم تبلغ طورَ العقد بعد؛
 *  · ولا شيء لرأسٍ لم يُغلَق: ذاك له أزرارُه. */
export function recontractFor<C extends { id: string }>(
  head: {
    status: string
    profile: { suspendedAt?: string | null; application: { id: string; status: string } | null } | null
  },
  candidates: readonly C[],
): { compose: C } | { blockedAr: string } | null {
  if (!isContractClosed(head.status)) return null
  const app = head.profile?.application
  if (!app) return null
  const candidate = candidates.find((c) => c.id === app.id)
  if (candidate) return { compose: candidate }
  const blockedAr = contractBlockedAr(app.status, Boolean(head.profile?.suspendedAt))
  return {
    blockedAr: blockedAr ?? 'لم يُقبَل داخليّا بعد — «اقبَلْه داخليّا» أوّلا، ثمّ يظهر في «من ينتظر عقدا»',
  }
}
