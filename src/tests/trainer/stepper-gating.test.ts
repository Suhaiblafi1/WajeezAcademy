/* السلّمُ يُصعد درجةً درجة — وزرُّه المضاءُ يحفظ ثمّ ينقل إن تمّت.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «مراحلُ تعديل الشعبة معقّدة، يجب أن
   تظهر بشريطٍ واضح… زرُّ التالي يجب أن يكون مضاءً لأنّه الأهمّ هنا، ولا ينتقل
   للتالي إلّا بعد أن يتمّ النقطةَ السابقة ويقوم: تمّ وحفظ».

   وثلاثةُ أشياءَ تُحرَس هنا، كلٌّ ينقض وحدَه فيُحرَس وحدَه:
   ① الزرُّ المضاءُ واحدٌ في الشريط: ذهبيٌّ يحفظ ويتقدّم، أو يُرسل في الأخيرة.
   ② والانتقالُ ثمرةُ التمام: يُسأل الخادمُ بعد الحفظ، فإن لم تتمّ بقي
      وسمّى ما ينقص — لا ينقل ثمّ يعتذر.
   ③ وما بعد أوّلِ ناقصةٍ لا يُملأ، والقفلُ من قائمة الخادم. وصار يُفتح
      معاينةً (١٠ أكتوبر ٢٠٢٦): «افتح الألسنةَ كلَّها ليرى ما ينتظره» — يرى
      حقولَها مطفأةً، ويملؤها بالترتيب كما كان.

   والفحصُ على البنية لا على ورود حرف: الشيفرةُ بلا تعليقاتها، والمقتطَعُ من
   مواضعه (الشريط، ودالّةُ الانتقال، وزرُّ الدرجة). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const head = WS.slice(WS.indexOf('<Bar'), WS.indexOf('</Bar>'))
const rail = head.slice(head.indexOf('<ol '), head.indexOf('</ol>'))
const between = (from: string, to: string) => WS.slice(WS.indexOf(from), WS.indexOf(to, WS.indexOf(from)))

describe('① زرٌّ مضاءٌ واحدٌ في الشريط', () => {
  it('⚠️ الذهبيُّ في الشريط — وهو الذهبيُّ الوحيدُ في الشاشة', () => {
    expect((head.match(/tone="primary"/g) ?? []).length, 'لا زرَّ مضاءً في الشريط').toBe(1)
    expect((WS.match(/tone="primary"/g) ?? []).length, 'ذهبيٌّ ثانٍ في الشاشة يُنازع زرَّ الشريط').toBe(1)
  })

  it('⚠️ ويحفظ ويتقدّم في الدرجات، ويُرسل في الأخيرة', () => {
    const btn = head.slice(head.indexOf('tone="primary"'), head.indexOf('</Button>', head.indexOf('tone="primary"')))
    expect(btn, 'الزرُّ لا يحفظ ولا يتقدّم').toContain('saveAndContinue()')
    expect(btn, 'الزرُّ لا يُرسل في الدرجة الأخيرة').toContain('submitNow()')
    expect(btn, 'اسمُ الزرّ لا يقول إنّه يحفظ').toContain('احفظ وتابِع')
  })

  it('ولا يبقى في الدرجات زرُّ حفظٍ يُنازعه — «احفظ المحاور» وأخواتُه ذهبت', () => {
    for (const old of ['احفظ المحاور', 'احفظ المصادر', 'احفظ البيانات']) {
      expect(WS, `عاد زرُّ «${old}» بجانب «احفظ وتابِع»`).not.toContain(old)
    }
  })
})

describe('② الانتقالُ ثمرةُ التمام لا نقرةٌ تسبقه', () => {
  const fn = between('const saveAndContinue', 'const submitNow')

  it('⚠️ يحفظ أوّلا، ثمّ يسأل الخادمَ من جديد', () => {
    const persist = fn.indexOf('persist()')
    const reload = fn.indexOf('await load()')
    expect(persist, 'لا حفظَ قبل الانتقال').toBeGreaterThan(-1)
    expect(reload, 'يحكم على ما في اليد لا على ما في الخادم').toBeGreaterThan(persist)
  })

  it('⚠️ ولا ينقل إلّا في فرع التمام — وغيرُه يسمّي ما ينقص', () => {
    const done = fn.indexOf('.done)')
    const move = fn.indexOf('setStage(next.key)')
    const gaps = fn.indexOf('setGaps(gapsFor(')
    expect(done, 'لا سؤالَ عن التمام').toBeGreaterThan(-1)
    expect(move, 'ينقل قبل أن يسأل').toBeGreaterThan(done)
    expect(gaps, 'الناقصُ لا يُسمّى').toBeGreaterThan(move)
    /* والفرعان منفصلان: النقلُ داخلَ `if` والتسميةُ في `else` */
    expect(fn.slice(move, gaps), 'التسميةُ ليست في فرعٍ غيرِ فرع النقل').toContain('} else {')
  })

  it('والتمامُ من قائمة الخادم لا من ظنّ الشاشة', () => {
    expect(fn, 'التمامُ يُخمَّن في الشاشة').toMatch(/fresh\.checklist\.find\(/)
  })

  it('وما ينقص يُعرض لاصقا في الشريط — يقرؤه وهو ينزل إلى الحقل', () => {
    /* والشرطُ يبدأ بما ينقص نفسِه — لا يُسبَق بشرطٍ يُطفئه (`{false && gaps…`).
       وما ينقص صار في `items` (٥ أكتوبر ٢٠٢٦): بجانبه «لم يُحفظ» ومواضعُه — `save-never-traps.test.ts` */
    expect(head, 'ما ينقص لا يُعرض في الشريط').toMatch(/\{gaps && gaps\.items\.length > 0 && \(/)
    expect(head, 'ما ينقص لا يُعلَن لقارئ الشاشة').toMatch(/role="alert"/)
  })
})

describe('③ وما بعد أوّلِ ناقصةٍ مقفل', () => {
  it('⚠️ الدرجةُ تُفتح إن تمّ كلُّ ما قبلها — والحكمُ من القائمة', () => {
    const rule = WS.slice(WS.indexOf('const canOpen'), WS.indexOf('\n', WS.indexOf('const canOpen')))
    expect(rule, 'لا قاعدةَ للقفل').toBeTruthy()
    expect(rule, 'القفلُ لا يقرأ ما قبل الدرجة').toMatch(/STAGES\.slice\(0, i\)\.every\(/)
    /* والدرجةُ تتمّ بصفوفها في قائمة الخادم كلِّها (٢٧ سبتمبر ٢٠٢٦) — «المهامُّ
       والمصادر» صفّان في درجةٍ واحدة، ولا تتمّ بأحدهما */
    expect(WS, 'التمامُ لا يُقرأ من قائمة الخادم').toMatch(/const doneOf = \(k: Stage\) => STAGE_KEYS\[k\]\.every\(\(key\) => byKey\.get\(key\)\?\.done/)
  })

  it('⚠️ والدرجةُ المقفلةُ تُفتح معاينةً — تُرى ولا تُملأ (١٠ أكتوبر ٢٠٢٦)', () => {
    expect(rail, 'القفلُ يُحسب ولا يُطبَّق').toMatch(/const open = canOpen\(i\)/)
    /* تُفتح للنظر: زرُّها لا يُطفأ */
    expect(rail, 'الدرجةُ المقفلةُ لا تُفتح للمعاينة').not.toMatch(/disabled=\{!open\}/)
    /* ولا تُملأ: الدرجةُ المعايَنةُ تُطفئ حقولَها كما تُطفئها المرسَلة */
    expect(WS, 'المعاينةُ لا تُحسب من قفل الشريط').toMatch(/const previewing = stageAt >= 0 && !canOpen\(stageAt\);/)
    expect(WS, 'حقولُ المعايَنة تُملأ').toMatch(/const locked = planLocked \|\| previewing;/)
    /* والسببُ يُقال على الزرّ وفي الشاشة — لا قفلٌ صامت */
    expect(rail, 'القفلُ لا يقول ما يفتحه').toMatch(/تملؤها بعد أن تُتمّ «\$\{blocker\.label\}»/)
    expect(rail, 'حالُ المعاينة لا يُسمع').toContain('للمعاينة — تُملأ بعد أن تُتمّ ما قبلها')
    const banner = between('{previewBlocker && (', '</Inset>')
    expect(banner, 'المعاينةُ لا تقول إنّها معاينة').toContain('معاينة')
    expect(banner, 'المعاينةُ لا تدلّ على ما يُملأ أوّلا').toContain('openStage(previewBlocker.key)')
  })

  it('⚠️ وزرُّ الشريط في المعاينة يعيد إلى ما يُملأ — لا يحفظ ولا يُرسل منها', () => {
    const btn = head.slice(head.indexOf('tone="primary"'), head.indexOf('</Button>', head.indexOf('tone="primary"')))
    const click = btn.slice(btn.indexOf('onClick='), btn.indexOf('\n', btn.indexOf('onClick=')))
    expect(click, 'زرُّ الشريط في المعاينة يحفظ أو يُرسل').toMatch(/previewBlocker \? openStage\(previewBlocker\.key\) : atApproval/)
  })
})
