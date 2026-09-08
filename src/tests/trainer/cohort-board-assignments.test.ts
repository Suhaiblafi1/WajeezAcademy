/* لوحُ الشعبة — ما يؤلّفه المدرّب يُرى، وحالةُ الزرّ تُقال لا تُلوَّن.

   ثلاثةٌ رصدَتها جولةُ البند ③ في ملفَّين، وكلُّها تسقط صامتةً:

   ١) **التكاليفُ لا تظهر.** `TrainerCohort` كانت تحمل `sessions`
      و`enrollments` و`materials` ولا تحمل تكاليف، وكلمةُ `assessment`
      ترد في الملفّ مرّةً واحدةً: في `POST` الذي يُنشئها. فيؤلّف المدرّبُ
      تكليفا ويصل المسجَّلين ولا يراه هو — ولا بعد إعادة التحميل.

   ٢) **أزرارُ الحضور تقول حالتَها باللون وحدَه.** أربعةُ أزرارٍ لكلّ
      متعلّمٍ في كلّ جلسة، والمختارُ يُعرَف بـ`border-teal` فقط: لا
      `aria-pressed` ولا اسمٌ يربط الزرَّ بصاحبه. فمن لا يرى يسمع «حاضر»
      أربعَ مرّاتٍ في الجلسة الواحدة لا يعرف لمن، ولا أيُّها مضبوط.

   ٣) **«سجّل الدرجة» مفعَّلٌ قبل المراجعة**، والخادمُ يردّه ٤٠٩.

   ── والقياسُ على البنية لا على ورودِ حرف ──

   التعليقاتُ تُمحى أوّلا: شرحُ هذه الإصلاحاتِ في الشاشتَين يذكر
   `assessments` و`aria-pressed` و`under_review` بأسمائها، فلو قيس على
   النصّ الخامّ لعدّ الحارسُ **شرحَ الإصلاح** إصلاحا — ومرّ عندي ثلاثةُ
   حرّاسٍ خضراءَ لهذا السبب في هذه الجولة وحدَها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
/** بلا تعليقات: يُقاس ما يُنفَّذ لا ما يُشرح */
const readCode = (p: string) => readFileSync(join(root, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

const BOARD = 'src/pages/trainer/CohortBoard.tsx'
const LIST = 'src/pages/trainer/CohortAssignments.tsx'
const QUEUE = 'src/pages/trainer/GradingQueue.tsx'

describe('المؤلِّفُ يرى ما ألّف', () => {
  it('اللوحُ يُمرّر تكاليفَ الشعبة إلى قسمها — لا يعلنها في النوع ثمّ يُهملها', () => {
    const code = readCode(BOARD)
    const i = code.indexOf('<CohortAssignments')
    expect(i, 'قسمُ التكاليف ليس في اللوح أصلا — فالمؤلِّفُ لا يرى ما ألّف').toBeGreaterThan(0)
    /* والمقياسُ ما يُمرَّر لا ورودُ الوسم: قسمٌ بلا بياناتٍ يعرض فراغا دائما */
    const props = code.slice(i, code.indexOf('/>', i))
    expect(props, 'القسمُ مصيَّرٌ بلا تكاليف').toContain('items={c.assessments}')
    expect(
      props,
      'مقامُ «سلّم ٣ من ١٢» غيرُ ممرَّر — فيصير «من ٠» أو عددَ قائمة الانتظار معهم.',
    ).toContain('learners=')
  })

  it('والقسمُ يصيّرها ويقول كم سلّم وكم ينتظر تصحيحَه', () => {
    const code = readCode(LIST)
    expect(/items\.map\(/.test(code), 'القسمُ يستقبل التكاليفَ ولا يصيّرها').toBe(true)
    expect(code, 'لا عددَ تسليماتٍ في القائمة').toContain('a.submissions.length')
    expect(
      /submissions\.filter\([\s\S]{0,200}?under_review/.test(code),
      'ما ينتظر التصحيحَ لا يُحسب — والمقبولُ والمرفوضُ خرجا من يد المدرّب، '
      + 'فعدُّ التسليمات كلِّها يقول له عملا فرغ منه.',
    ).toBe(true)
  })

  it('والحالةُ الفارغةُ تقول الحقيقةَ — لا تُترك بياضا', () => {
    expect(readCode(LIST)).toContain('لا تكليفَ في هذه الشعبة بعد')
  })
})

describe('أزرارُ الحضور تقول حالتَها لمن لا يرى', () => {
  /** كتلةُ الأزرار الأربعة وحدَها */
  const attendanceBlock = () => {
    const code = readCode(BOARD)
    const i = code.indexOf('ATTENDANCE_OPTIONS.map')
    expect(i, 'لم تُوجد أزرارُ الحضور').toBeGreaterThan(0)
    return code.slice(i, i + 900)
  }

  it('المضبوطُ يُعلَن بـ`aria-pressed` لا باللون وحدَه', () => {
    expect(
      /aria-pressed=\{current === opt\.value\}/.test(attendanceBlock()),
      'الحالةُ باللون وحدَه: من لا يرى لا يعرف أيُّ الأربعةِ مضبوط. '
      + 'و`ChoiceGrid` في `FormKit` يضبطها — فهذا عُرفُ المستودَع.',
    ).toBe(true)
  })

  it('وكلُّ زرٍّ يحمل اسمَ صاحبه — «حاضر» أربعَ مرّاتٍ بلا اسمٍ لا تدلّ', () => {
    expect(
      /aria-label=\{`\$\{e\.user\.displayName\}/.test(attendanceBlock()),
      'لا اسمَ يربط الزرَّ بالمتعلّم — فقائمةُ عشرين متعلّما تُقرأ ثمانين زرّا متشابها.',
    ).toBe(true)
  })
})

describe('«سجّل الدرجة» بعد المراجعة لا قبلها', () => {
  it('الزرُّ معطَّلٌ ما لم تبدأ المراجعة — والخادمُ يردّه ٤٠٩ (محروسٌ في الخادم)', () => {
    const code = readCode(QUEUE)
    const i = code.indexOf('سجّل الدرجة')
    expect(i, 'لم يُوجد زرُّ الدرجة').toBeGreaterThan(0)
    /* شرطُ التعطيل يسبق نصَّ الزرّ مباشرةً — يُقرأ من أقربِ `<Button` قبله */
    const tag = code.slice(code.lastIndexOf('<Button', i), i)
    expect(
      /q\.status !== "under_review"/.test(tag),
      'الحقلُ والزرُّ مفعَّلان على `submitted` كذلك، فيكتب المدرّبُ الرقمَ '
      + 'ويضغط ويُردّ ٤٠٩ — والحالةُ معروفةٌ في الشاشة قبل الضغط.',
    ).toBe(true)
  })

  it('ويُقال لماذا — زرٌّ معطَّلٌ بلا سببٍ لغزٌ لا إرشاد', () => {
    expect(readCode(QUEUE)).toContain('اضغط «ابدأ المراجعة» أوّلا')
  })
})
