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
import { dirname, join, relative, sep } from 'node:path'
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

/* التعليقاتُ تشرح النبرةَ فتذكر اسمَها — والعدُّ على الشيفرة لا على شرحها.

   ولولا هذا لَعدّ الحارسُ تعليقَ `ThemeToggle` الذي يشرح **لماذا لم يعد
   ذهبيّا** ذهبيّا قائما. وهي المصيدةُ التي يحذّر منها CLAUDE.md بنصّها:
   الفحصُ على البنية لا على ورودِ حرفٍ في ملفّ. */
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const goldsIn = (abs: string) => (strip(readFileSync(abs, 'utf8')).match(/tone="primary"/g) ?? []).length

describe('الذهبيُّ فعلُ الصفحة، لا لونُ كلِّ فعلٍ مهمّ', () => {
  const counts = tsx(join(root, 'src'))
    .map((f) => ({ file: relative(root, f), n: goldsIn(f) }))
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
      if ((strip(readFileSync(f, 'utf8')).match(/tone="primary" size="sm"/g) ?? []).length) {
        small.push(relative(root, f))
      }
    }
    expect(small, `ذهبيٌّ بحجمٍ صغير — إمّا ليس فعلَ الصفحة، وإمّا حجمُه خطأ:\n${small.join('\n')}`)
      .toEqual([])
  })
})

/* ═════════ ⑦ · والشاشةُ تُبنى من ملفّات ═════════

   الحدُّ أعلاه يعدُّ **الذهبيَّ في الملفّ**، وهو ما كان مكتوبا في رأس هذا
   الملفّ بوصفه حدَّه: «الملفُّ ليس الشاشةَ دائما … فالحدُّ هنا أدنى ما يُمكن
   قياسُه من المصدر». والبندُ ⑦ في خطّة التنفيذ يسمّي ما يفوته: **ذهبيّان
   اجتمعا على شاشةٍ من ملفَّين لا يراهما.**

   ── وما وجده حين قِيس ──

   `ThemeToggle` — زرُّ تبديل المظهر في ترويسة **كلّ شاشة** — كان
   `tone="primary"`، أي ذهبيَّ التعبئة. وملفُّه فيه ذهبيٌّ واحد، فالحدُّ
   القديمُ يمرّ. والقياسُ بالمتصفّح على `/auth` وجد ذهبيَّين معا بالتعبئة
   نفسِها `rgb(250,188,5)`: «التبديل إلى المظهر» و«ادخل إلى حسابي».

   فكانت **ستَّ عشرةَ شاشةً من سبعَ عشرةَ** تحمل ذهبيَّين، وسببُها واحد.

   ── وكيف تُشتقّ الشاشة ──

   من `App.tsx`: كلُّ `<Route path element={<X/>}>` ومكوّنُه (ساكنا كان أم
   كسولا)، ثمّ رسمُ الاستيرادات منه. وهو **تقريبٌ يزيد ولا ينقص**: يرى ما قد
   يُعرض لا ما يُعرض حتما. ولذلك يُستثنى ما ثبت تعاقبُه بالقراءة — ويُسمّى
   استثناؤه بسببه، لا يُترك ثغرةً عامّة. */
