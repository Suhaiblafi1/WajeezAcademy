/* خطُّ الوثيقة — لا تُقرأ اتفاقيّةٌ بخطِّ شيفرة.

   ─────────── العطبُ الذي وُضع له هذا الحارس ───────────

   متنُ العقد يُعرض في `<pre>` — وهو الصحيح: المتنُ يُجمَّد نصّا في `bodyAr`
   بأسطره وفراغاته، وتُحفظ بصمتُه، ويُوقَّع على ما عُرض حرفا حرفا. فعنصرٌ
   يحفظ الأسطرَ هو ما يلزم.

   لكنّ المتصفّح يُعطي `<pre>` خطَّ الشيفرة من نفسه — قاعدةٌ في ورقة نمطه
   الافتراضيّة أخصُّ من الوراثة، فلا يكفي أن يُورَّث خطُّ الصفحة. فكان
   المدرّبُ يقرأ عشرين بندا يوقّع عليها بخطٍّ صُنع ليُعدّ الأعمدةَ في محرّر
   نصّ، لا ليُقرأ به نصٌّ عربيٌّ طويل. قال صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦):
   «الخط المستخدم خط كود وليس خط مفهوم… استخدم Avenir Arabic».

   ─────────── والمقيسُ بنيةٌ لا ورودُ حرف ───────────

   الفحصُ يقرأ **كلّ** `<pre>` في الصفحات الثلاث التي تعرض المتنَ، لا موضعا
   بعينه: من أضاف رابعا غدا وقع في العطب نفسِه بلا أن يحمرَّ شيءٌ لو كان
   الحارسُ يعدّ ثلاثة. ثمّ يقرأ ورقةَ النمط ليتأكّد أنّ الصنفَ **معرَّفٌ
   فعلا** وأنّ أوّلَ خطٍّ فيه هو المطلوب — فصنفٌ مكتوبٌ في JSX ولا وجودَ له
   في CSS زينةٌ تمرّ خضراء. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** الصفحاتُ التي تعرض متنَ الاتفاقية — ما يقرؤه الموقِّع، وما تراجعه الإدارة */
const CONTRACT_SURFACES = [
  'src/pages/ContractSign.tsx',
  'src/pages/admin/TrainerContracts.tsx',
] as const

/** وسمُ `<pre …>` كاملا بخصائصه — ولا يلزم أكثرُ من رأسه */
const preTags = (src: string) => [...src.matchAll(/<pre\b[^>]*>/g)].map((m) => m[0])

describe('متنُ الاتفاقية يُعرض بخطِّ قراءةٍ لا بخطِّ شيفرة', () => {
  it('كلُّ `<pre>` في صفحات العقد يحمل الصنفَ — لا موضعا بعينه', () => {
    let seen = 0
    for (const file of CONTRACT_SURFACES) {
      const tags = preTags(read(file))
      expect(tags.length, `${file}: لم يُقرأ وسمُ <pre> واحد — أتغيّر العرض؟`).toBeGreaterThan(0)
      for (const tag of tags) {
        expect(tag, `${file}: <pre> بلا «contract-prose» — يرتدّ إلى خطّ الشيفرة`).toContain('contract-prose')
        seen += 1
      }
    }
    expect(seen, 'لم يُفحَص شيءٌ أصلا').toBeGreaterThanOrEqual(3)
  })

  it('ولا يُترك للمتصفّح خطُّه: الصنفُ معرَّفٌ في ورقة النمط وأوّلُ خطوطه Avenir Arabic', () => {
    /* والتعليقاتُ تُنزَع أوّلا: تعليقُ القاعدة يشرح لمَ هي قاعدةٌ ثانيةٌ لا
       قائمةُ مُحدِّدات، فيسوق في سياقه `{ … }` — ولو قُرئ النصُّ خاما لَوقع
       الفاصلُ داخلَ التعليق فلم تُقرأ القاعدةُ أصلا. */
    const css = read('src/index.css').replace(/\/\*[\s\S]*?\*\//g, '')
    /* والحدُّ بعد الاسم لازم: بلا `(?![\w-])` يُطابق `.contract-prose-x` فيخضرّ
       الحارسُ على صنفٍ لا يحمله وسمٌ واحد — وهو صنفُ الخضرةِ الكاذبةِ بعينِه. */
    const rule = /(?:^|\n)([^{}]*\.contract-prose(?![\w-])[^{}]*)\{([^}]*)\}/.exec(css)
    expect(rule, '«contract-prose» مكتوبٌ في JSX ولا وجودَ له في CSS').toBeTruthy()
    const body = rule![2]
    const family = /font-family:\s*([^;]+);/.exec(body)
    expect(family, 'الصنفُ معرَّفٌ بلا `font-family` — فلا يغيّر شيئا').toBeTruthy()
    expect(family![1].trim().startsWith('"Avenir Arabic"'), `أوّلُ الخطوط ليس Avenir Arabic: ${family![1]}`).toBe(true)
  })

  it('والخطُّ محمَّلٌ فعلا — لا اسمٌ يرتدّ عنه المتصفّحُ صامتا', () => {
    const css = read('src/index.css')
    const faces = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*"Avenir Arabic"[^}]*\}/g)]
    expect(faces.length, 'لا `@font-face` لـAvenir Arabic — فالاسمُ وحدَه لا يجلب خطّا').toBeGreaterThan(0)
  })

  it('ولا يُنقَض المكسبُ بصنفِ خطِّ شيفرةٍ على الوسم نفسِه', () => {
    for (const file of CONTRACT_SURFACES) {
      for (const tag of preTags(read(file))) {
        expect(tag, `${file}: «font-mono» على وسمٍ يحمل «contract-prose» — أيّهما يفوز رهنُ الترتيب`).not.toContain('font-mono')
      }
    }
  })
})
