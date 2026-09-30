/* أسئلةُ «أضِفْ دورةً تقترحها» — ما تحتاجه الإدارةُ لتقرّر: دمجٌ أم دورةٌ جديدة.

   ═══ ولمَ أسئلةٌ لا نبذةٌ وحدَها (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «حسّن شكلَ فورم إضافة الدورات وأضِفِ الأسئلةَ التي
   تريد لتسهّل علينا العملَ على دمج الدورة أو إضافتها للكتالوج».

   وكان الاقتراحُ عنوانا ونبذةً حرّة، فيصل الطابورَ «دورة خطابة عامّة» بلا
   مستوى ولا ساعاتٍ ولا محاور — فتسأل الإدارةُ سؤالا وتنتظر جوابا
   (`info_requested`) عن أشياءَ كان يمكن أن تُسأل في الفورم نفسِه. والأسئلةُ
   هنا هي تلك التي يقف عليها القرار:

     · **المحاورُ والمخرجات** — بها يُقارَن الاقتراحُ بالكتالوج، فيُعرف أهو
       نسخةٌ من دورةٍ قائمة أم جديد.
     · **الأقربُ في الكتالوج، وهل يقبل الدمج** — يقولها صاحبُها بنفسه قبل
       أن يحكم عليه غيرُه.
     · **المستوى والجمهور والساعات والصيغة** — ما تُبنى عليه الشعبة.
     · **الخبرةُ والجاهز من الموادّ** — ما يُقدَّر به وقتُ الإطلاق.

   وكلُّها **لا تلزم**: من أوقفناه عند حقلٍ إلزاميٍّ خسِرنا اقتراحَه — وهي
   علّةُ النبذة نفسِها في المخطّط. والعنوانُ وحدَه يلزم كما كان.

   ═══ ومصدرُها واحد ═══

   الخادمُ ينظّف بها ما يصله (`cleanProposalDetails`)، والشاشتان — المدرّبُ
   يكتب، والإدارةُ تقرأ — تعرضان بها. فلا تفترق تسميةُ خيارٍ بين من كتبه
   ومن قرأه. */

export const PROPOSAL_LEVELS = {
  beginner: 'مبتدئ',
  intermediate: 'متوسّط',
  advanced: 'متقدّم',
  mixed: 'لكلّ المستويات',
} as const

export const PROPOSAL_FORMATS = {
  live_online: 'مباشرة عن بُعد',
  in_person: 'حضوريّة',
  blended: 'مدمجة',
  recorded: 'مسجّلة',
} as const

export const PROPOSAL_EXPERIENCE = {
  never: 'لم أدرّسها بعد',
  once: 'درّستها مرّةً أو مرّتين',
  often: 'درّستها مرارا',
} as const

export const PROPOSAL_MATERIALS = {
  slides: 'عروضٌ تقديميّة',
  exercises: 'تمارينُ وأنشطة',
  cases: 'دراساتُ حالة',
  assessments: 'اختباراتٌ وتقييمات',
  recordings: 'تسجيلاتٌ مصوّرة',
  handbook: 'دليلُ متدرّب',
} as const

export const PROPOSAL_MERGE = {
  yes: 'نعم — أقبل دمجَها بدورةٍ قائمة',
  prefer_new: 'أفضّلها دورةً مستقلّة',
  discuss: 'نتناقش فيها',
} as const

type Key<T> = keyof T & string

/** ما يُحفظ في `TrainerCourseProposal.details` — كلُّه اختياريّ */
export interface ProposalDetails {
  audienceAr?: string
  level?: Key<typeof PROPOSAL_LEVELS>
  outcomesAr?: string
  topicsAr?: string
  hours?: number
  format?: Key<typeof PROPOSAL_FORMATS>
  experience?: Key<typeof PROPOSAL_EXPERIENCE>
  materials?: Key<typeof PROPOSAL_MATERIALS>[]
  closestCourseAr?: string
  merge?: Key<typeof PROPOSAL_MERGE>
}

