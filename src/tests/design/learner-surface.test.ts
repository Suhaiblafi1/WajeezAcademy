/* شاشاتُ المتعلّم — أرضيّةُ الخطّ، وعناصرُ الشرح، وما حُذف (البنود ٥٤–٦٣).

   هذه بنودُ تصميم، وأكثرُها يُقاس بالعين لا بالفحص. فما يُحرَس هنا هو ما
   **ينكسر صامتا بالنسخ واللصق**: رقمُ حجمٍ يعود، وحقلٌ يُعاد، وأصلٌ ميّتٌ
   يُشار إليه، ونصٌّ يُنسخ بدل أن يُنادى مكوّنُه. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

const ALL = walk('src').filter((f) => !f.startsWith('src/tests/'))

/* ─────────── من هي «شاشةُ المتعلّم»؟ — تُشتقّ لا تُكتب قائمةً ───────────

   قائمةٌ مكتوبةٌ باليد تشيخ عند أوّل ملفٍّ جديد. فالجذورُ تُعرَّف بموضعها
   (صفحاتُ الزائر في `pages/` مباشرةً، وبوّابةُ الطالب، والتشخيص، والرئيسة)،
   ثمّ يُتبَع رسمُ الاستيرادات. وما يبلغه الفريقُ أيضا **يُستثنى**: رفعُ
   الأرضيّة قرارُ شاشات المتعلّم وحدَها، وجداولُ الفريق كثيفةٌ بقصد. */
const isLearnerRoot = (f: string) =>
  /^src\/pages\/[^/]+\.tsx$/.test(f) || /^src\/pages\/(student|diagnostic|home)\//.test(f)
const isStaffRoot = (f: string) => /^src\/pages\/(admin|trainer|advisor)\//.test(f)

function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2)
  else if (spec.startsWith('.')) {
    const parts = from.split('/').slice(0, -1)
    for (const seg of spec.split('/')) {
      if (seg === '.') continue
      else if (seg === '..') parts.pop()
      else parts.push(seg)
    }
    base = parts.join('/')
  } else return null
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (ALL.includes(c)) return c
  }
  return null
}

const IMPORTS = new Map(
  ALL.map((f) => [
    f,
    [...read(f).matchAll(/from\s+['"]([^'"]+)['"]/g)]
      .map((m) => resolveImport(f, m[1]))
      .filter((x): x is string => x !== null),
  ]),
)

function reachable(roots: string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...roots]
  while (stack.length) {
    const f = stack.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    for (const d of IMPORTS.get(f) ?? []) stack.push(d)
  }
  return seen
}

const LEARNER_ONLY = (() => {
  const learner = reachable(ALL.filter(isLearnerRoot))
  const staff = reachable(ALL.filter(isStaffRoot))
  return [...learner].filter((f) => !staff.has(f)).sort()
})()

