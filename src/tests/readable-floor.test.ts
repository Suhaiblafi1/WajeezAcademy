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
