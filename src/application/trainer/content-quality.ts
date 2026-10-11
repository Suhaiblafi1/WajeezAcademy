/* ═══ جودةُ المحتوى النظريّ — ما تقرؤه المنصّةُ في متن المحور (١١ أكتوبر ٢٠٢٦) ═══

   سؤالُ صاحب المنصّة: «حسِّن جودةَ محتواهم وقدّم توصياتٍ إن أمكن». وكانت بطاقةُ
   المعايير (`plan-scorecard.ts`) تقيس هيكلَ الخطّة ومواعيدَها ولا تقرأ سطرا ممّا
   كُتب. فخُيّر بين فحصٍ بالقواعد ومراجعةٍ بالذكاء الاصطناعيّ، فاختار **القواعدَ
   أوّلا**: مجّانيّةٌ فوريّةٌ تقول الشيءَ نفسَه كلَّ مرّة.

   فيُقرأ المتنُ المكتوبُ على سياسة التأليف (`docs/AUTHORING-POLICY.md`) في ثلاثة:

   ① **العمق** (§٣): فكرةٌ تُشرح بـ`MIN_THEORY_WORDS` كلمةً على الأقلّ، ومثالٌ
      محلول، وخطأٌ شائعٌ يُنبَّه عليه — «أنفعُ ما في الدرس، وأوّلُ ما يُحذف».
   ② **اللغة** (§٤ ١، ٢، ٧، ٨): الحشو، والتعريفُ المعجميُّ في رأس الفقرة، والمبنيُّ
      للمجهول حيث يصحّ الفاعل، والنداءُ بـ«عزيزي المتعلّم».
   ③ **الأرقامُ والوعود** (§٤ ٤، ٩): نسبةٌ بلا مصدرٍ ولا سنةٍ في جملتها، ووعدٌ
      بوظيفةٍ أو دخلٍ خارجَ المنصّة.

   ── نصيحةٌ لا حاجز ──

   كلُّها `advice` في البطاقة: تُقال بسببها وبما يُصلحها، ولا تمنع إرسالا — على
   قاعدة «لا إجبارَ على فعل». فالفحصُ بالنمط يُخطئ أحيانا (كلمةُ «مثال» لا تصنع
   مثالا)، والحكمُ على التعليم نفسِه يبقى للمعتمِد (§١١).

   ── وما لا يُقرأ يُقال ──

   متنٌ مرفوعٌ ملفّا (PDF أو Word) لا تقرؤه المنصّةُ هنا؛ فيُعدّ ويُذكر في المقيس
   ولا يُدان. والنصُّ يُوحَّد (`normalizeAr`) قبل المطابقة: من كتب بلا تشكيلٍ أو
   بهمزةٍ غيرِ همزتنا يُطابَق كمن كتبها كما في القائمة. */

import { normalizeAr } from '../text/search-ar'
import { RED_PHRASES, proseOf } from '../content/red-rules'

/** أقلُّ ما تُشرح به فكرةُ المحور — حدُّ «الفكرة» في بنية الدرس (§٣: ٢٥٠–٤٠٠ كلمة) */
export const MIN_THEORY_WORDS = 250

export interface QualityModule {
  moduleId: string
  bodyAr?: string | null
  bodyFileKey?: string | null
  outcomeAr?: string | null
  activityAr?: string | null
}

export interface ContentQuality {
  /** محاورُ قُرئ متنُها المكتوب */
  read: number
  /** محاورُ متنُها ملفٌّ مرفوعٌ لا يُقرأ هنا */
  files: number
  depth: string[]
  style: string[]
  claims: string[]
}

interface Phrase { say: string; match: string; fixAr: string }

const phrase = (say: string, fixAr: string): Phrase => ({ say, match: normalizeAr(say), fixAr })

/** النداءُ — القاعدةُ ٨. وما عداه من القائمة حشوٌ (القاعدةُ ٢) */
const ADDRESS = ['عزيزي المتعلم', 'عزيزي المتعلّم', 'أخي الكريم', 'عزيزتي المتعلّمة', 'أختي الكريمة', 'عزيزي القارئ']

/* «يُعرَّف» وحدَها لا تُطابَق موحَّدةً: بلا تشكيلٍ هي «يعرف» — «لا يعرف العميلُ ما يريد»
   جملةٌ سليمة. فالتعريفُ المعجميُّ يُقرأ بموضعه (رأسُ الفقرة) لا بكلمته. */
const STYLE: Phrase[] = [
  ...RED_PHRASES.filter((p) => !normalizeAr(p).startsWith('يعرف') && !ADDRESS.includes(p))
    .map((p) => phrase(p, 'حشوٌ — احذفها وقل المعنى مباشرةً')),
  ...ADDRESS.map((p) => phrase(p, 'خاطِب المتعلّمَ مباشرةً بلا نداء')),
  phrase('يُنصَح بأن', 'سمِّ الفاعل: «انصح فريقَك بأن…»'),
  phrase('من المستحسن أن', 'قلها أمرا بفاعله: «افعل كذا لأنّ…»'),
]

