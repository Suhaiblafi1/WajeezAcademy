/* دوراتٌ يقترحها المتقدّم — مقروءةً واحدةً تلو الأخرى.

   قال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «لتصبح مقروءة واحدة تلو الأخرى ليس
   نصاً». وكان الحقلُ فقرةً حرّةً واحدة (`teachableOther`) بتلميحٍ يرجو أن
   يكتب «عنوانا لكل سطر، ولمن هو» — والرجاءُ ليس بنية: يصل المعتمِدَ ما
   يصل، فيُقرأ بالعين ولا يُعدّ ولا يُصنَّف واحدُه وحدَه.

   وهذا المكانُ هو **القرارُ** لا التصيير: ما الصفُّ المكتوب، وكم يُقبل،
   وماذا يُحذف قبل الإرسال. والشاشةُ تنادي هذا ولا تعيد اشتقاقَه.

   ─────────── قراراتٌ مكتوبةٌ كيلا تُخمَّن ثانية ───────────

   · **العنوانُ يلزم، والنبذةُ لا تلزم.** صفٌّ بلا عنوانٍ ليس اقتراحا فيسقط.
     وصفٌّ بعنوانٍ بلا نبذةٍ اقتراحٌ ناقصٌ لا باطل — ومن أوقفه عند حقلٍ
     إلزاميٍّ ثانٍ خسِر الاقتراحَ كلَّه، ونحن نريده.

   · **وكانت «لمن هي» فصارت نبذة** (قرارُ صاحب المنصّة، ١٥ سبتمبر ٢٠٢٦):
     الجمهورُ وحدَه لا يُعرّف دورة، ومن قرأ «للمحاسبين» لا يعرف ما فيها.
     والمفتاحُ القديمُ `audienceAr` **يُقرأ ولا يُكتب**: عمودُ الطلب سجلُّ ما
     قُدّم يومَ قُدّم فلا يُعاد كتابتُه، ومن قرأ الجديدَ وحدَه أفرغ نبذةَ كلّ
     متقدّمٍ سبق.

   · **الفراغُ ليس كتابة.** مسافاتٌ وحدَها تُشذَّب فيسقط الصفّ، وإلّا مرّ
     «تمّ ملؤه» على نموذجٍ فارغ.

   · **السقفُ عشرون.** من يقترح أكثرَ من عشرين دورةً لا يقترح، بل يُفرغ
     سيرتَه — والمراجعةُ البشريّةُ بعده هي التي تدفع الثمن. */

/** اقتراحٌ واحد — عنوانُه ونبذتُه */
export interface TeachableProposal {
  titleAr: string
  summaryAr: string
}

/** أكثرُ ما يُقبل من الاقتراحات في طلبٍ واحد */
export const MAX_PROPOSALS = 20
/** أطولُ عنوان — يوافق سقفَ الخادم */
export const MAX_PROPOSAL_FIELD = 200
/** والنبذةُ فقرةٌ لا سطر، فسقفُها أوسع */
export const MAX_PROPOSAL_SUMMARY = 1500

const trim = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** صفٌّ فارغٌ يُبدأ به، أو يُضاف عند «أضف دورة» */
export const emptyProposal = (): TeachableProposal => ({ titleAr: '', summaryAr: '' })

/** أهذا الصفُّ اقتراحٌ يُرسَل؟ — العنوانُ وحدَه يقرّر */
export const proposalWritten = (p: TeachableProposal): boolean => trim(p.titleAr).length > 0

/**
 * يُشذّب ما يُرسَل: تُحذف الصفوفُ بلا عنوان، وتُشذَّب الأطراف، ويُقصّ ما
 * جاوز السقف. والنتيجةُ ما يُخزَّن — لا ما يُعرض في الشاشة.
 */
