/* الدليلُ ليس البوّابة، وفهرسُه أجزاءٌ لا قائمةٌ مكتظّة (٣٠ سبتمبر ٢٠٢٦).

   صاحبُ المنصّة: «وضّح أنّ هذا دليلٌ يرشدك كيف تهيّئ منصّتك، لأنّي أخشى أن
   يعتقد أنّ هذا هو المنصّةُ نفسُها». والدليلُ مملوءٌ بصورٍ من البوّابة، فالخطرُ
   حقيقيّ: من يرى زرّا يضغطه. فأربعةُ أشياء:
   ① الغلافُ والرأسُ الثابتُ يقولانها نصّا.
   ② كلُّ صورةٍ موسومةٌ «صورةٌ للتوضيح».
   ③ كلُّ ما يخرج من الدليل إلى البوّابة يُفتح في لسانٍ آخر، والبوّابةُ تفتح
      الدليلَ في لسانٍ آخر — فيبقى كلٌّ منهما بجانب الآخر لا بدلا منه.
   ④ والفهرسُ أجزاءٌ: كلُّ قسمٍ في جزءٍ واحدٍ بترتيبه («العامودُ الجانبيّ مكتظّ»).

   والفحصُ على البنية بعد نزع التعليقات — فالتعليقُ الذي يشرح القرارَ يذكر
   ألفاظَه، ولا يُحسب حضورا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_PARTS, GUIDE_SECTIONS, shortTitle } from '../../data/trainer-guide/content'
import { guideToc } from '../../data/trainer-guide/toc'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/* والدليلُ ملفّان منذ ٥ أكتوبر ٢٠٢٦: صفحتُه، وعُدّتُه المشتركة مع «التدريبُ معنا»
   (`components/guide/GuideKit.tsx` — ومنها `Rich` بروابطه). فيُقرآن معا */
const GUIDE = code('src/pages/trainer/Guide.tsx') + '\n' + code('src/components/guide/GuideKit.tsx')
const LAYOUT = code('src/pages/trainer/TrainerLayout.tsx')

describe('① الدليلُ يقول إنّه ليس البوّابة', () => {
  it('في الغلاف وفي الرأس الثابت', () => {
    expect(GUIDE).toMatch(/function Cover\(\)[\s\S]*?هذه صفحةُ شرحٍ، لا بوّابتُك/)
    const header = GUIDE.slice(GUIDE.indexOf('<header'), GUIDE.indexOf('</header>'))
    expect(header, 'الرأسُ الثابتُ لا يقول إنّها صفحةُ شرح').toContain('صفحةُ شرح')
  })
})

describe('② كلُّ صورةٍ موسومة', () => {
  it('الوسمُ داخلَ إطار الصورة نفسِها — فلا تُعرض صورةٌ بلا وسم', () => {
    const shot = GUIDE.slice(GUIDE.indexOf('function Shot('), GUIDE.indexOf('</figure>', GUIDE.indexOf('function Shot(')))
    expect(shot).toMatch(/className="guide-shot-tag"[^>]*>صورةٌ للتوضيح</)
    /* وكلُّ صورةٍ في المحتوى تمرّ بـ`Shot` لا بـ<img> آخر */
    expect([...GUIDE.matchAll(/<img\b/g)].length, 'صورةٌ تُعرض خارج `Shot` بلا وسم').toBe(4)
  })
})

describe('③ البوّابةُ والدليلُ متجاوران لا متعاقبان', () => {
  it('ما يخرج من الدليل إلى البوّابة يُفتح في لسانٍ آخر', () => {
    expect(GUIDE, 'رابطٌ داخليٌّ بـ<Link> يستبدل الدليلَ بالبوّابة').not.toMatch(/<Link\b[^>]*to=\{?["'`]?\/trainer/)
    expect(GUIDE).toMatch(/<a href=\{s\.path\} target="_blank"/)
    expect(GUIDE).toMatch(/href="\/trainer" target="_blank"/)
    expect(GUIDE, 'روابطُ النصّ الداخليّة تُفتح في اللسان نفسِه').not.toMatch(/<Link key=\{i\} to=\{href\}/)
  })

  it('والبوّابةُ تفتح الدليلَ في لسانٍ آخر', () => {
    expect(LAYOUT).toMatch(/href=\{TRAINER_GUIDE_PATH\} target="_blank"/)
  })
})

describe('④ الفهرسُ أجزاء', () => {
  it('كلُّ قسمٍ في جزءٍ واحد، وبترتيب الدليل', () => {
    const inParts = GUIDE_PARTS.flatMap((p) => p.ids)
    expect(inParts, 'جزءٌ يذكر قسما لا وجودَ له، أو قسمٌ خارج الأجزاء، أو ترتيبٌ مخالف')
      .toEqual(GUIDE_SECTIONS.map((s) => s.id))
  })

  it('والاسمُ في الفهرس قصير — ما قبل النقطتين', () => {
    expect(shortTitle('مؤهّلاتي: عروضُ الدورات وقرارُك فيها')).toBe('مؤهّلاتي')
    for (const s of GUIDE_SECTIONS) expect(shortTitle(s.title).length, s.title).toBeLessThanOrEqual(26)
    /* والفهرسُ يُبنى منذ ٥ أكتوبر ٢٠٢٦ في `data/trainer-guide/toc.ts` لا في الصفحة —
       فيُسأل الفهرسُ المبنيُّ نفسُه عن أسمائه، لا الشيفرةُ عن نصّها */
    const labels = guideToc(new Date()).filter((g) => g.kind === 'part').flatMap((g) => g.items.map((it) => it.label))
    expect(labels).toEqual(GUIDE_SECTIONS.map((s) => shortTitle(s.title)))
  })
})

/* ═══ والدليلُ يُرى أوّلا (٣ أكتوبر ٢٠٢٦) ═══
   قولُ صاحب المنصّة: «أوضِحْ مكانَ الدليل، وغيِّر مكانَ البحث». فالدليلُ شارةٌ
   باسمها الكامل لصقَ اسم البوّابة قبل البحث، لا زرٌّ شبحيٌّ بين الأدوات. */
describe('مكانُ الدليل في رأس البوّابة', () => {
  it('باسمه الكامل، قبل البحث، ولا نبرةَ شبحٍ له', () => {
    const at = LAYOUT.indexOf('href={TRAINER_GUIDE_PATH}')
    expect(at, 'لا رابطَ للدليل في الرأس').toBeGreaterThan(-1)
    expect(at, 'البحثُ يسبق الدليلَ في الرأس').toBeLessThan(LAYOUT.indexOf('<SearchChip'))
    expect(LAYOUT.slice(at, at + 900)).toContain('دليلُ المدرّب</span>')
    expect(LAYOUT.slice(at - 200, at + 900), 'عاد الدليلُ زرّا شبحيّا').not.toMatch(/tone="ghost"/)
  })
})
