/* علاماتُ المتن وإدراجُها — منطقٌ محضٌ بلا React.

   شريطُ الصيغة في محرّر المدرّب يُدرج علاماتِ `LessonBody` نفسِها. والإدراجُ
   منطقٌ يُخطئ بصمت: علامةٌ في غير موضعها، أو مؤشّرٌ يقفز إلى آخر النصّ بعد
   كلّ ضغطة. فهو هنا مفصولٌ ليُختبَر، لا في جسد المكوّن.

   ولماذا لا محرّرٌ غنيٌّ يُخرج HTML: `LessonBody` يحوّل Markdown المقيَّد إلى
   عناصر React مباشرةً، فحقنُ HTML مستحيلٌ بنيويّا لا بالتنقية. ومحرّرٌ
   يُخرج HTML يعيد إلينا المنقّي وقائمةَ الحجب — وهو ما تخلّصت منه المنصّة. */

export interface BodyMark {
  id: string
  label: string
  /** ما يسبق المحدَّد */
  before: string
  /** ما يليه — غيابُه يعني علامةً بطرفٍ واحد */
  after?: string
  /** علامةُ سطرٍ: تُوضع في أوّل السطر لا حول الحروف */
  line?: boolean
  /** ما يُكتب حين لا تحديدَ — كي لا تُدرج علامتان حول فراغ */
  placeholder: string
}

export const BODY_MARKS: BodyMark[] = [
  { id: 'h2', label: 'عنوانُ درس', before: '## ', line: true, placeholder: 'عنوانُ الدرس' },
  { id: 'bold', label: 'عريض', before: '**', after: '**', placeholder: 'نصٌّ عريض' },
  { id: 'italic', label: 'مائل', before: '*', after: '*', placeholder: 'نصٌّ مائل' },
  { id: 'list', label: 'قائمة', before: '- ', line: true, placeholder: 'عنصرُ القائمة' },
  { id: 'quote', label: 'اقتباس', before: '> ', line: true, placeholder: 'الاقتباس' },
  { id: 'code', label: 'كود', before: '`', after: '`', placeholder: 'كود' },
  { id: 'link', label: 'رابط', before: '[', after: '](https://)', placeholder: 'نصُّ الرابط' },
]

/**
 * يطبّق علامةً على النصّ ويعيد النتيجةَ وموضعَ المؤشّر بعدها.
 *
 * والمؤشّرُ يقف **بعد النصّ المدرَج وقبل علامةِ الإغلاق**: من ضغط «عريض»
 * ثمّ كتب يريد كتابتَه داخل العلامتين لا بعدهما.
 */
export function applyMark(value: string, start: number, end: number, mark: BodyMark): { value: string; cursor: number } {
  const selected = value.slice(start, end)
  const body = selected || mark.placeholder

  if (mark.line) {
    /* علامةُ السطر تُوضع في أوّل سطر التحديد: `## ` وسطَ كلمةٍ ليس عنوانا */
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const head = value.slice(0, lineStart)
    const mid = value.slice(lineStart, start)
    const tail = value.slice(end)
    /* ولا يُزاد سطرٌ فارغٌ قبلها: جُرّب فلم يفرّق — `parseLesson` و
       `splitLessons` كلاهما سطريّان، و`فقرة\n## عنوان` يخرج منهما
       `[p, h, p]` ودرسَين تماما كـ`فقرة\n\n## عنوان`. فكان فرعا لا يحرسه
       فحصٌ لأنّه لا أثرَ له يُحرَس. */
    return {
      value: `${head}${mark.before}${mid}${body}${tail}`,
      cursor: head.length + mark.before.length + mid.length + body.length,
    }
  }

  return {
    value: `${value.slice(0, start)}${mark.before}${body}${mark.after ?? ''}${value.slice(end)}`,
    cursor: start + mark.before.length + body.length,
  }
}
