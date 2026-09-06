/* رئيسيٌّ واحدٌ في الشاشة — القاعدةُ التي أعلنها الزرُّ ولم يكن يفرضها.
 *
 * ── ما قِيس ──
 *
 * كان في المستودَع ٥٥ زرّا فيروزيَّ التعبئة و٤٨ ذهبيّا: رئيسيّان متقاربان في
 * العدد. ومتى كان للشاشة رئيسيّان فليس لها رئيسيّ — تتنازع العينُ بينهما فلا
 * تستقرّ على أوّلِ ما يجب فعله.
 *
 * فصار للزرّ سلّمُ أدوار (`ui/Button.tsx`): الذهبيُّ فعلُ الصفحة، والفيروزيُّ
 * الفعلُ المُثبِت داخل قسم. **وسلّمٌ بلا حارسٍ وصفٌ لا قاعدة.**
 *
 * ── والعطبُ الغالبُ كان واحدا ──
 *
 * زرُّ حفظِ نموذجٍ **داخل قسم** كان يُكتب ذهبيّا كزرِّ الصفحة. فشاشةُ
 * التكاملات فيها «حفظ إعدادات الدفع» و«حفظ إعدادات البريد» ذهبيّين
 * متجاورَين، وشاشةُ المالية «أنشئ الكوبون» و«أنشئ الخطة». والحقُّ أنّ
 * أيّهما ليس فعلَ الصفحة — كلاهما فعلٌ في قسمِه.
 *
 * ٤٨ ← ٢٣ ذهبيّا بعد التصويب.
 *
 * ── وما لا يُقاس هنا ──
 *
 * الملفُّ ليس الشاشةَ دائما: تبويباتٌ في ملفٍّ واحدٍ تُعرض واحدا في المرّة.
 * فالحدُّ هنا أدنى ما يُمكن قياسُه من المصدر — والحكمُ النهائيُّ بالعين. */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

/* ── المستثنى، بأسمائه ──
   معالجٌ بخطوات: خطوةٌ واحدةٌ تُرى في المرّة، فذهبيٌّ لكلّ خطوةٍ صواب.
   والاستثناءُ يُسمّى ولا يُترك ثغرةً عامّة — فمن أضاف ملفّا هنا قال لماذا. */
const STEPPED = new Set([
  'src/components/PathwayWizard.tsx',
  'src/components/CourseWizard.tsx',
])

function tsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { if (name !== 'node_modules') tsx(full, out) }
    else if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('الذهبيُّ فعلُ الصفحة، لا لونُ كلِّ فعلٍ مهمّ', () => {
  const counts = tsx(join(root, 'src'))
    .map((f) => ({ file: relative(root, f), n: (readFileSync(f, 'utf8').match(/tone="primary"/g) ?? []).length }))
    .filter((r) => r.n > 0)

  it('لا ملفَّ فيه أكثرُ من ذهبيٍّ واحد — إلّا معالجَ خطوات', () => {
    const over = counts.filter((r) => r.n > 1 && !STEPPED.has(r.file))
    expect(
      over,
      'ذهبيّان في شاشةٍ واحدةٍ يُلغيان بعضَهما.\n'
      + 'حفظُ نموذجٍ داخل قسمٍ فعلٌ مُثبِت: tone="confirm".\n'
      + over.map((r) => `  ${r.file}: ${r.n}`).join('\n'),
    ).toEqual([])
  })

  it('والمستثنى مُسمًّى وموجودٌ فعلا — لا اسمَ ميّتٍ يوسّع الثغرة', () => {
    for (const f of STEPPED) {
      expect(counts.some((r) => r.file === f), `مستثنًى لا وجودَ له: ${f}`).toBe(true)
    }
  })

  it('ولا ذهبيَّ صغير — فعلُ الصفحة لا يُكتب بحجمٍ ثانويّ', () => {
    const small: string[] = []
    for (const f of tsx(join(root, 'src'))) {
      if ((readFileSync(f, 'utf8').match(/tone="primary" size="sm"/g) ?? []).length) {
        small.push(relative(root, f))
      }
    }
    expect(small, `ذهبيٌّ بحجمٍ صغير — إمّا ليس فعلَ الصفحة، وإمّا حجمُه خطأ:\n${small.join('\n')}`)
      .toEqual([])
  })
})
