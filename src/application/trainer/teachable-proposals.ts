/* دوراتٌ يقترحها المتقدّم — مقروءةً واحدةً تلو الأخرى.

   قال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «لتصبح مقروءة واحدة تلو الأخرى ليس
   نصاً». وكان الحقلُ فقرةً حرّةً واحدة (`teachableOther`) بتلميحٍ يرجو أن
   يكتب «عنوانا لكل سطر، ولمن هو» — والرجاءُ ليس بنية: يصل المعتمِدَ ما
   يصل، فيُقرأ بالعين ولا يُعدّ ولا يُصنَّف واحدُه وحدَه.

   وهذا المكانُ هو **القرارُ** لا التصيير: ما الصفُّ المكتوب، وكم يُقبل،
   وماذا يُحذف قبل الإرسال. والشاشةُ تنادي هذا ولا تعيد اشتقاقَه.

   ─────────── قراراتٌ مكتوبةٌ كيلا تُخمَّن ثانية ───────────

   · **العنوانُ يلزم، ومن هو لا يلزم.** صفٌّ بلا عنوانٍ ليس اقتراحا فيسقط.
     وصفٌّ بعنوانٍ بلا جمهورٍ اقتراحٌ ناقصٌ لا باطل — ومن أوقفه عند حقلٍ
     إلزاميٍّ ثانٍ خسِر الاقتراحَ كلَّه، ونحن نريده.

   · **الفراغُ ليس كتابة.** مسافاتٌ وحدَها تُشذَّب فيسقط الصفّ، وإلّا مرّ
     «تمّ ملؤه» على نموذجٍ فارغ.

   · **السقفُ عشرون.** من يقترح أكثرَ من عشرين دورةً لا يقترح، بل يُفرغ
     سيرتَه — والمراجعةُ البشريّةُ بعده هي التي تدفع الثمن. */

/** اقتراحٌ واحد — عنوانُه ولمن هو */
export interface TeachableProposal {
  titleAr: string
  audienceAr: string
}

/** أكثرُ ما يُقبل من الاقتراحات في طلبٍ واحد */
export const MAX_PROPOSALS = 20
/** أطولُ عنوانٍ وأطولُ جمهور — يوافق سقفَ الخادم */
export const MAX_PROPOSAL_FIELD = 200

const trim = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** صفٌّ فارغٌ يُبدأ به، أو يُضاف عند «أضف دورة» */
export const emptyProposal = (): TeachableProposal => ({ titleAr: '', audienceAr: '' })

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
      audienceAr: trim(p.audienceAr).slice(0, MAX_PROPOSAL_FIELD),
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
    .map((r) => ({ titleAr: trim(r.titleAr), audienceAr: trim(r.audienceAr) }))
    .filter((p) => p.titleAr.length > 0)
    .slice(0, MAX_PROPOSALS)
}

/** سطرٌ يُقرأ: «العنوان — لمن هو»، وبلا جمهورٍ فالعنوانُ وحدَه */
export const proposalLine = (p: TeachableProposal): string =>
  p.audienceAr ? `${p.titleAr} — ${p.audienceAr}` : p.titleAr
