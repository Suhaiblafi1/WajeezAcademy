/* ترتيبُ طابور الطلبات — حكمٌ خالصٌ تقرؤه الشاشة.

   ═══ لماذا وُجد ═══

   قال صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦): «اجعلني أرتّبهم حسب الأرقام صعودا
   أو نزولا، أو ترتيبٍ حسب الحالة». وكان الطابورُ مرتَّبا بيدٍ واحدة —
   أقدمُ أوّلا — مكتوبةً في الشاشة بلا خيار.

   ═══ وثلاثةُ أحكامٍ فيه ليست بديهيّة ═══

   ① **الرقمُ يُقارَن عدديّا لا حرفيّا.** معرّفاتُ الطلبات تحمل أرقاما،
      والمقارنةُ الحرفيّةُ تضع `TR-10` قبل `TR-9` لأنّ «١» قبل «٩». فيُقرأ
      الطابورُ مرتَّبا وهو ليس مرتَّبا — وهو أسوأُ من فوضى معلنة.

   ② **والحالةُ تُرتَّب بدورة حياتها لا بحروفها.** ترتيبُ «مرفوض» قبل
      «مُقدَّم» لأنّ الميمَ قبل الميم لا يعني شيئا لمن يفرز. فالترتيبُ على
      موضع الحالة في رحلة الطلب، وتُمرَّر من الشاشة حيث تسكن مرتَّبةً
      أصلا — فلا قائمتان تفترقان.

   ③ **ولكلّ ترتيبٍ فاصلٌ عند التساوي.** متقدّمان في الحالة نفسِها، أو
      وصلا في الثانية نفسِها: لو تُرك ترتيبُهما لـ`sort` لَتبدّل بين
      تصييرٍ وآخر، فيقفز الصفُّ تحت يد قارئه. والفاصلُ هو المعرّف — لا
      يتكرّر ولا يتغيّر. */

export type SortKey = 'created' | 'name' | 'reference' | 'status' | 'interview'
export type SortDir = 'asc' | 'desc'

/** ما يُرتَّب به — الشاشةُ تبني قائمتَها منه فلا تُكتب الأسماءُ مرّتين */
export const SORT_OPTIONS: readonly { key: SortKey; labelAr: string }[] = [
  { key: 'created', labelAr: 'تاريخُ التقديم' },
  /* ═══ وتاريخُ المقابلة (٢١ سبتمبر ٢٠٢٦) ═══

     «أحتاج ترتيبا إضافيّا للأسماء من خلال تاريخ المقابلة، من الأقدم
     للأحدث مثلا». وموضعُه بعد تاريخ التقديم لا آخرَ القائمة: كلاهما
     تاريخٌ يُفرز به الطابور، والاسمُ والرقمُ بحثٌ لا فرز. */
  { key: 'interview', labelAr: 'تاريخُ المقابلة' },
  { key: 'name', labelAr: 'الاسم' },
  { key: 'reference', labelAr: 'رقمُ الطلب' },
  { key: 'status', labelAr: 'الحالة' },
]

export const SORT_KEYS = SORT_OPTIONS.map((o) => o.key)

/** ما يلزم للترتيب — لا الصفُّ كلُّه، فتُختبَر الدالّةُ بلا تركيب طلبٍ تامّ */
export interface SortableApp {
  fullName: string
  reference: string
  status: string
  createdAt: string
  /** موعدُ آخر لقاءٍ قائمٍ له — `null` لمن لا موعدَ له */
  interviewAt?: string | null
}

/** موضعُ الحالة في رحلة الطلب — وما لا يُعرف يقع آخرا لا أوّلا */
function statusRank(status: string, order: readonly string[]): number {
  const i = order.indexOf(status)
  return i === -1 ? order.length : i
}

/**
 * يرتّب صفوفَ الطابور — نسخةً جديدةً لا في مكانها.
 *
 * `statusOrder` تُمرَّر ولا تُكتب هنا: معجمُ الحالات يسكن الشاشةَ مرتَّبا
 * بدورة الحياة، ونسخُه هنا يعني معجمَين يفترقان عند أوّل حالةٍ تُضاف.
 */
export function sortApplications<T extends SortableApp>(
  rows: readonly T[],
  key: SortKey,
  dir: SortDir,
  statusOrder: readonly string[],
): T[] {
  const sign = dir === 'desc' ? -1 : 1
  /* والفاصلُ لا يُقلَب مع الاتّجاه: هو ثباتٌ لا ترتيب. فلو قُلب لَتبدّل
     ترتيبُ المتساوين بين الصعود والنزول بلا معنى. */
  const tieBreak = (a: T, b: T) => a.reference.localeCompare(b.reference, 'en', { numeric: true })

  const compare = (a: T, b: T): number => {
    switch (key) {
      case 'name':
        return a.fullName.localeCompare(b.fullName, 'ar')
      case 'reference':
        /* عدديّا: فـ`TR-9` قبل `TR-10` كما يقرؤها الإنسان */
        return a.reference.localeCompare(b.reference, 'en', { numeric: true })
      case 'status':
        return statusRank(a.status, statusOrder) - statusRank(b.status, statusOrder)
      case 'interview': {
        /* ═══ ومن لا موعدَ له يقع آخرا في الاتّجاهَين ═══

           لو عُومل الفراغُ تاريخا لَتصدّر النازلَ أو الصاعدَ بحسب ما يُوضع
           مكانَه — فيُقرأ ترتيبٌ بالمقابلة نصفُه بلا مقابلة. وهو حكمُ
           `statusRank` نفسُه: «وما لا يُعرف يقع آخرا لا أوّلا».

           ويُضرب في `sign` هنا ليُلغيَه ضربُ المنادي أدناه (`sign²` واحدٌ
           دائما) — فيبقى المجهولُ أسفلَ القائمة صعدت أم نزلت.

           **ويُقاس الوجودُ لا القيمة**: صفٌّ لم يُرسِل الحقلَ أصلا
           (`undefined`) وصفٌّ أرسله فارغا (`null`) كلاهما «بلا موعد»،
           ومقارنتُهما بـ`===` تقول إنّهما مختلفان — فيردّ المقارِنُ أنّ
           كلًّا منهما بعد الآخر، وذاك مقارِنٌ متناقضٌ يُفسد الترتيبَ كلَّه. */
        const aHas = Boolean(a.interviewAt)
        const bHas = Boolean(b.interviewAt)
        if (!aHas || !bHas) return aHas === bHas ? 0 : (aHas ? -1 : 1) * sign
        return a.interviewAt!.localeCompare(b.interviewAt!)
      }
      case 'created':
      default:
        /* تواريخُ ISO تُقارَن حرفيّا فتصحّ — وهي كذلك في كلّ الصفوف */
        return a.createdAt.localeCompare(b.createdAt)
    }
  }

  return [...rows].sort((a, b) => {
    const primary = compare(a, b)
    return primary !== 0 ? sign * primary : tieBreak(a, b)
  })
}
