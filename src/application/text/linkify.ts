/* روابطُ نصٍّ مكتوبٍ باليد — تُعرف فتُضغط (٦ أكتوبر ٢٠٢٦).

   طلب صاحبُ المنصّة أن تُضغط الروابطُ في إعلانات المدرّبين: كانت النافذةُ تعرض
   النصَّ كما كُتب، فيصل «https://www.wajeezacademy.com/trainer/guide» حرفا ميّتا
   يُنسخ باليد — وعلى الهاتف لا يكاد يُنسخ.

   ═══ ما يُعدّ رابطا ═══

   · ما بدأ بـ`https://` أو `http://` أو `www.` وبعده نطاقٌ فيه نقطة. و`www.` يُفتح
     بـ`https://`. وما سوى ذلك نصٌّ — فلا مخطّطَ آخرُ (`javascript:` وأشباهه) يصير
     رابطا أبدا، لأنّ البدايةَ لا تطابقه أصلا.
   · وينتهي الرابطُ عند فراغٍ أو مزدوجين أو ترقيمٍ عربيّ: «اقرأ https://x.com/guide،
     ثمّ…» — الفاصلةُ العربيّةُ للجملة لا للرابط. وحرفٌ عربيٌّ ملاصقٌ للنطاق يُنهيه.
   · **إلّا في مسار الرابط** (١٠ أكتوبر ٢٠٢٦): «https://hbrarabic.com/التواصل-مع-محاورك» رابطٌ
     كاملٌ يُلصق كثيرا هكذا من الهاتف، وكان يُقطع عند أوّل حرفٍ عربيّ فيُفتح موقعٌ لا
     المقالة. فبعد `/` أو `?` أو `#` الحرفُ العربيُّ من الرابط، والترقيمُ العربيُّ (، ؛ ؟)
     والفراغُ يُنهيانه.
   · ويُعرض بحروفه (`readableUrl`): «%D8%A7%D9%84…» يُقرأ «ال…». قالها صاحبُ المنصّة
     عن تسليمات المتعلّمين: «we should make the text readable on links for the trainers».
   · وعلامةُ الترقيم في آخره ليست منه: «افتح https://x.com/guide.» — النقطةُ للجملة.
     إلّا قوسا أُغلق على قوسٍ فُتح داخلَ الرابط نفسِه.

   بلا React — تقرؤه `components/AnnouncementBody.tsx`، ويحرسه
   `src/tests/trainer/announcement-links.test.ts`. */

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }

/* النطاقُ يُنهيه الحرفُ العربيّ (ومعه الفاصلةُ والفاصلةُ المنقوطةُ وعلامةُ الاستفهام العربيّة)،
   والمسارُ بعده يحمل الحرفَ العربيَّ ويُنهيه الترقيمُ العربيُّ وحدَه */
const CANDIDATE = /(?:https?:\/\/|www\.)[^\s/?#<>"'\u00AB\u00BB\u201C\u201D\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+(?:[/?#][^\s<>"'\u00AB\u00BB\u201C\u201D\u060C\u061B\u061F\u06D4]*)?/gi
const TRAILING = '.,;:!?…)]}'

const count = (s: string, ch: string) => s.split(ch).length - 1

/** يُسقط من آخر الرابط ما هو للجملة — ويُبقي قوسا يغلق قوسا في الرابط نفسِه */
function trimTrailing(url: string): string {
  let u = url
  while (u.length > 0 && TRAILING.includes(u[u.length - 1])) {
    if (u.endsWith(')') && count(u, '(') >= count(u, ')')) break
    u = u.slice(0, -1)
  }
  return u
}

/** عنوانُ وِبٍ صالح: http أو https، ونطاقٌ فيه نقطة */
function webHref(candidate: string): string | null {
  const href = /^www\./i.test(candidate) ? `https://${candidate}` : candidate
  try {
    const u = new URL(href)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? href : null
  } catch {
    return null
  }
}

/** النصُّ قطعا: نصٌّ كما هو، وروابطُ بعنوانها — وجمعُ القطع يعيد النصَّ حرفا بحرف */
export function linkSegments(text: string): Segment[] {
  const out: Segment[] = []
  const pushText = (t: string) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last?.kind === 'text') last.text += t
    else out.push({ kind: 'text', text: t })
  }
  let at = 0
  for (const m of text.matchAll(CANDIDATE)) {
    const start = m.index ?? 0
    const url = trimTrailing(m[0])
    const href = url ? webHref(url) : null
    if (!href) continue
    pushText(text.slice(at, start))
    out.push({ kind: 'link', text: url, href })
    at = start + url.length
  }
  pushText(text.slice(at))
  return out
}

/** الرابطُ كما يُقرأ — «https://hbrarabic.com/التواصل» لا «https://hbrarabic.com/%D8%A7…».
    للعرض وحدَه: العنوانُ الذي يُفتح يبقى كما كُتب. وما لا يُفكّ يُعرض كما هو. */
export function readableUrl(url: string): string {
  try { return decodeURI(url) } catch { return url }
}
