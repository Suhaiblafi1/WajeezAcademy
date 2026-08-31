/* تقسيم متن الوحدة إلى دروس — بلا تغيير في التخزين ولا في المحرّر.

   سياسة التأليف عندنا تجعل الوحدة (ساعتان) ثلاثةَ دروس، كلٌّ منها يبدأ
   بعنوانٍ من مستوى ثانٍ (`## `). فالعقدُ مكتوبٌ في السياسة، وهذه الوحدة
   تقرؤه: كلُّ `## ` درس، و`### ` أقسامٌ داخله.

   ولماذا لا حقلٌ مستقلّ لكلّ درس في القاعدة؟ لأنّ المتن يُحرَّر في صندوق
   نصٍّ واحد ويمرّ بمسوّدةٍ ومراجعةٍ واعتماد. وتفتيتُه إلى صفوفٍ يعني هجرةً
   في القاعدة وتغييرا في المحرّر والمراجعة والنشر — كلُّ ذلك ليُعرض النصُّ
   نفسُه مقسّما. فالتقسيم عند العرض أرخصُ وأقلُّ خطرا، والعقدُ محروسٌ
   باختبار. */

export interface Lesson {
  /** ترتيبُه في الوحدة، يبدأ من واحد */
  index: number
  title: string
  /** متنُ الدرس بلا سطر عنوانه — يمرّ كما هو على `LessonBody` */
  body: string
  /** دقائقُ قراءةٍ مقدَّرة بمقياس السياسة */
  minutes: number
}

/** مئةُ كلمةٍ عربية تقنية في الدقيقة — قراءةٌ واعية لا تصفّح */
const WORDS_PER_MINUTE = 100

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** يزيل علامات التنسيق من العنوان — العنوان يُعرض في شريط تقدّم لا في متن */
function plainTitle(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

export function splitLessons(body: string | null | undefined): Lesson[] {
  if (!body || !body.trim()) return []

  const lines = body.split('\n')
  /* كتلُ الكود تُعبَر كما هي: `## ` بداخلها تعليقٌ لا عنوانُ درس */
  let inFence = false
  const cuts: { at: number; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m && !line.startsWith('###')) cuts.push({ at: i, title: plainTitle(m[1]) })
  }

  const out: Lesson[] = []
  const push = (title: string, from: number, to: number) => {
    const text = lines.slice(from, to).join('\n').trim()
    if (!text && !title) return
    out.push({ index: out.length + 1, title, body: text, minutes: readingMinutes(`${title} ${text}`) })
  }

  if (cuts.length === 0) {
    push('', 0, lines.length)
    return out
  }

  /* ما قبل أوّل عنوانٍ درسٌ تمهيديّ بلا عنوان — ولا يُرمى */
  const prelude = lines.slice(0, cuts[0].at).join('\n').trim()
  if (prelude) push('', 0, cuts[0].at)

  for (let c = 0; c < cuts.length; c++) {
    const start = cuts[c].at + 1
    const end = c + 1 < cuts.length ? cuts[c + 1].at : lines.length
    push(cuts[c].title, start, end)
  }
  return out
}
