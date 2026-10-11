/* ═══ صفحةُ كلّ محورٍ في الكرّاسة — تُقترح من فهرس ملفّها (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: أضِف مكتبةَ قراءة PDF «لاقتراح أرقام صفحات المحاور». فكان
   المدرّبُ يفتح ملفَّه ويقلّبه ليكتب «ص ٥» لكلّ محور. والاقتراحُ لا يُفرض: يُكتب
   في الخانات وله أن يعدّلها، وما كتبه بيده لا يُستبدل إلّا إن اختار ذلك.

   وهنا المحضُ وحدَه — بلا PDF: ما يُقرأ من الملفّ يصل مدخلاتٍ بسيطة.
   ١) الفهرس (outline / bookmarks): عناوينُ بصفحاتها — أدقُّ ما في الملفّ.
   ٢) فإن لم يكن له فهرس: نصُّ كلّ صفحة، فيُطلب فيه عنوانُ المحور. والصفحةُ التي
      تحمل عناوينَ محورين فأكثر هي «المحتويات» نفسُها، فلا يُعدّ ورودُه فيها بدايتَه.
   ومن البدايات تُبنى المدى: المحورُ حتّى الصفحة التي قبل بداية ما يليه. */

export interface TocEntry { title: string; page: number }
export interface TocModule { moduleId: string; titleAr: string }

/** عربيٌّ بلا تشكيلٍ ولا تطويل، والألفاتُ والياءاتُ والتاءُ المربوطةُ بشكلٍ واحد */
export function normalizeAr(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tokens = (s: string) => normalizeAr(s).split(' ').filter((w) => w.length > 1)

/** كم من كلمات عنوان المحور في عنوان الفهرس — من ٠ إلى ١ */
export function titleScore(moduleTitle: string, entryTitle: string): number {
  const want = tokens(moduleTitle)
  if (want.length === 0) return 0
  const have = new Set(tokens(entryTitle))
  return want.filter((w) => have.has(w)).length / want.length
}

const MATCH = 0.6

/** بدايةُ كلّ محورٍ من الفهرس — أحسنُ عنوانٍ يطابقه، أو بالترتيب حين يساوي عددُها عددَ المحاور ولا يطابق شيء */
export function startsFromOutline(entries: readonly TocEntry[], modules: readonly TocModule[]): Map<string, number> {
  const out = new Map<string, number>()
  const used = new Set<number>()
  for (const m of modules) {
    let best = -1
    let bestScore = 0
    entries.forEach((e, i) => {
      if (used.has(i)) return
      const sc = titleScore(m.titleAr, e.title)
      if (sc > bestScore) { bestScore = sc; best = i }
    })
    if (best >= 0 && bestScore >= MATCH) { out.set(m.moduleId, entries[best]!.page); used.add(best) }
  }
  if (out.size === 0 && entries.length === modules.length && modules.length > 0) {
    modules.forEach((m, i) => out.set(m.moduleId, entries[i]!.page))
  }
  return out
}

/* ═══ ولماذا يُقارن النصُّ بلا مسافاتٍ وبالاتّجاهين ═══
   ملفّاتٌ كثيرةٌ (منها ما يطبعه كروم وبعضُ ما يصدّره Word) تحفظ العربيّةَ بترتيبها المرئيّ:
   حرفا حرفا من اليسار، بأشكال العرض (ﻟ ا)، بين كلّ حرفين مسافة. فتُرَدّ الأشكالُ إلى حروفها
   (`normalizeAr`)، وتُحذف المسافات، ويُطلب العنوانُ في النصّ وفي مقلوبه — ظهر في أيّهما عُدّ. */
const compact = (s: string) => normalizeAr(s).replace(/ /g, '')
/* والقلبُ بالقِطَع لا بالحروف: يخرج بعضُ الأزواج قطعةً واحدةً بترتيبها («ار»)، وقلبُ حروفها يفسدها */
const reversedCompact = (s: string) => normalizeAr(s).split(' ').reverse().join('')

/** بدايةُ كلّ محورٍ من نصّ الصفحات — أوّلُ صفحةٍ يرد فيها عنوانُه، إلّا صفحةَ المحتويات */
export function startsFromText(pages: readonly string[], modules: readonly TocModule[]): Map<string, number> {
  const forms = pages.map((p) => [compact(p), reversedCompact(p)] as const)
  /* وكلُّ كلمةٍ من العنوان على حدة: عنوانٌ يخلط اللاتينيّةَ بالعربيّة («Message Map وخطاب قصير») يُحفظ
     كلٌّ منهما باتّجاهه، فلا يقع العنوانُ كاملا في أيٍّ من الشكلين — وكلماتُه تقع */
  const has = (k: number, words: readonly string[]) => words.every((w) => forms[k]![0].includes(w) || forms[k]![1].includes(w))
  const titles = modules
    .map((m) => ({ id: m.moduleId, t: normalizeAr(m.titleAr).split(' ').filter((w) => w.length > 1) }))
    .filter((x) => x.t.join('').length >= 3)
  const contents = new Set(forms.flatMap((_, i) => (titles.filter((x) => has(i, x.t)).length >= 2 ? [i] : [])))
  const out = new Map<string, number>()
  for (const x of titles) {
    const i = forms.findIndex((_, k) => !contents.has(k) && has(k, x.t))
    if (i >= 0) out.set(x.id, i + 1)
  }
  return out
}

/** «ص ٥» أو «ص ٥–١٢» لكلّ محورٍ عُرفت بدايتُه — المدى حتّى بداية ما يليه في الملفّ */
export function wherePages(starts: ReadonlyMap<string, number>, pageCount: number): Map<string, string> {
  const sorted = [...starts.entries()].sort((a, b) => a[1] - b[1])
  const out = new Map<string, string>()
  sorted.forEach(([id, from], k) => {
    const next = sorted[k + 1]?.[1]
    const to = next !== undefined ? Math.max(from, next - 1) : Math.max(from, pageCount)
    out.set(id, to > from ? `ص ${from}–${to}` : `ص ${from}`)
  })
  return out
}
