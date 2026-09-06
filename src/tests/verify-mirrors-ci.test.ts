/* أمرُ التحقّق يطابق البوّابةَ — حارسُ الخطإ الذي كلّفني دفعتَين حمراوَين.
 *
 * ── ما وقع ──
 *
 * شغّلتُ `npx tsc --noEmit` قبل كلّ دمجٍ فمرّ نظيفا. **و`tsconfig.json` ملفُّ
 * حلٍّ بمراجعَ فقط: فحصُه لا يفحص شيئا** — والتعليقُ فوق خطوة البوّابة يقول
 * ذلك حرفا. فمرّت ٩٤ خطأَ نوعٍ إلى `main` واحمرّت البوّابةُ دفعتَين.
 *
 * ── ولماذا حارسٌ لا عزمٌ على الانتباه ──
 *
 * الفرقُ بين ما أشغّله وما تشغّله البوّابةُ لا يُحمِّر شيئا عندي — بل يُخفي
 * الأخطاء. وهو الصنفُ الذي لا يُصلحه التذكّر: يُصلحه أن يصير للتحقّق **أمرٌ
 * واحدٌ في `package.json`**، وأن يُقاس أنّه ما زال يطابق البوّابة.
 *
 * فإن أُضيفت خطوةٌ إلى البوّابة ولم تُضَف إلى `verify`، احمرّ هذا الاختبارُ
 * وقال أيَّها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
const ci = read('.github/workflows/ci.yml')

/** أوامرُ الوظيفة السريعة في البوّابة — ما يُفحَص قبل كلّ دمج */
const GATE = [
  { what: 'أنواعُ الواجهة', run: 'tsc --noEmit -p tsconfig.app.json' },
  { what: 'أنواعُ الخادم', run: 'tsc --noEmit -p tsconfig.node.json' },
  { what: 'دينُ التلويم', run: 'scripts/lint-baseline.ts' },
  { what: 'اختباراتُ الواجهة', run: 'vitest run src/tests' },
]

describe('«npm run verify» يطابق ما تفحصه البوّابة', () => {
  it('الأمرُ معرَّفٌ — فلا يُخترع في كلّ مرّة', () => {
    expect(pkg.scripts.verify, 'لا أمرَ تحقّقٍ واحد').toBeTruthy()
    expect(pkg.scripts.typecheck).toBeTruthy()
  })

  it.each(GATE)('يشمل $what', ({ run }) => {
    const all = `${pkg.scripts.verify} ${pkg.scripts.typecheck}`
    expect(all, `البوّابةُ تفحصه و«verify» لا يفحصه: ${run}`).toContain(run)
  })

  it('ولا يفحص `tsconfig.json` — ملفُّ حلٍّ بمراجعَ لا يفحص شيئا', () => {
    /* هذا بعينه الخطأُ الذي كلّف دفعتَين: `tsc --noEmit` بلا `-p` يقرؤه */
    expect(pkg.scripts.typecheck).not.toMatch(/tsc --noEmit(?! -p)/)
  })

  it('وكلُّ خطوةٍ يعدّها الحارسُ موجودةٌ في البوّابة فعلا', () => {
    /* وإلّا حرس الحارسُ بوّابةً متخيَّلة */
    for (const { run } of GATE) expect(ci, `ليست في ci.yml: ${run}`).toContain(run)
  })
})
