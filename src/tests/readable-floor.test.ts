/* أصغرُ حجمٍ مسموحٍ في المنصّة — حدٌّ واحدٌ باسمٍ واحد.

   العطب: الشاشاتُ كانت تنزل إلى تسعةِ بكسلاتٍ وعشرةٍ في **٢٧٥ موضعا**،
   أكثرُها في شاشات الفريق حيث تُقرأ الجداولُ والشارات يوما كاملا. والقياسُ
   بالمتصفّح على هاتفٍ عرضُه ٣٩٠ بكسلا وجد نصوصا بتسعةِ بكسلاتٍ في بوّابة
   المدرّب وشاشة الشعب — وهو حجمٌ يُمسَح لا يُقرأ.

   وسببُ الانتشار أنّ الحجمَ كان رقما مكتوبا في مكانه (`text-[10px]`): من
   نسخ صفّا نسخ رقمَه، ولا شيءَ يمنع أن يُكتب تسعةً في الصفّ التالي. فصار
   للحجم اسمٌ (`text-micro` بأحدَ عشرَ بكسلا) وهذا الاختبارُ حدُّه.

   وهو يحرس ثلاثةَ أشياء:
   ١) لا رقمَ دون أحدَ عشرَ بكسلا في أيّ ملفّ واجهة.
   ٢) و`micro` معرَّفٌ في إعداد تايلويند فعلا — وإلّا فالصنفُ اسمٌ بلا حجم
      والنصُّ يرتدّ إلى حجمِ أبيه صامتا.
   ٣) وأهدافُ اللمس: مربّعُ الاختيار والوسمُ الذي يلفّه لهما حدٌّ في الأنماط
      الأساسيّة — فلا يبقى صفٌّ ارتفاعُه سبعةَ عشرَ بكسلا يُخطئه الإصبع. */

import { describe, expect, it } from 'vitest'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

/* أيُّ حجمٍ بالبكسل مكتوبٍ بين قوسين: `text-[10px]` و`text-[9.5px]` وأمثالُها */
const ARBITRARY = /text-\[(\d+(?:\.\d+)?)px\]/g