/** وعودٌ خارجَ المنصّة — القاعدةُ ٩ */
const PROMISES: Phrase[] = [
  'ستحصل على وظيفة', 'وظيفة مضمونة', 'نضمن لك', 'راتبك سيتضاعف', 'سيتضاعف راتبك', 'دخل مضمون', 'ستصبح مليونيرا',
].map((p) => phrase(p, 'وعدٌ لا يقيسه المحور — قل ما يقدر عليه المتعلّمُ بعده'))

const EXAMPLE = ['مثال', 'مثلا', 'لنفترض', 'تخيل', 'حالة عملية', 'على سبيل'].map(normalizeAr)
const MISTAKE = ['خطأ', 'اخطاء', 'يخطئ', 'خاطئ', 'الشائع', 'تجنب', 'احذر'].map(normalizeAr)
const PERCENT = /[%٪]|في المئة|في المائة|بالمئة|بالمائة/
/** ما يدلّ على مصدرٍ في الجملة — سنةٌ أو جهةٌ تُسمّى */
const SOURCE = [/\b(19|20)\d\d\b/, ...['بحسب', 'حسب', 'وفق', 'مصدر', 'تقرير', 'دراسة', 'احصاء', 'مسح'].map((w) => new RegExp(normalizeAr(w)))]

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const clip = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 59)}…` : t
}

/** فقرةٌ تبدأ بتعريفٍ معجميّ: «يُعرَّف X بأنّه…» أو «تعرف X على أنّها…» في جملتها الأولى */
function opensWithDefinition(paragraph: string): boolean {
  const first = normalizeAr(paragraph.split(/(?<=[.!؟?])\s/)[0] ?? '')
  return /^(و)?(يعرف|تعرف)\s/.test(first) && /(بانه|بانها|على انه|على انها)/.test(first)
}

export function contentQuality(modules: readonly QualityModule[]): ContentQuality {
  const out: ContentQuality = { read: 0, files: 0, depth: [], style: [], claims: [] }
  modules.forEach((m, i) => {
    const at = `المحور ${i + 1}`
    const raw = (m.bodyAr ?? '').trim()
    if (!raw) {
      if ((m.bodyFileKey ?? '').trim()) out.files++
      return
    }
    out.read++
    const body = proseOf(raw)
    const flat = normalizeAr(body)

    /* ① العمق */
    const w = words(body)
    if (w < MIN_THEORY_WORDS) out.depth.push(`${at}: ${w} كلمةً — اشرح الفكرةَ في ${MIN_THEORY_WORDS} كلمةً على الأقلّ`)
    if (!EXAMPLE.some((k) => flat.includes(k))) out.depth.push(`${at}: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ تُحلّ خطوةً خطوة`)
    if (!MISTAKE.some((k) => flat.includes(k))) out.depth.push(`${at}: لا يذكر خطأً شائعا — اكتب الخطأَ الذي يقع فيه المبتدئ وكيف يتجنّبه`)

    /* ② اللغة — في المتن وفي المخرَج والتطبيق، فكلُّها يقرؤها المتعلّم */
    const all = [body, proseOf(m.outcomeAr ?? ''), proseOf(m.activityAr ?? '')].join('\n')
    const allFlat = normalizeAr(all)
    const seen = new Set<string>()
    for (const p of STYLE) {
      if (seen.has(p.match) || !allFlat.includes(p.match)) continue
      seen.add(p.match)
      out.style.push(`${at}: «${p.say}» — ${p.fixAr}`)
    }
    if (body.split(/\n\s*\n|\n(?=#)/).some(opensWithDefinition)) {
      out.style.push(`${at}: فقرةٌ تبدأ بتعريفٍ معجميّ — ابدأ بموقفٍ أو مشكلةٍ ثمّ سمِّ المفهوم`)
    }

    /* ③ الأرقامُ والوعود */
    for (const s of all.split(/(?<=[.!؟?])\s+|\n+/)) {
      if (!PERCENT.test(s)) continue
      const n = normalizeAr(s)
      if (SOURCE.some((r) => r.test(n))) continue
      out.claims.push(`${at}: نسبةٌ بلا مصدر «${clip(s)}» — اذكر مصدرَها وسنتَها في الجملة نفسِها، أو احذف الرقمَ وقل المعنى`)
    }
    for (const p of PROMISES) {
      if (allFlat.includes(p.match)) out.claims.push(`${at}: «${p.say}» — ${p.fixAr}`)
    }
  })
  return out
}
