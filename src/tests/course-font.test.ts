/* خطّ متن الدورة — طبقةٌ مقصورةٌ على المتن، وترتدّ وحدها.

   المتن يُقرأ قراءةً طويلة فأُفرد له خطّ. وثلاثة أشياء تنكسر بصمت لو انفرط
   أحدها: أن يهرب اسم الصنف من حاوية المتن إلى الواجهة كلّها (فيصير قرارُ
   المتن قرارَ المنصّة)، أو أن يسقط الارتدادُ العربيّ (فتُقرأ الصفحة بخطّ
   لاتينيّ لا يعرف العربية حين يغيب الملفّ — وهو غائبٌ اليوم)، أو أن يُدفع
   ملفُّ خطٍّ من صيغة سطح المكتب إلى المستودع (المستودع عامّ والموقع تجاريّ،
   وترخيص سطح المكتب لا يُبيح التضمين على الويب، والأثر يبقى في تاريخ Git
   ولو حُذف الملفّ لاحقا).

   فالحارس هنا يقرأ الملفّات نفسها لا وصفها. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const FAMILY = '"Avenir Arabic"'
/* الارتداد الذي تُقرأ به الصفحة اليوم — لا ملفّ في public/fonts بعد */
const FALLBACK = '"IBM Plex Sans Arabic"'

describe('خطّ متن الدورة', () => {
  it('الصنف معرَّف مرّةً واحدة، وأوّلُه الخطّ وبعده ارتدادٌ عربيّ', () => {
    const css = read('src/index.css')
    const rules = css.match(/\.course-prose\s*\{[^}]*\}/g) ?? []
    expect(rules, 'قاعدة .course-prose مفقودة أو مكرّرة').toHaveLength(1)

    const stack = /font-family:\s*([^;}]+)/.exec(rules[0] ?? "")?.[1]?.trim()
    expect(stack, 'القاعدة بلا font-family').toBeTruthy()
    const faces = stack!.split(',').map((f) => f.trim())
    expect(faces[0], 'الخطّ ليس أوّل المكدّس').toBe(FAMILY)
    expect(faces.slice(1), 'لا ارتداد عربيّ بعده').toContain(FALLBACK)
  })

  it('كلّ @font-face للخطّ يشير إلى woff2 محلّيّ ولا يحجب النصّ', () => {
    const css = read('src/index.css')
    const blocks = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).filter((b) => b.includes(FAMILY))
    expect(blocks.length, 'لا @font-face للخطّ').toBeGreaterThan(0)

    for (const b of blocks) {
      const src = /src:\s*([^;}]+)/.exec(b)?.[1] ?? ''
      expect(src, `مصدر ليس woff2 محلّيّا: ${src}`).toMatch(/url\("\/fonts\/[\w.-]+\.woff2"\)/)
      /* بلا swap يبقى المتن غيرَ مرئيّ حتى يصل الملفّ — أو أبدا لو لم يصل */
      expect(b, 'font-display: swap مفقود').toMatch(/font-display:\s*swap/)
    }
  })

  it('الصنف على حاوية المتن وحدها لا على الواجهة', () => {
    const src = read('src/components/LessonBody.tsx')
    /* الجذر المُعاد من LessonBody — لا أيّ عنصر داخليّ */
    const rootEl = /export default function LessonBody[\s\S]*?return \(\s*(<[a-z][^>]*>)/.exec(src)?.[1]
    expect(rootEl, 'تعذّر العثور على جذر LessonBody').toBeTruthy()
    expect(rootEl!, 'جذر المتن لا يحمل course-prose').toContain('course-prose')

    /* خارج ملفّ المتن: لا أحد يلبس الصنف — ولا index.css نفسه يضعه على body */
    const carriers = execFileSync(
      'git',
      ['grep', '-l', '--', 'course-prose'],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== 'src/tests/course-font.test.ts')
    expect(carriers.sort()).toEqual(['src/components/LessonBody.tsx', 'src/index.css'])
  })

  it('لا ملفّ خطٍّ بصيغة سطح المكتب في المستودع', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n')
    /* woff2 مسموحٌ تحت public/fonts وحده (حزمة الويب المرخَّصة)؛ أمّا otf وttf
       وeot وwoff فصيغُ سطح مكتبٍ أو إرث، ولا موضع لها هنا بحال */
    const desktop = tracked.filter((f) => /\.(otf|ttf|ttc|eot|woff)$/i.test(f))
    expect(desktop, 'ملفّ خطٍّ لا يُخدَم من الويب دخل المستودع').toEqual([])

    const stray = tracked.filter((f) => /\.woff2$/i.test(f) && !f.startsWith('public/fonts/'))
    expect(stray, 'woff2 خارج public/fonts').toEqual([])
  })
})
