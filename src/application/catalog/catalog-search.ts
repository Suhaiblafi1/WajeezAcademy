/* بحثُ الكتالوج — المرادفاتُ التي يكتبها الزائرُ ولا يكتبها المؤلِّف.

   ─────────── ما كان ───────────

   كان البحثُ سطرا واحدا: `p.name.includes(q)`. مطابقةٌ حرفيّةٌ في حقلين،
   بلا توحيدِ همزةٍ ولا تجزئةِ كلماتٍ ولا «أل». وثمانيةُ استعلاماتٍ واقعيّةٍ
   جُرّبت على الكتالوج نفسِه فردَّ **خمسةٌ منها صفرا** — والمنصّةُ عندها ما
   يناسب كلَّ واحدٍ منها:

     «ريادة الاعمال» (بلا همزة) · «تسويق رقمي» (بلا «أل») · «اكسل» ·
     «موارد بشرية» · «ai»

   ─────────── وما صار ───────────

   ثلاثُ طبقاتٍ فوق بعضها، كلُّها توسعةٌ لا تضييق:

   ١) **التطبيع** (`normalizeAr`): الهمزاتُ والتاءُ المربوطةُ والألفُ المقصورةُ
      والتشكيلُ والتطويلُ والأرقام.
   ٢) **«أل» بأشكالها الثلاثة** (`termVariantsAr`).
   ٣) **المرادفاتُ هنا**: ما يسمّيه الزائرُ بغير ما سمّاه المؤلِّف.

   ─────────── وقاعدةُ المرادفات ───────────

   المرادفُ **يُضاف ولا يُبدَّل**: من كتب «اكسل» يطابق «اكسل» *أو* «جداول
   بيانات» — فلا يخسر نتيجةً كانت تصله. والجدولُ مكتوبٌ باليد عمدا: عشرون
   سطرا يفهمها من يقرؤها ويزيدها من يرى استعلاما ضاع، ولا محرّكَ لغويٌّ
   يُخطئ بلا تفسير. */

import { matchesTerms, normalizeAr } from '../text/search-ar'

/** ما يكتبه الزائر ← ما كُتب في الكتالوج. الطرفان مُطبَّعان عند البناء. */
const SYNONYMS: readonly (readonly string[])[] = [
  ['اكسل', 'excel', 'شيت', 'sheets', 'جداول بيانات', 'الجداول'],
  ['موارد بشريه', 'hr', 'اداره الموظفين', 'شؤون الموظفين', 'التوظيف'],
  ['ai', 'الذكاء الاصطناعي', 'ذكاء اصطناعي', 'جي بي تي', 'gpt', 'chatgpt'],
  ['pm', 'اداره المشاريع', 'بروجكت', 'مشاريع'],
  ['ديجيتال ماركتنج', 'تسويق رقمي', 'marketing', 'ماركتنج'],
  ['سيلز', 'sales', 'مبيعات'],
  ['فاينانس', 'finance', 'ماليه', 'محاسبه'],
  ['داتا', 'data', 'بيانات', 'تحليل بيانات'],
  ['سايبر', 'cyber', 'امن سيبراني', 'امن المعلومات'],
  ['ليدرشيب', 'leadership', 'قياده', 'اداره فريق'],
  ['ستارت اب', 'startup', 'رياده الاعمال', 'مشروع خاص'],
  ['اوتوميشن', 'automation', 'اتمته', 'no-code', 'نو كود'],
  ['لوجستيك', 'سلسله الامداد', 'supply chain', 'مشتريات'],
  ['تفاوض', 'negotiation', 'اقناع'],
  ['بريزنتيشن', 'عرض تقديمي', 'مهارات العرض', 'تقديم'],
  ['cv', 'سيره ذاتيه', 'مقابله عمل', 'انترفيو'],
]

/* فهرسٌ يُبنى مرّةً: كلُّ مرادفٍ مُطبَّعٍ ← كلُّ إخوته */
const INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>()
  for (const group of SYNONYMS) {
    const folded = group.map(normalizeAr)
    for (const term of folded) {
      map.set(term, [...new Set([...(map.get(term) ?? []), ...folded])])
    }
  }
  return map
})()

/** كلماتُ الاستعلام بعد التطبيع — وكلُّ كلمةٍ لها مرادفاتُها إن وُجدت */
export function expandCatalogQuery(query: string): string[][] {
  const normalized = normalizeAr(query)
  if (!normalized) return []
  /* الاستعلامُ كلُّه أوّلا: «موارد بشرية» مرادفٌ من كلمتين لا يُدرَك بكلمةٍ كلمة */
  const whole = INDEX.get(normalized)
  if (whole) return [whole]
  return normalized.split(' ').filter(Boolean).map((t) => INDEX.get(t) ?? [t])
}

/** أيطابق هذا الصفُّ الاستعلامَ؟ كلُّ كلمةٍ بأحد مرادفاتها، في أيّ حقل */
export function matchesCatalogQuery(
  query: string, fields: readonly (string | null | undefined)[],
): boolean {
  const groups = expandCatalogQuery(query)
  if (groups.length === 0) return true
  /* والمرادفُ يُشقّ كلماتٍ هو الآخر — و«أل» تلحق كلَّ كلمةٍ لا أوّلَها:
     «تسويق رقمي» مكتوبةٌ في الكتالوج «التسويق الرقمي»، فلو طُوبقت جملةً
     واحدةً لسقطت — والكلمتان معا موجودتان. */
  return groups.every((alternatives) =>
    alternatives.some((alt) => matchesTerms(alt.split(' ').filter(Boolean), fields)),
  )
}

/* ─────────── الترتيبُ بالصلة — التوسعةُ بلا ترتيبٍ تُفسد ما تُصلح ───────────

   توسيعُ الحقول يُخرج نتائجَ لم تكن تخرج — وهذا هو المطلوب. لكنّه يُخرج معها
   مطابقاتٍ في **نصوصٍ وصفيّةٍ طويلة** (الجمهورُ والتحوّلُ والمخرَج)، فيصعد
   إلى أوّل القائمة صفٌّ ذكر الكلمةَ عرضا، ويهبط الذي يحملها في اسمه.

   فالحقولُ ثلاثُ طبقات، والصفُّ يأخذ رتبةَ أعلى طبقةٍ طابقت فيها كلماتُه كلُّها:

     ٣ · الاسمُ (الكاملُ والقصير) — من طابق هنا هو المقصود
     ٢ · المهاراتُ والوعد — قريبٌ من المقصود
     ١ · الجمهورُ والتحوّلُ والمخرَج — ذُكر فيه، فيبقى ولا يتصدّر

   ورتبةُ صفرٍ لا تقع: الصفُّ لا يصل هنا إلا وقد طابق. */
export function catalogRank(
  query: string,
  layers: readonly (readonly (string | null | undefined)[])[],
): number {
  const groups = expandCatalogQuery(query)
  if (groups.length === 0) return 0
  const hits = (fields: readonly (string | null | undefined)[]) =>
    groups.every((alternatives) =>
      alternatives.some((alt) => matchesTerms(alt.split(' ').filter(Boolean), fields)),
    )
  for (let i = 0; i < layers.length; i++) if (hits(layers[i])) return layers.length - i
  return 0
}
