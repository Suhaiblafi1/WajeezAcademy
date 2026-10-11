/* تقاريرُ المراجعة دفعةً واحدة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اريد ان ارفع كل شي مره واحده!» — وكان كلُّ تقريرٍ يُرفع من بطاقة
   خطّته، اثنان وأربعون ملفّا (تقريرٌ وملحقٌ لكلّ خطّة) في إحدى وعشرين بطاقة.

   فكلُّ ملفٍّ يحمل في اسمه معرّفَ خطّته (يُكتب فيه عند تجهيزه)، فيُعرف موضعُه بلا سؤال، ويُرفع
   إليها بمسلك البطاقة نفسِه. وما لا يُعرف موضعُه يُردّ بسببه ولا يُخمَّن: ملفٌّ يصل مدرّبا غيرَ
   مدرّبه أسوأُ من ملفٍّ لم يُرفع.

   وبلا معرّف: باسم المدرّب واسم الشعبة (١١ أكتوبر ٢٠٢٦). قال صاحبُ المنصّة: «لا اعرف اي تقرير
   لاي شخص.. سمي الملفات باسماء المدربين واسم الشعبه فقط لاغير، وان كان اكثر من ملف اترك رقم
   لكل ملف». فالاسمُ «المدرّب — الشعبة (1).pdf» يُعرف موضعُه إن ذكر اسمَ المدرّب كاملا، وكان
   باقيه من عنوان شعبته، ولم يصدق ذلك إلّا على خطّةٍ واحدة. وإلّا رُدّ بسببه — لا تخمين.

   بلا React — تقرؤه الشاشة، ويحرسه `src/tests/trainer/review-reports-bulk.test.ts`. */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type ReportMatch =
  | { name: string; ok: true; planId: string; labelAr: string; mime: string; storedName: string }
  | { name: string; ok: false; problemAr: string }

/** نوعُ الملفّ — من المتصفّح، وإلّا من امتداده (Word قد يصل بلا نوع) */
export function reportMime(name: string, type: string): string {
  if (type) return type
  if (/\.pdf$/i.test(name)) return 'application/pdf'
  if (/\.docx$/i.test(name)) return DOCX
  return ''
}

/** خطّةٌ في القائمة المعروضة — واسمُ مدرّبها وعنوانُ شعبتها لمطابقة الاسم بلا معرّف */
export type ReportPlan = { id: string; labelAr: string; trainerName?: string; cohortTitle?: string }

/** كلماتُ الاسم للمقارنة — بلا تشكيلٍ ولا تطويل، والأرقامُ الهنديّةُ أرقامٌ، والألفُ ألف */
export function nameTokens(s: string): string[] {
  return s.normalize('NFC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/** الخططُ التي يذكرها الاسم: اسمُ مدرّبها كاملا، وباقيه كلُّه من عنوان شعبتها، وفيه منه شيء */
function plansNamedBy(name: string, plans: readonly ReportPlan[]): ReportPlan[] {
  const words = new Set(nameTokens(name.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)\s*$/, '')))
  return plans.filter((p) => {
    if (!p.trainerName || !p.cohortTitle) return false
    const trainer = nameTokens(p.trainerName)
    if (trainer.length === 0 || !trainer.every((w) => words.has(w))) return false
    const title = new Set(nameTokens(p.cohortTitle))
    const rest = [...words].filter((w) => !trainer.includes(w))
    return rest.length > 0 && rest.every((w) => title.has(w))
  })
}

