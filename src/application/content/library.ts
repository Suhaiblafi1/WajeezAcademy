/* إحالاتُ مكتبة وجيز (البند ح-٨) — التحقّقُ من أنّ الكتابَ المُحال إليه موجود.

   §٧ من سياسة التأليف تُلزم كلَّ وحدةٍ بإحالةٍ إلى ملخّصٍ من مكتبة وجيز حين
   يوجد فيها ما يمسّ موضوعَها، وتقول صريحا: **«ولا يُخترع عنوانُ كتابٍ ولا
   رابط. ما لا نتحقّق من وجوده لا يُذكر.»**

   وهذه القاعدةُ كانت بلا سبيلٍ إلى تنفيذها: لا فهرسَ للمكتبة في هذا المستودع،
   فلا المؤلّفُ يعرف ما فيها ولا البوّابةُ تعرف أنّ ما ذُكر موجود. فكان الأثرُ
   العمليُّ أن أُلّفت اثنتان وخمسون وحدةً **بلا إحالةٍ واحدةٍ إلى المكتبة** —
   وهو الاختيارُ الصحيح: السكوتُ أصدقُ من عنوانٍ لا يُتحقَّق منه.

   فهذه الوحدةُ نصفُ الجسر: تقرأ الإحالاتَ من المتن وتقابلها بفهرسٍ محلّيّ.
   والنصفُ الآخرُ `scripts/sync-wajeez-library.ts` — يملأ الفهرسَ من واجهة
   وجيز مهارات حين تُربط. وحتّى تُربط: الفهرسُ فارغٌ، والبوّابةُ تقول
   «معلَّق» ولا تُسقط — فحاجزٌ على ما لا يملكه المؤلّفُ بعدُ حاجزٌ ظالم.

   وموضعُ الإحالة في المتن عنوانٌ فرعيٌّ باسمه (§٧)، والعنوانُ بين نجمتين:

     ### ومن مكتبة وجيز
     ملخّصُ *الجرأة على القيادة* لبرينيه براون — بابُه في المحادثة الصعبة
     يعطيك العباراتَ التي تُقال، وهي ما ينقص أكثرَ المديرين الجدد. */

export interface LibraryItem {
  id: string
  titleAr: string
  authorAr?: string
  url?: string
  topicsAr?: string[]
}

export interface LibraryIndex {
  /** `pending_api` حتّى تُربط الواجهة، ثمّ اسمُ المصدر ووقتُ السحب */
  source: string
  fetchedAt: string | null
  items: LibraryItem[]
}

/** عنوانُ الإحالة في المتن — يُبحث عنه ببدايته كسائر الأجزاء المعنونة */
export const LIBRARY_HEADING = 'ومن مكتبة وجيز'

/** يُسقط التشكيلَ ويُوحّد الألفَ والياءَ والتاءَ — فالعنوانُ يُكتب بصورٍ */
export function normalizeTitle(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/[ىی]/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[«»"'*_]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** عناوينُ الكتب المذكورةُ في قسم مكتبة وجيز — ما بين نجمتين */
export function citedTitles(bodyAr: string | null | undefined): string[] {
  if (!bodyAr) return []
  const lines = bodyAr.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let inside = false
  for (const line of lines) {
    if (/^#{2,3}\s+/u.test(line)) {
      inside = new RegExp(`^#{2,3}\\s+${LIBRARY_HEADING}`, 'u').test(line)
      continue
    }
    if (!inside) continue
    for (const m of line.matchAll(/\*([^*\n]{3,120})\*/gu)) out.push(m[1].trim())
  }
  return out
}

export interface LibraryCheck {
  /** لا فهرسَ بعد — البوّابةُ تقول «معلَّق» ولا تُسقط */
  pending: boolean
  /** الوحدةُ فيها قسمُ مكتبة وجيز */
  hasSection: boolean
  /** عناوينُ ذُكرت ولا وجودَ لها في الفهرس — وهذه هي المخالفة */
  unknownTitles: string[]
}

/**
 * يقابل إحالاتِ المتن بالفهرس.
 *
 * وحين يكون الفهرسُ فارغا لا يُحكَم بشيء: `pending` صحيحة، ولا تُعَدّ
 * الوحدةُ مخالفةً لغياب إحالةٍ لا يملك المؤلّفُ التحقّقَ منها.
 */
export function checkLibraryRefs(bodyAr: string | null | undefined, index: LibraryIndex): LibraryCheck {
  const hasSection = Boolean(
    bodyAr && new RegExp(`^#{2,3}\\s+${LIBRARY_HEADING}`, 'mu').test(bodyAr),
  )
  if (index.items.length === 0) return { pending: true, hasSection, unknownTitles: [] }

  const known = new Set(index.items.map((i) => normalizeTitle(i.titleAr)))
  const unknownTitles = citedTitles(bodyAr).filter((t) => !known.has(normalizeTitle(t)))
  return { pending: false, hasSection, unknownTitles }
}

/**
 * الملخّصاتُ التي تمسّ موضوعا — بتقاطع الكلمات مع العنوان والموضوعات.
 *
 * تُستعمل في المحرّر لعرض ما في المكتبة للمؤلّف وهو يكتب، فيُحيل إلى
 * موجودٍ بدل أن يخترع. وهي بحثٌ ساذجٌ بقصد: الفهرسُ مئاتٌ لا ملايين،
 * والمؤلّفُ يقرأ النتائجَ بعينه.
 */
export function suggestFromLibrary(topicAr: string, index: LibraryIndex, limit = 5): LibraryItem[] {
  const words = normalizeTitle(topicAr).split(' ').filter((w) => w.length > 2)
  if (words.length === 0) return []
  const scored = index.items.map((it) => {
    const hay = normalizeTitle([it.titleAr, ...(it.topicsAr ?? [])].join(' '))
    return { it, score: words.filter((w) => hay.includes(w)).length }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.it)
}