describe('⑦ · رئيسيٌّ واحدٌ في الشاشة — تُقاس بالشاشة لا بالملفّ', () => {
  const SRC = join(root, 'src')
  const files = tsx(SRC).map((f) => relative(root, f).split(sep).join('/'))
  const all = new Set(files)

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
      if (all.has(c)) return c
    }
    return null
  }

  const readRel = (f: string) => readFileSync(join(root, f), 'utf8')
  const IMPORTS = new Map(files.map((f) => {
    const src = readRel(f)
    const specs = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    /* والكسولةُ أيضا: أكثرُ الشاشات تُستورد بـ`lazy(() => import('…'))` */
    specs.push(...[...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]))
    return [f, specs.map((x) => resolveImport(f, x)).filter((x): x is string => x !== null)]
  }))

  const app = readRel('src/App.tsx')
  const nameToFile = new Map<string, string>()
  for (const m of app.matchAll(/import\s+(\w+)[^'"]*from\s+['"]([^'"]+)['"]/g)) {
    const f = resolveImport('src/App.tsx', m[2]); if (f) nameToFile.set(m[1], f)
  }
  for (const m of app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g)) {
    const f = resolveImport('src/App.tsx', m[2]); if (f) nameToFile.set(m[1], f)
  }

  const screens = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)]
    .map((m) => ({ path: m[1], file: nameToFile.get(m[2]) }))
    .filter((r): r is { path: string; file: string } => Boolean(r.file))

  function reachable(from: string): Set<string> {
    const seen = new Set<string>()
    const stack = [from]
    while (stack.length) {
      const f = stack.pop()!
      if (seen.has(f)) continue
      seen.add(f)
      for (const d of IMPORTS.get(f) ?? []) stack.push(d)
    }
    return seen
  }

  /* ── ما ثبت تعاقبُه بالقراءة — **بملفّاته** لا بشاشته ──

     ⚠️ أوّلُ صياغةٍ استثنت **الشاشةَ كلَّها**، ونُقضت فمرّت: أُعيد ذهبيُّ قسمٍ
     في `/admin/catalog` فلم يحمرّ شيء — لأنّ الاستثناءَ كان يُخفي كلَّ ذهبيٍّ
     على تلك الشاشة لا المتعاقبَ وحدَه. فصار يُسمّي الملفّات: ما عداها يُعَدُّ
     كما يُعَدُّ في أيّ شاشة. */
  const SEQUENTIAL: Record<string, { why: string; files: string[] }> = {
    '/admin/catalog': {
      why: 'معالجان يُفتح أحدُهما بـ`openForm` لا كلاهما، وكلٌّ منهما خطوةٌ في المرّة',
      files: ['src/components/CourseWizard.tsx', 'src/components/PathwayWizard.tsx'],
    },
    '/student/learning': {
      why: 'مراحلُ الرحلة تتعاقب (العرضُ ثمّ العمل)، و`StageWork` تبويبات — واحدٌ يُرى في المرّة',
      files: [
        'src/components/BuyCohort.tsx',
        'src/components/journey/StageWork.tsx',
        'src/components/journey/CourseCertificate.tsx',
      ],
    },
  }

  const measured = screens.map((s) => {
    const exempt = new Set(SEQUENTIAL[s.path]?.files ?? [])
    const carriers = [...reachable(s.file)]
      .map((f) => ({ f, n: goldsIn(join(root, f)) }))
      .filter((x) => x.n > 0)
    return {
      ...s,
      carriers,
      total: carriers.reduce((a, x) => a + x.n, 0),
      /* ما يُحاسَب عليه: كلُّ ذهبيٍّ عدا ما ثبت تعاقبُه بالقراءة */
      counted: carriers.filter((c) => !exempt.has(c.f)).reduce((a, x) => a + x.n, 0),
    }
  })

  it('الاشتقاقُ يعمل — ولو انكسر لَخضرّ ما بعده بلا معنى', () => {
    expect(screens.length, 'لم تُقرأ مساراتٌ من App.tsx').toBeGreaterThan(60)
    expect(measured.some((m) => m.total > 0), 'لا ذهبيَّ في أيّ شاشة — تعطّل العدّ').toBe(true)
  })

  it('لا شاشةَ يبلغها ذهبيّان', () => {
    const over = measured.filter((m) => m.counted > 1)
    expect(
      over,
      'ذهبيّان في شاشةٍ واحدةٍ يُلغيان بعضَهما — ولو كانا في ملفَّين.\n'
      + 'فعلُ قسمٍ أو نافذةٍ نبرتُه `confirm`، وأداةُ الإطار `ghost`.\n'
      + over.map((m) => `  ${m.path}\n${m.carriers.map((c) => `      ${c.n} × ${c.f}`).join('\n')}`).join('\n'),
    ).toEqual([])
  })

  it('والمستثنى يبقى مستحقّا — فلا يبقى اسمٌ يوسّع الثغرة بعد أن زال سببُه', () => {
    for (const [path, { why, files }] of Object.entries(SEQUENTIAL)) {
      const m = measured.find((x) => x.path === path)
      expect(m, `مستثنًى لا مسارَ له: ${path}`).toBeTruthy()
      expect(m!.total, `«${path}» لم يعد يبلغه ذهبيّان — فاحذف استثناءه (${why})`)
        .toBeGreaterThan(1)
      /* وكلُّ ملفٍّ مُسمًّى يحمل ذهبيّا فعلا ويبلغ الشاشة — وإلّا فاسمٌ ميّت */
      const reach = reachable(m!.file)
      for (const f of files) {
        expect(reach.has(f), `مستثنًى لا يبلغ «${path}»: ${f}`).toBe(true)
        expect(goldsIn(join(root, f)), `مستثنًى بلا ذهبيّ: ${f}`).toBeGreaterThan(0)
      }
    }
  })
})