describe('أصغرُ حجمٍ مقروء', () => {
  it('لا نصَّ دون أحدَ عشرَ بكسلا في أيّ ملفّ واجهة', () => {
    const offenders: string[] = []
    for (const file of walk('src')) {
      /* الاختباراتُ نفسُها تذكر الأصنافَ نصّا — فتُستثنى من العدّ */
      if (file.startsWith('src/tests/')) continue
      const src = read(file)
      for (const m of src.matchAll(ARBITRARY)) {
        if (Number(m[1]) < 11) offenders.push(`${file}: ${m[0]}`)
      }
    }
    expect(offenders, `استعمل text-micro بدلا منها:\n${offenders.join('\n')}`).toEqual([])
  })

  /* ═══ والاسمُ لا يكفي حتّى يُستعمَل ═══

     `text-micro` معرَّفٌ منذ قرارِ الأرضيّةِ المقروءة — و**٦٤٦ موضعا ظلّ يكتب
     `text-[11px]`** إلى ٦ سبتمبر، ومعها ٥٦ بـ`text-[12px]` وهو `text-xs`
     بعينه. أي أنّ التجريدَ وُجد ولم يُتبنَّ، وهو النمطُ نفسُه الذي أصاب
     مكتبةَ `ui/` الأولى.

     والحدُّ أعلاه يمنع ما **دون** الأحدَ عشر. وهذا يمنع كتابةَ الرقم حيث له
     اسم: لا لأنّ الناتجَ يختلف — هو مطابق — بل لأنّ اسما واحدا يُغيَّر في
     ملفٍّ واحد، ورقما مكتوبا في ستّمئة موضعٍ لا يُغيَّر أبدا. */
  it('ولا يُكتب رقمٌ حيث له اسمٌ في السلّم', () => {
    /* السلّمُ كلُّه — ولا درجةَ بينها. و٣٣ حجما كانت تسكن الفراغات (١٣ و١٣٫٥
       و١٥ و٢٦) فرُدّت إلى أقرب درجة: الصغيرةُ صعودا (اتّجاهُ قرار الأرضيّة)،
       وسعرُ لوح الشراء نزولا درجتَين لا صعودا خمسا — فقفزةٌ تكسر السطر. */
    const NAMED: Record<string, string> = {
      '11': 'text-micro', '11.5': 'text-xs', '12': 'text-xs', '12.5': 'text-xs',
      '13': 'text-sm', '13.5': 'text-sm', '14': 'text-sm',
      '15': 'text-base', '16': 'text-base', '20': 'text-xl', '24': 'text-2xl',
      '30': 'text-3xl',
    }

    /* ⚠️ و٢٦ ليست في القائمة بقصد: قرارٌ مقيسٌ سبقني، وله حارسُه في
       `student/cohort-schedule.test.ts` — «السعرُ بحجم ٣٠ نقطة عاد» مرفوض،
       و«بحجمٍ يُقرأ بلا إسراف» مطلوب. فرددتُه إلى ٢٤ ثمّ أرجعتُه: ما قِيس
       قبلي لا يُصحَّح بتقريبٍ حسابيّ. */
    const offenders: string[] = []
    for (const file of walk('src')) {
      if (file.startsWith('src/tests/')) continue
      for (const m of read(file).matchAll(ARBITRARY)) {
        const name = NAMED[m[1]]
        if (name) offenders.push(`${file}: ${m[0]} ← ${name}`)
      }
    }
    expect(offenders, `أحجامٌ لها أسماءٌ في السلّم:\n${offenders.slice(0, 10).join('\n')}`)
      .toEqual([])
  })

  it('«micro» حجمٌ معرَّفٌ لا اسمٌ بلا حجم', () => {
    const cfg = read('tailwind.config.js')
    expect(cfg).toMatch(/fontSize:\s*\{[^}]*micro:\s*'11px'/s)
    /* وبلا ارتفاعِ سطرٍ معه — كي تبقى أصنافُ `leading-*` عاملةً كما كانت */
    expect(cfg).not.toMatch(/micro:\s*\[/)
  })

  it('حجمُ الهدف بوّابةٌ دائمة تُقاس على هاتف — لا جولةً تُصلح مرّةً', () => {
    /* القياسُ اليدويُّ يُصلح مرّةً ويعود العطبُ في الدفعة التالية. فالقاعدةُ
       في الفحص الدائم، وتُقاس على منفذٍ عرضُه ٣٩٠ — لأنّ الأهدافَ تنكسر
       حيث لا يُفحَص: على الهاتف، حيث يضغط الشريطُ `flex` ما فيه. */
    const probe = read('scripts/a11y/probe.browser.js')
    const audit = read('scripts/a11y-audit.ts')
    expect(probe).toMatch(/targets: function \(\)/)
    expect(audit).toContain("'target-size'")
    expect(audit).toContain('setViewportSize({ width: 390, height: 844 })')
    expect(audit).toContain('...(await targetsOnPhone(page)),')
    /* الحدُّ ٢٤ لا ٤٤: إلزامُ AA في 2.5.8، و٤٤ توصيةُ AAA */
    const rule = probe.slice(probe.indexOf('targets: function'))
    expect(rule).toContain('r.width >= 24 && r.height >= 24')
    /* والاستثناءاتُ الثلاثةُ من المعيار نفسِه — بلا واحدٍ منها يصرخ الفحصُ
       في غير موضعه فيُهمَل كلُّه */
    expect(rule, 'الرابطُ في جملة').toContain("el.closest('p, li, td, dd, blockquote, figcaption')")
    expect(rule, 'الوسمُ الذي يلفّ الحقل').toContain("el.closest('label')")
    expect(rule, 'المعطَّل').toContain("aria-disabled")
  })

  it('مربّعُ الاختيار والوسمُ الذي يلفّه هدفان يُصابان', () => {
    const css = read('src/index.css')
    const box = css.slice(css.indexOf('input[type="checkbox"]'))
    expect(box).toMatch(/width:\s*16px/)
    expect(box).toMatch(/height:\s*16px/)
    /* والوسمُ: اثنان وثلاثون هي الأصغر — صفٌّ بنصٍّ من ١١px ارتفاعُه ١٧ */
    expect(css).toContain('label:has(> input[type="checkbox"])')
    expect(css.slice(css.indexOf('label:has(> input[type="checkbox"]')))
      .toMatch(/min-height:\s*32px/)
  })
})

/* ═══ السحبُ الجانبيُّ على الهاتف — القاعدةُ كانت صحيحةً في الموضع الخطأ ═══

   شكوى صاحب المنصّة (١٢ سبتمبر ٢٠٢٦): «اجعل الصفحات على التلفون ثابتة لا
   تتحرّك». وكانت `overscroll-behavior-x: none` مكتوبةً في الورقة — على
   `body` وحدَه. وهي هناك بلا أثر: الانتشارُ إلى إطار العرض من **الجذر** لا
   من `body`، بخلاف `overflow` التي تنتشر من الاثنين.

   وقِيست بالمتصفّح قبل الإصلاح: `html` تحسب `auto` و`body` تحسب `none` —
   فإطارُ العرض على `auto`، والسحبُ يرتدّ رغم أنّ المنعَ مكتوب.

   فالحارسُ على **الموضع** لا على ورودِ الخاصّيّة في الملفّ: أن تكون في كتلة
   `html` نفسِها. ولو نُقلت إلى `body` وحدَه ثانيةً لسقط. */
describe('الصفحةُ لا تُسحب جانبا على الهاتف', () => {
  it('ومنعُ الارتداد في كتلة `html` — لا في `body` وحدَه', () => {
    const css = readFileSync(join(root, 'src/index.css'), 'utf8')
    const start = css.indexOf('\n  html {')
    expect(start, 'لا كتلةَ `html` في الورقة الأساسيّة').toBeGreaterThan(-1)
    /* بلا التعليقات: ذِكرُ الخاصّيّة في شرحٍ ليس تطبيقا لها — ومرّ هذا
       الحارسُ خضراءَ على شرحٍ يذكرها قبل أن يُشدّ. */
    const block = css.slice(start, css.indexOf('\n  }', start)).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(block, 'منعُ الارتداد ليس في كتلة `html` — وعلى `body` وحدَه لا ينتشر إلى إطار العرض')
      .toMatch(/overscroll-behavior-x:\s*none/)
    /* والقصُّ يبقى: زخارفُ الخلفيّة تمتدّ خارج الشاشة عمدا */
    expect(block).toMatch(/overflow-x:\s*clip/)
  })
})
