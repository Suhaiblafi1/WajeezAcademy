/* روابطُ نصٍّ مكتوبٍ باليد — تُعرف فتُضغط (٦ أكتوبر ٢٠٢٦).

   طلب صاحبُ المنصّة أن تُضغط الروابطُ في إعلانات المدرّبين: كانت النافذةُ تعرض
   النصَّ كما كُتب، فيصل «https://www.wajeezacademy.com/trainer/guide» حرفا ميّتا
   يُنسخ باليد — وعلى الهاتف لا يكاد يُنسخ.

   ═══ ما يُعدّ رابطا ═══

   · ما بدأ بـ`https://` أو `http://` أو `www.` وبعده نطاقٌ فيه نقطة. و`www.` يُفتح
     بـ`https://`. وما سوى ذلك نصٌّ — فلا مخطّطَ آخرُ (`javascript:` وأشباهه) يصير
     رابطا أبدا، لأنّ البدايةَ لا تطابقه أصلا.
   · وينتهي الرابطُ عند فراغٍ أو حرفٍ عربيٍّ أو مزدوجين: «اقرأ https://x.com/guide،
     ثمّ…» — الفاصلةُ العربيّةُ للجملة لا للرابط.
   · وعلامةُ الترقيم في آخره ليست منه: «افتح https://x.com/guide.» — النقطةُ للجملة.
     إلّا قوسا أُغلق على قوسٍ فُتح داخلَ الرابط نفسِه.

   بلا React — تقرؤه `components/AnnouncementBody.tsx`، ويحرسه
   `src/tests/trainer/announcement-links.test.ts`. */

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }

/* الحرفُ العربيّ (ومعه الفاصلةُ والفاصلةُ المنقوطةُ وعلامةُ الاستفهام العربيّة) يُنهي الرابط */
const CANDIDATE = /(?:https?:\/\/|www\.)[^\s<>"'\u00AB\u00BB\u201C\u201D\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/gi
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