export function cleanProposals(rows: readonly TeachableProposal[]): TeachableProposal[] {
  return rows
    .map((p) => ({
      titleAr: trim(p.titleAr).slice(0, MAX_PROPOSAL_FIELD),
      summaryAr: trim(p.summaryAr).slice(0, MAX_PROPOSAL_SUMMARY),
    }))
    .filter((p) => p.titleAr.length > 0)
    .slice(0, MAX_PROPOSALS)
}

/** أفي الطلب اقتراحٌ واحدٌ على الأقلّ؟ */
export const hasProposal = (rows: readonly TeachableProposal[]): boolean =>
  rows.some(proposalWritten)

/**
 * قراءةُ العمود من القاعدة — وما ليس مصفوفةَ كائناتٍ يُقرأ فارغا.
 *
 * العمودُ `Json?` فيقبل أيَّ شكل: طلبٌ قديمٌ، أو كتابةٌ يدويّةٌ في القاعدة،
 * أو صيغةٌ تغيّرت غدا. ومن قرأه بلا فحصٍ أسقط شاشةَ المعتمِد كلَّها بحقلٍ
 * واحدٍ مشوَّه.
 */
export function readProposals(raw: unknown): TeachableProposal[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    /* `audienceAr` مفتاحُ ما سبق — يُقرأ ولا يُكتب، وسقوطُه يُفرغ نبذةَ كلّ
       متقدّمٍ قديمٍ بلا خطأٍ يُرى */
    .map((r) => ({ titleAr: trim(r.titleAr), summaryAr: trim(r.summaryAr) || trim(r.audienceAr) }))
    .filter((p) => p.titleAr.length > 0)
    .slice(0, MAX_PROPOSALS)
}

/** سطرٌ يُقرأ: «العنوان — نبذتُه»، وبلا نبذةٍ فالعنوانُ وحدَه */
export const proposalLine = (p: TeachableProposal): string =>
  p.summaryAr ? `${p.titleAr} — ${p.summaryAr}` : p.titleAr

/* ═══ «دوراتٌ يصلح لها» في شريط الحقائق — رقمٌ كان يكذب ═══

   ─────────── العطب ───────────

   كان الشريطُ يقرأ `teachableCourseIds.length` وحدَه. فمن اختار من الكتالوج
   ظهر عددُه، **ومن كتب دوراتِه بقلمه ولم يختر من الكتالوج ظهر له «٠»**.

   ووقع ذلك على أوّل مدرّبةٍ حقيقيّةٍ في المنصّة: ثماني دوراتٍ في ملفّها،
   وشريطُ الحقائق يقول «٠ دوراتٌ يصلح لها» — أي «لا تصلح لشيء». ورقمٌ كاذبٌ
   في أوّل ما تقع عليه العين أسوأُ من غياب الرقم: الشريطُ بُني ليُقرأ بنظرةٍ
   قبل القرار، فمن قرأه ولم يفتح الملفَّ قرّر على كذبة.

   ─────────── ولماذا نصٌّ حين لا يُعدّ ───────────

   الاقتراحاتُ سجلّاتٌ تُعدّ، فتُجمع إلى اختيارات الكتالوج. أمّا الطلباتُ
   التي سبقت السجلّات فتحمل **فقرةً حرّةً واحدة** — وعددُ الدورات فيها لا
   يُعرف إلّا بتخمين. والتخمينُ هنا يعيد العطبَ بصورةٍ أخرى: «١» عن ثمانٍ
   ليس أصدقَ من «٠».

   فيُقال «بقلمه»: قصيرٌ يليق بخانةٍ في شريط، وصادقٌ — ثمّ من فتح الملفَّ
   قرأها، ومن أراد عددا سمّاها في المحرّر فصارت تُعدّ. */
export function teachableCountAr(input: {
  teachableCourseIds?: readonly string[] | null
  teachableProposals?: unknown
  teachableOther?: string | null
}): string {
  const counted = (input.teachableCourseIds?.length ?? 0) + readProposals(input.teachableProposals).length
  if (counted > 0) return String(counted)
  return trim(input.teachableOther) ? 'بقلمه' : '0'
}