export const MAX_DETAIL_LINE = 300
export const MAX_DETAIL_TEXT = 1500
export const MAX_PROPOSAL_HOURS = 400

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t.slice(0, max) : undefined
}
const pick = <T extends object>(v: unknown, dict: T): Key<T> | undefined =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(dict, v) ? (v as Key<T>) : undefined

/** ينظّف حمولةً غيرَ موثوقة — ما لا يُعرف يسقط صامتا، والفارغُ كلُّه `null` */
export function cleanProposalDetails(raw: unknown): ProposalDetails | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const hoursNum = typeof r.hours === 'number' ? r.hours : typeof r.hours === 'string' ? Number(r.hours) : NaN
  const out: ProposalDetails = {
    audienceAr: text(r.audienceAr, MAX_DETAIL_LINE),
    level: pick(r.level, PROPOSAL_LEVELS),
    outcomesAr: text(r.outcomesAr, MAX_DETAIL_TEXT),
    topicsAr: text(r.topicsAr, MAX_DETAIL_TEXT),
    hours: Number.isFinite(hoursNum) && hoursNum >= 1 && hoursNum <= MAX_PROPOSAL_HOURS
      ? Math.round(hoursNum) : undefined,
    format: pick(r.format, PROPOSAL_FORMATS),
    experience: pick(r.experience, PROPOSAL_EXPERIENCE),
    materials: Array.isArray(r.materials)
      ? [...new Set(r.materials.map((m) => pick(m, PROPOSAL_MATERIALS)).filter((m): m is Key<typeof PROPOSAL_MATERIALS> => !!m))]
      : undefined,
    closestCourseAr: text(r.closestCourseAr, MAX_DETAIL_LINE),
    merge: pick(r.merge, PROPOSAL_MERGE),
  }
  if (out.materials && out.materials.length === 0) delete out.materials
  for (const k of Object.keys(out) as (keyof ProposalDetails)[]) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length > 0 ? out : null
}

/** الأجوبةُ سطورا مسمّاةً — لمن يقرأ (الإدارة) ولمن يرشّح (أقربُ رمزٍ في الكتالوج) */
/* و`reader: 'trainer'` لا يعرض سؤالَي الدمج: حُذفا من فورم المدرّب (٣٠ سبتمبر
   ٢٠٢٦ — «هذا نحن نقرّره لا هو»)، فلا يرى جوابا عن سؤالٍ لم يعد يُسأل. والإدارةُ
   تراهما حيث أُجيب عنهما من قبل. */
export function proposalDetailRows(
  d: ProposalDetails | null | undefined,
  reader: 'admin' | 'trainer' = 'admin',
): { labelAr: string; valueAr: string }[] {
  if (!d) return []
  const rows: { labelAr: string; valueAr: string }[] = []
  const add = (labelAr: string, valueAr: string | undefined) => { if (valueAr) rows.push({ labelAr, valueAr }) }
  add('لمن هي', d.audienceAr)
  add('المستوى', d.level && PROPOSAL_LEVELS[d.level])
  add('الساعات', d.hours ? `${d.hours} ساعة` : undefined)
  add('الصيغة', d.format && PROPOSAL_FORMATS[d.format])
  add('المحاور', d.topicsAr)
  add('ما يخرج به المتدرّب', d.outcomesAr)
  add('خبرتُه فيها', d.experience && PROPOSAL_EXPERIENCE[d.experience])
  add('الجاهز لديه', d.materials?.map((m) => PROPOSAL_MATERIALS[m]).join('، '))
  if (reader === 'trainer') return rows
  add('أقربُ دورةٍ في الكتالوج بقوله', d.closestCourseAr)
  add('الدمج', d.merge && PROPOSAL_MERGE[d.merge])
  return rows
}

/** نصُّ ما يُقارَن بالكتالوج — المحاورُ والمخرجاتُ والأقربُ بقوله، مع النبذة */
export function proposalMatchText(summaryAr: string | null, d: ProposalDetails | null | undefined): string {
  return [summaryAr, d?.topicsAr, d?.outcomesAr, d?.closestCourseAr, d?.audienceAr]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join('\n')
}
