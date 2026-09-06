/* سقفٌ يهبط ولا يرتفع — الحارسُ الذي يمنع عودةَ الفوضى.
 *
 * ── لماذا لا يكفي بناءُ المكوّنات ──
 *
 * في هذا المستودَع مكتبةُ `ui/` سابقة: `button` و`badge` و`collapsible`.
 * بُنيت، ثمّ استعملها **ثمانيةُ ملفّاتٍ من ١٦٥**، وكُتب ٤٧٢ زرّا بيدٍ إلى
 * جانبها. فالمكوّنُ الذي لا يُتبنّى لا يُصلح شيئا — يزيد الخيارات فقط.
 *
 * والسببُ أنّ لا شيءَ كان يجعل الانحرافَ مرئيّا: من يكتب الصيغةَ بيده لا
 * يحمرّ عنده شيء، ولا يعلم أنّه صار الصيغةَ رقم ٧٦٤.
 *
 * ── فالسقفُ هو الآليّة، لا النصيحة ──
 *
 * يُعدُّ ما بقي مكتوبا بيده، ويُشترط ألّا يتجاوز الرقمَ المسجَّل أدناه. فأيُّ
 * صيغةٍ جديدةٍ **تُحمِّر البوّابةَ فورا**، وأيُّ ترحيلٍ يُنقص الرقم فيُخفَض
 * السقفُ معه في الالتزام نفسِه.
 *
 * والاتّجاهُ في اتّجاهٍ واحد: **لا يُرفع سقفٌ أبدا.** ومن احتاج صيغةً لا
 * يغطّيها السلّم، فالنقصُ في السلّم لا في القاعدة — تُضاف الدرجةُ إلى
 * `ui/Surface.tsx` ويُخفَض السقف.
 *
 * ── وحدُّه صريح ──
 *
 * يعدّ **النصوص**، لا الجمال. صفحةٌ كلُّها `Panel` قد تبقى قبيحة. لكنّ
 * التوحيدَ شرطُ التحسين لا بديلُه: ما دامت الصيغُ سبعَمئةٍ، فتحسينُ شاشةٍ
 * لا يبلغ أختَها — وهو بعينه ما جعل الحكمَ يُقرأ صادقا: «التصاميمُ لم تتغيّر».
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = join(root, 'src')
/** المكتبةُ نفسُها تحمل هذه الصيغَ بحقّ — هي مصدرُها */
const EXEMPT = join('src', 'components', 'ui')

/* ═══ السقوف — تُخفَض ولا تُرفع ═══

   قِيست في ٦ سبتمبر ٢٠٢٦، وتُخفض مع كلّ ترحيل: ٧٦٠ ← ٧٥١ (Support) ← ٧٣٨ (Finance) ← ٤٦٦ ← ٢٩١ (بالنبرة) · ٢٣٤ ← ٢٣٢. أي ٧٦٣ ← ٢٩١ في يومٍ واحد. وكلُّ ترحيلٍ يُنقص العددَ يُخفض
   السقفَ في الالتزام نفسِه — وإلّا فُتح البابُ لصيغةٍ جديدةٍ مكانَ المُرحَّلة. */
const CEILING = {
  /** مستطيلٌ بحدٍّ وانحناء — مكانُه `Panel` أو `Card` أو `Inset` */
  surface: 291,
  /** زرٌّ بصيغةٍ كاملةٍ مكتوبةٍ في مكانها */
  button: 232,
} as const

const PATTERNS = {
  surface: /className="[^"]*\brounded-(?:xl|2xl|3xl)\b[^"]*\bborder\b[^"]*"/g,
  button: /className="[^"]*\bcursor-pointer\b[^"]*\brounded-full\b[^"]*"/g,
} as const

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') tsxFiles(full, out)
    } else if (name.endsWith('.tsx')) {
      if (!relative(root, full).startsWith(EXEMPT + sep)) out.push(full)
    }
  }
  return out
}

function countAll() {
  const files = tsxFiles(SRC)
  const counts: Record<keyof typeof PATTERNS, number> = { surface: 0, button: 0 }
  const worst: Record<string, number> = {}
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    let here = 0
    for (const key of Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]) {
      const n = src.match(PATTERNS[key])?.length ?? 0
      counts[key] += n
      here += n
    }
    if (here > 0) worst[relative(root, f)] = here
  }
  return { files: files.length, counts, worst }
}

describe('سقفُ الصيغ المكتوبة بيدها', () => {
  const { files, counts, worst } = countAll()

  it('المسحُ يقرأ الشجرةَ فعلا — فلا يمرّ السقفُ بصفرٍ كاذب', () => {
    /* حارسُ الحارس: خطأٌ في المسار يجعل العددَ صفرا فيمرّ كلُّ شيء */
    expect(files, 'لم يُقرأ أيُّ ملفّ — تعطّل المسحُ نفسُه').toBeGreaterThan(100)
  })

  it.each(Object.keys(CEILING) as (keyof typeof CEILING)[])(
    '«%s» لا يتجاوز سقفَه',
    (key) => {
      const top = Object.entries(worst).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([f, n]) => `${f} (${n})`).join(' · ')
      expect(
        counts[key],
        `صيغٌ مكتوبةٌ بيدها زادت: ${counts[key]} > ${CEILING[key]}.\n`
        + `استعمل Panel/Card/Inset من «@/components/ui/Surface» بدلها.\n`
        + `وإن كان ترحيلا يُنقص العدد، اخفض السقفَ في هذا الملفّ.\n`
        + `أكثرُ الملفّات: ${top}`,
      ).toBeLessThanOrEqual(CEILING[key])
    },
  )

  it('والسقفُ لا يُرفَع — يُخفَض مع كلّ ترحيل', () => {
    /* لو نُقل ملفٌّ إلى السلّم ولم يُخفَض السقفُ، بقي فراغٌ يملؤه انحرافٌ
       جديدٌ بلا أن يحمرّ شيء. فيُشترط أن يبقى السقفُ ملتصقا بالواقع. */
    for (const key of Object.keys(CEILING) as (keyof typeof CEILING)[]) {
      const slack = CEILING[key] - counts[key]
      expect(
        slack,
        `سقفُ «${key}» أعلى من الواقع بـ${slack}. اخفضه إلى ${counts[key]} — `
        + 'وإلّا صار فراغا يملؤه انحرافٌ جديدٌ صامتا.',
      ).toBeLessThanOrEqual(0)
    }
  })
})