/** أيُّ خطّةٍ هذا الملفّ — من معرّفها في اسمه، أو من اسم مدرّبها وشعبتها، وبين الخطط المعروضة وحدَها */
export function matchReportFile(
  name: string, type: string, plans: readonly ReportPlan[],
): ReportMatch {
  const mime = reportMime(name, type)
  if (mime !== 'application/pdf' && mime !== DOCX) {
    return { name, ok: false, problemAr: 'لا يُقبل إلّا PDF أو Word' }
  }
  const ids = [...new Set((name.match(UUID) ?? []).map((x) => x.toLowerCase()))]
  if (ids.length === 0) {
    const named = plansNamedBy(name, plans)
    if (named.length === 1) {
      return { name, ok: true, planId: named[0].id, labelAr: named[0].labelAr, mime, storedName: reportDisplayName(name) }
    }
    if (named.length > 1) {
      return { name, ok: false, problemAr: `يصدق اسمُه على ${named.length} خطط — زِد فيه رقمَ الشعبة كما في القائمة، أو ارفعه من بطاقة خطّته` }
    }
    return { name, ok: false, problemAr: 'لا يذكر اسمُ الملفّ خطّةً في القائمة — سمِّه باسم المدرّب واسم الشعبة كما في القائمة، أو ارفعه من بطاقة خطّته' }
  }
  if (ids.length > 1) return { name, ok: false, problemAr: 'في اسم الملفّ أكثرُ من خطّة — ارفعه من بطاقة خطّته' }
  const plan = plans.find((p) => p.id.toLowerCase() === ids[0])
  if (!plan) {
    return { name, ok: false, problemAr: 'خطّتُه ليست في القائمة المعروضة الآن (قرّرتَ فيها، أو القائمةُ مصفّاةٌ بمدرّب) — ارفعه من بطاقة خطّته' }
  }
  return { name, ok: true, planId: plan.id, labelAr: plan.labelAr, mime, storedName: reportDisplayName(name) }
}

/** الاسمُ الذي يُحفظ ويراه المدرّب — بلا معرّف الخطّة (وُضع للمطابقة وحدَها) وبلا رقمِ ترتيبه
    في الحزمة. رآهما المدرّبُ في صفحة شعبته في تجربة الرفع (١١ أكتوبر ٢٠٢٦): «06 — تقرير…
    [0c4b8529-…].pdf» */
export function reportDisplayName(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot) : ''
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(new RegExp(`[[(]?\\s*${UUID.source}\\s*[\\])]?`, 'gi'), ' ')
    .replace(/^\s*\d{1,2}\s*[—–-]\s+/, '')
    .replace(/\s+/g, ' ').trim()
  return (stem || 'تقرير المراجعة') + ext
}

/** خلاصةُ الدفعة — كم رُفع، وكم كان مرفوعا من قبل، وكم رُدّ */
export function reportsSummaryAr(done: number, already: number, failed: number): string {
  const parts = [`رُفع ${done}`]
  if (already > 0) parts.push(`وكان ${already} مرفوعا من قبل فلم يُكرَّر`)
  if (failed > 0) parts.push(`ورُدّ ${failed} بسببه أدناه`)
  const tail = failed === 0 ? ' — يراها كلُّ مدرّبٍ في صفحة شعبته من الآن، وتذكرها رسالةُ قرارك.' : '.'
  return parts.join('، ') + tail
}

/* ═══ اسمُ التقرير كما يقرؤه المدرّب (١١ أكتوبر ٢٠٢٦) ═══

   حزمةُ الإدارة تسمّي ملفّاتها «المدرّب — الشعبة (1).pdf» و«(2)» لتعرف هي أيَّها لأيّ مدرّب
   («سمِّ الملفّاتِ بأسماء المدرّبين واسم الشعبة… وإن كان أكثرُ من ملفٍّ اترك رقما»). ثمّ قال صاحبُ
   المنصّة لمّا رأى صفحةَ المدرّب: «تلك الأسماءُ كانت لي لأرفعها — والمنصّةُ ترفعها، فارجع إلى
   العناوين العاديّة ليعرف المدرّبُ ما هذا الملفّ». فـ«(1)» تقريرُ المراجعة و«(2)» ملحقُ المرجع
   الدوليّ، وما سواهما يُقرأ باسمه كما رُفع — ومنه «تقرير (2).pdf» تنزيلا ثانيا بلا «المدرّب — الشعبة». */
export function reportTitleAr(name: string): string {
  const n = /\S — \S.*\((\d+)\)\s*\.[^.]+$/.exec(name)?.[1]
  if (n === '1') return 'تقرير المراجعة'
  if (n === '2') return 'ملحق المرجع الدولي'
  return name
}