describe('٥٤ · أرضيّةُ الخطّ في شاشات المتعلّم', () => {
  it('الجذورُ تُشتقّ فعلا — ولو انكسر الاشتقاق لخضرّ ما بعده بلا معنى', () => {
    expect(LEARNER_ONLY.length).toBeGreaterThan(80)
    expect(LEARNER_ONLY).toContain('src/pages/CoursePath.tsx')
    expect(LEARNER_ONLY).toContain('src/components/CohortPicker.tsx')
    expect(LEARNER_ONLY).not.toContain('src/pages/admin/Users.tsx')
  })

  it('لا خطَّ دون اثني عشرَ بكسلا فيها — و`micro` أرضيّةُ الفريق لا أرضيّتُها', () => {
    const offenders: string[] = []
    for (const f of LEARNER_ONLY) {
      for (const m of read(f).matchAll(/text-micro|text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (m[0] === 'text-micro' || Number(m[1]) < 12) offenders.push(`${f}: ${m[0]}`)
      }
    }
    expect(offenders, `استعمل text-fine (١٢px):\n${offenders.join('\n')}`).toEqual([])
  })

  it('و«fine» حجمٌ معرَّفٌ بلا ارتفاعِ سطر — كي تبقى `leading-*` عاملة', () => {
    const cfg = read('tailwind.config.js')
    expect(cfg).toMatch(/fontSize:\s*\{[^}]*fine:\s*'12px'/s)
    expect(cfg).not.toMatch(/fine:\s*\[/)
    expect(cfg, 'أرضيّةُ الفريق رُفعت معها بلا قصد').toMatch(/micro:\s*'11px'/)
  })
})

describe('٥٥ · الشريطُ يعرض ما تقوله الجملةُ فوقه', () => {
  const band = read('src/components/ProofBand.tsx')

  it('لا صورةَ مشاهدةٍ تحت جملةٍ تنفي المشاهدة — ولا أصلَ ميّتٍ بقي', () => {
    expect(existsSync(join(root, 'public/band-learners.jpg')), 'الصورةُ القديمةُ ما زالت').toBe(false)
    const home = read('src/pages/Home.tsx')
    expect(home).not.toContain('band-learners')
    expect(home).toContain('ProofBand')
  })

  it('والجملةُ نصٌّ في DOM لا حروفٌ في الرسم — تُقرأ وتُترجَم وتُفهرَس', () => {
    expect(band).toContain('لا نقيس تعلمك بما شاهدت')
    const svg = band.slice(band.indexOf('<svg'), band.indexOf('</svg>'))
    expect(svg, 'نصٌّ داخل الرسم').not.toMatch(/<text|<tspan/)
    expect(svg).toContain('aria-hidden="true"')
  })

  it('ومن طلب تقليلَ الحركة يرى المشهدَ **تامّا** لا فارغا', () => {
    expect(band).toMatch(/animation:\s*proof-draw[^;]*forwards/)
    expect(band).toMatch(/animation:\s*proof-rise[^;]*forwards/)
    expect(band).toMatch(/animation:\s*proof-stamp[^;]*forwards/)
    expect(read('src/index.css')).toContain('prefers-reduced-motion')
  })

  it('ولا أصلَ خارجيّا — الرسمُ في الحزمة', () => {
    expect(band).not.toMatch(/<img|url\(http/)
  })
})

describe('٥٦ · الرئيسةُ أقصر — جدارا الشعارات صارا واحدا', () => {
  const home = read('src/pages/Home.tsx')

  it('وقفةٌ واحدةٌ للشعارات لا وقفتان بينهما قسمُ المختارات كلُّه', () => {
    expect(home).toContain('<EcosystemOrgStrip nested />')
    expect(home.match(/<EcosystemOrgStrip/g) ?? []).toHaveLength(1)
  })

  it('والادّعاءان يبقيان مميَّزين — دمجُ الوقفةِ لا دمجُ المعنى', () => {
    expect(home).toContain('تحدث عنا الإعلام')
    expect(read('src/components/EcosystemOrgStrip.tsx')).toContain('مؤسسات وثقت بمنظومة وجيز')
  })
})

describe('٥٧ · المؤشّرُ سؤالان — ولكلٍّ عملٌ يؤدّيه', () => {
  const home = read('src/pages/Home.tsx')

  it('سؤالان لا خمسة', () => {
    const block = home.slice(home.indexOf('const mirrorQuestions'), home.indexOf('function readUserName'))
    expect((block.match(/id:\s*'m\d'/g) ?? []).length).toBe(2)
  })

  it('والذي يُترجَم فعلا محفوظ — `m4` هو الذي يوفّر سؤالا في التشخيص', () => {
    expect(home).toContain("id: 'm4'")
    expect(read('src/domain/diagnostic/teaser-bridge.ts')).toContain('goal_clarity')
  })

  it('ولا يَعِد النصُّ بخمسةٍ بعد أن صارت اثنين', () => {
    expect(home).not.toContain('خمسة أسئلة')
  })
})

describe('٥٨ · شاشةُ التشخيص — الشرحُ أقلّ، والشريطُ لا يكذب', () => {
  const diag = read('src/pages/Diagnostic.tsx')

  it('شارةُ التعميق لا تُعرض فوق صندوقٍ يقول الشيءَ نفسَه', () => {
    expect(diag).toContain('{isDeepening && !questionNote && (')
  })

  it('والشريطُ يقول إنّ الجولةَ قد تنتهي عند الثامن — لا يقسم على ١٤ صامتا', () => {
    /* `toContain('shortestMark')` كانت هنا فمرّت على `shortestMarkX`: اسمٌ
       مقطوعُ الصلة يحوي الاسمَ الأوّلَ كجزءٍ منه. فالفحصُ على **الحساب
       والعلامة المرسومة** لا على ورودِ حرفٍ في ملفّ. */
    expect(diag).toMatch(/const shortestMark =[^\n]*ESTIMATE_MIN[^\n]*ESTIMATE_MAX/)
    expect(diag, 'العلامةُ لا تُرسم').toMatch(/insetInlineStart: `\$\{shortestMark\}%`/)
    expect(diag).toMatch(/role="progressbar"/)
    expect(diag).toMatch(/aria-valuetext=/)
  })
})

describe('٥٩ · لحظةُ النتيجة قائمةٌ — ولا تُتخطّى تلقائيّا', () => {
  const diag = read('src/pages/Diagnostic.tsx')

  it('لا تنقّلَ خارجَ النتيجة إلّا بنقرةٍ من المتعلّم', () => {
    /* المخطَّطُ يقول «يُنقل الطالبُ مباشرةً إلى صفحة المسار». والقياس:
       `navigate` مرّةً واحدةً في الملفّ كلِّه، داخلَ معالج «اعتمد الخطّة».
       فلو أُضيف تنقّلٌ في `useEffect` يوما سقط هذا. */
    expect((diag.match(/navigate\(/g) ?? []).length).toBe(1)
    expect(diag).toContain('stage === "result"')
  })
})

describe('٦٠ · الشراء — مبدّلُ العملة لا يُعرض لمن لا شأنَ له به', () => {
  const buy = read('src/components/BuyPanel.tsx')

  it('مطويٌّ حتّى يُطلَب — لا ثلاثةُ أزرارٍ فوق كلّ سعر', () => {
    expect(buy).toContain('currencyOpen')
    expect(buy).toContain('ادفع بعملة أخرى')
  })

  it('وله عنوانٌ حين يُفتح — كانت ثلاثةَ أزرارٍ بلا عنوان', () => {
    expect(buy).toContain('بأيّ عملةٍ تُقتطع بطاقتُك؟')
  })
})

describe('٦١ · التسجيلُ أربعةُ حقولٍ لا خمسة', () => {
  const gate = read('src/components/AuthGate.tsx')

  it('لا تأكيدَ لكلمة السرّ في التسجيل — وزرُّ الإظهار يُغني عنه', () => {
    expect(gate).not.toContain('auth-confirm')
    expect(gate).toContain('showPass ? "text" : "password"')
  })

  it('ويبقى في الاستعادة بقصد — لا زرَّ إظهارٍ هناك يُري ما كُتب', () => {
    expect(gate, 'حُذف التأكيدُ من الاستعادة أيضا').toContain('reset-confirm')
    const reset = gate.slice(gate.indexOf('id="reset-pass"'), gate.indexOf('id="reset-confirm"') + 400)
    expect(reset, 'صار للاستعادة زرُّ إظهار — فليُراجَع بقاءُ التأكيد').toContain('type="password"')
  })
})

describe('٦٢ · ظِلالُ القصص — سَعةٌ أكبرُ من عدد القصص', () => {
  const avatar = read('src/components/StoryAvatar.tsx')

  it('بُعدان محايدان يُضافان: لونٌ وياقة — ولا تُشتقّ الهيئةُ بالقرعة', () => {
    expect(avatar).toContain('COLLARS')
    expect(avatar).toContain('collarFor')
    expect(avatar).not.toMatch(/LOOKS\[[^\]]*hash/)
  })

  it('والتركيباتُ أكثرُ من القصص بفارقٍ واسع', () => {
    const palettes = (avatar.slice(avatar.indexOf('const PALETTES'), avatar.indexOf('const COLLARS'))
      .match(/\{ accent:/g) ?? []).length
    const collars = ((avatar.match(/const COLLARS = \[([^\]]*)\]/)?.[1].match(/'/g)?.length ?? 0) / 2)
    expect(palettes).toBeGreaterThanOrEqual(8)
    expect(collars).toBeGreaterThanOrEqual(4)
  })
})

describe('٦٣ · الأصلُ الميّت', () => {
  it('حُذف، ولا يُشار إليه في الشيفرة', () => {
    expect(existsSync(join(root, 'public/story-team.jpg'))).toBe(false)
    for (const f of ALL) expect(read(f), f).not.toContain('story-team')
  })
})
