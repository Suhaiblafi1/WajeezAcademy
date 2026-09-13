/* شريطُ صيغة المتن — إدراجُ العلامة وموضعُ المؤشّر بعدها.

   قال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «اكتب له شرحا لكلّ خانة… وتأكّد أنّه
   يستطيع تعديل المتون التدريبيّة». والمدرّبُ لا يحفظ صيغةَ Markdown عن ظهر
   قلب، فالشريطُ يُدرجها عنه.

   والإدراجُ منطقٌ يُخطئ بصمت: علامةٌ وسطَ كلمةٍ فلا تصير عنوانا، أو عنوانٌ
   يلتصق بالفقرة قبله فيقرأه `LessonBody` فقرةً واحدة، أو مؤشّرٌ يقفز إلى
   آخر النصّ فيفقد المدرّبُ موضعَه مع كلّ ضغطة. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applyMark, BODY_MARKS, type BodyMark } from '@/application/content/body-marks'
import { parseLesson } from '@/application/content/lesson-markup'
import { splitLessons } from '@/application/content/lesson-split'

const mark = (id: string): BodyMark => {
  const m = BODY_MARKS.find((x) => x.id === id)
  if (!m) throw new Error(`لا علامةَ ${id}`)
  return m
}

describe('العلامةُ تحيط بالمحدَّد', () => {
  it('والمؤشّرُ يقف بعده وقبل علامةِ الإغلاق — فمن ضغط ثمّ كتب كتب داخلها', () => {
    const { value, cursor } = applyMark('اكتب نصا هنا', 5, 8, mark('bold'))
    expect(value).toBe('اكتب **نصا** هنا')
    expect(value.slice(cursor), 'المؤشّرُ بعد علامة الإغلاق').toBe('** هنا')
  })

  it('وبلا تحديدٍ يُدرج نائبٌ محدَّدٌ لا علامتان حول فراغ', () => {
    const { value } = applyMark('', 0, 0, mark('bold'))
    expect(value).toBe('**نصٌّ عريض**')
    expect(value, 'علامتان متلاصقتان').not.toBe('****')
  })

  it('والرابطُ يُدرج بهيكله كاملا — فلا يُترك للمدرّب تذكّرُ الأقواس', () => {
    const { value } = applyMark('انظر الدليل', 5, 11, mark('link'))
    expect(value).toBe('انظر [الدليل](https://)')
  })
})

describe('وعلامةُ السطر تُوضع في أوّله لا حول الحروف', () => {
  it('«## » وسطَ كلمةٍ ليست عنوانا — فتُرحَّل إلى رأس السطر', () => {
    const { value } = applyMark('مقدّمة قصيرة', 7, 12, mark('h2'))
    /* لا `مقدّمة ## قصير` — العنوانُ يبدأ السطر */
    expect(value.split('\n').pop()).toBe('## مقدّمة قصيرة')
  })

  it('وما قبل السطر يبقى كما هو — لا يُزاد فراغٌ ولا يُمحى شيء', () => {
    /* وكان هنا حارسٌ يشترط سطرا فارغا قبل العنوان، ويزعم أنّ التصاقَه
       بالفقرة يجعل `LessonBody` يقرؤهما واحدة. وهو **غيرُ صحيح**: جُرّب
       فخرج `فقرة\n## عنوان` كتلا `[p, h, p]` ودرسَين، كـ`فقرة\n\n## عنوان`
       سواءً بسواء. فحُذف الفرعُ وحُذف معه الحارسُ الذي لم يكن يحرس شيئا —
       وهذا ما بقي منه: النصُّ السابقُ لا يُمسّ. */
    const { value } = applyMark('فقرةٌ سابقة\nعنوانٌ جديد', 12, 23, mark('h2'))
    expect(value).toBe('فقرةٌ سابقة\n## عنوانٌ جديد')
    expect(parseLesson(value).map((b) => b.kind)).toEqual(['p', 'h'])
  })

  it('وفي أوّل المتن لا يُزاد سطرٌ فارغٌ قبله', () => {
    const { value } = applyMark('عنوان', 0, 5, mark('h2'))
    expect(value).toBe('## عنوان')
  })
})

describe('وما يُدرَج يقرؤه مصيِّرُ المتعلّم فعلا', () => {
  /* الفحصُ الحاسم: علامةٌ يُدرجها الشريطُ ولا يعرفها `LessonBody` زينةٌ
     تُنتج نصّا حرفيّا عند المتعلّم. فكلُّ علامةٍ تُبنى ثمّ تُقرأ. */
  /* والعلامتان تُقرآن في موضعين مختلفين، فتُفحَص كلٌّ عند قارئها:
     · علاماتُ السطر يقرؤها `parseLesson` فتصير كتلةً غيرَ فقرة.
     · علاماتُ السطر الداخليّةُ يقرؤها `LessonBody` في تصييره هو، فتبقى في
       نصّ الفقرة حتّى يصل إليها — و`parseLesson` لا يعرفها ولا يُفترض.
     ولا محيطَ DOM في هذا المستودَع فتُصيَّر المكوّناتُ وتُفحَص عقدُها،
     فالصيغةُ الداخليّةُ تُقرأ **من ملفّ المكوّن نفسِه** لا تُنسَخ هنا. */

  it('وعلاماتُ السطر تُنتج كتلةً غيرَ فقرةٍ عند `parseLesson`', () => {
    for (const m of BODY_MARKS.filter((x) => x.line)) {
      const { value } = applyMark('', 0, 0, m)
      const blocks = parseLesson(value)
      expect(blocks.length, `العلامة ${m.id} لا تُنتج كتلة`).toBe(1)
      expect(blocks[0].kind, `العلامة ${m.id} خرجت فقرةً عاديّة`).not.toBe('p')
    }
  })

  it('والعلاماتُ الداخليّةُ تطابق صيغةَ `LessonBody` — بصيغته هو لا بنسخةٍ منها', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'components', 'LessonBody.tsx'),
      'utf8',
    )
    /* السطرُ الذي يقسّم النصَّ على الأنماط السطريّة داخل `inline` */
    const line = src.split('\n').find((l) => l.includes('const re = /'))
    expect(line, 'لم تُعثَر صيغةُ الأنماط السطريّة في `LessonBody`').toBeTruthy()
    const body = (line as string).slice((line as string).indexOf('/') + 1, (line as string).lastIndexOf('/g'))
    const re = new RegExp(body, 'g')

    for (const m of BODY_MARKS.filter((x) => !x.line)) {
      const { value } = applyMark('', 0, 0, m)
      re.lastIndex = 0
      expect(re.test(value), `العلامة ${m.id} لا تعرفها صيغةُ \`LessonBody\` فتُعرض حرفا`).toBe(true)
    }
  })

  it('وعنوانُ الدرس يقسّم المتنَ درسا — وهو ما تعد به الشاشة', () => {
    /* الشاشةُ تقول للمدرّب «ابدأ كلَّ درسٍ بعنوانٍ من الشريط، فالمتنُ
       يُقسَّم عنده دروسا». فلو لم تقسّم `splitLessons` عند هذه العلامة
       بعينها كان الوعدُ كاذبا. */
    const { value } = applyMark('', 0, 0, mark('h2'))
    expect(splitLessons(`${value}\nمتنُ الدرس`).length).toBe(1)
    expect(splitLessons(`${value}\nمتن\n\n## درسٌ ثان\nمتن`).length).toBe(2)
  })
})
