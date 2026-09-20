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

export type SortKey = 'created' | 'name' | 'reference' | 'status'
export type SortDir = 'asc' | 'desc'

/** ما يُرتَّب به — الشاشةُ تبني قائمتَها منه فلا تُكتب الأسماءُ مرّتين */
export const SORT_OPTIONS: readonly { key: SortKey; labelAr: string }[] = [
  { key: 'created', labelAr: 'تاريخُ التقديم' },
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
