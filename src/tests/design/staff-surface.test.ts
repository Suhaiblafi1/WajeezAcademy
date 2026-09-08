/* شاشاتُ الفريق — ما يُطلب من الإنسان أن يعرفه عن ظهر قلب.

   هذا حارسُ **خطِّ أساسٍ ينزل**، لا حارسُ صفرٍ يُشترط اليوم: في الشاشات
   حقولٌ باقيةٌ تطلب معرّفاتٍ، وإحلالُها يحتاج مساراتِ قراءةٍ لم تُكتب بعد.
   فالمشروطُ ألّا يزيد عددُها، وأن ينقص مع كلّ إحلال — كما تفعل بقيّةُ
   خطوط الأساس في هذا المستودَع.

   ── العطبُ الذي وُلد منه ──

   «الصق معرّف التسجيل (UUID)» فوق زرٍّ أحمرَ اسمُه «إسقاط». والمعرّفُ ستّةٌ
   وثلاثون حرفا **لا تظهر على أيّ شاشةٍ في المنصّة** — فلا سبيلَ إلى تعبئته
   إلّا بفتح قاعدة البيانات. وخطأُ لصقٍ واحدٌ يُخرج الطالبَ الخطأ من شعبته،
   ولا اسمَ في الشاشة يُراجَع قبل الضغط.

   وصفه صاحبُ المنصّة في جولة ٨ سبتمبر ٢٠٢٦ بأنّه «غير عمليّ وليس مبنيّا على
   أفضل الممارسات» — وهو وصفٌ دقيق. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx$/.test(name)) out.push(rel)
  }
  return out
}

const SCREENS = [...walk('src/pages'), ...walk('src/components')]

/* ═══ من هي «شاشةُ الفريق»؟ — تُشتقّ كما تُشتقّ شاشةُ المتعلّم ═══

   القائمةُ المكتوبةُ باليد تشيخ عند أوّل ملفّ. فالجذورُ بموضعها (الإدارة
   والمدرّب والمستشار)، ثمّ يُتبَع رسمُ الاستيرادات. والمشترَكُ مع المتعلّم
   يُستثنى: حدُّه في حارسِه هناك، وتغييرُه من هنا يغيّر شاشتَين بقرارٍ واحد. */
const SRC = [...walk('src')].filter((f) => !f.startsWith('src/tests/'))

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
    if (SRC.includes(c)) return c
  }
  return null
}

const IMPORTS = new Map(
  SRC.map((f) => [
    f,
    [...readFileSync(join(root, f), 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)]
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

const STAFF_ONLY = (() => {
  const learner = reachable(SRC.filter(isLearnerRoot))
  const staff = reachable(SRC.filter(isStaffRoot))
  return [...staff]
    .filter((f) => !learner.has(f) && !f.startsWith('src/components/ui/'))
    .sort()
})()

/* الفحصُ على **النصِّ النائب** لا على ورود الحرف: تعليقٌ يشرح ما أُزيل يذكر
   «UUID» ولا يطلب من أحدٍ شيئا. وهي الثغرةُ التي مرّ منها ثلاثةُ حرّاسٍ
   خضراءَ في هذه المنصّة — «طابقوا نصّا في تعليق».

   والمقصودُ **المعرّفُ المُعتِم** وحدَه: قيمةٌ لا يعرفها إنسانٌ ولا تعرضها
   شاشة. أمّا الرمزُ الذي يقرأه صاحبُه ويكتبه من ورقته — `CRS-XXX-000`،
   ورقمُ اجتماع Zoom — فليس منه، ولو سُمّي «معرّفا». فالحدُّ على «UUID»
   صراحةً لا على كلمة «معرّف». */
function uuidPrompts(): string[] {
  const found: string[] = []
  for (const f of SCREENS) {
    const src = readFileSync(join(root, f), 'utf8')
    for (const m of src.matchAll(/placeholder\s*=\s*"([^"]*)"/g)) {
      if (/UUID/i.test(m[1])) found.push(`${f}: ${m[1]}`)
    }
  }
  return found.sort()
}

/* ولم يبقَ شيء.

   كانت هنا أربعةٌ تُسمّى واحدا واحدا، وأُحيلت كلُّها:

     Support   · معرف الوكيل    ← قائمةُ وكلاء الدعم، بحارسِ الإسناد نفسِه
     Exceptions · معرف المستشار ← قائمةُ المستشارين، كذلك
     TrainerOps · معرف العقد    ← عقودُ الطلب بعناوينها — وكانت تصل ولا تُعلَن
     TrainerOps · معرف المرجع   ← مراجعُ الطلب بأسمائها — كذلك

   والقائمةُ الفارغةُ تبقى مكتوبةً لا تُحذف: `toEqual([])` يمنع عودةَ
   الأوّل، وحذفُ الحارس مع آخر عطبٍ يفتح البابَ لأوّل عودة. */
const REMAINING: string[] = []

describe('شاشاتُ الفريق · لا يُطلب معرّفٌ لا تعرضه شاشة', () => {
  it('المسحُ يقرأ الشاشاتِ فعلا — فلا يمرّ بصفرٍ كاذب', () => {
    expect(SCREENS.length, 'تعطّل المسحُ نفسُه').toBeGreaterThan(80)
    /* حارسُ الحارس: لو انكسرت قراءةُ النصِّ النائب لخضرّ كلُّ ما بعدها */
    const anyPlaceholder = SCREENS.some((f) =>
      /placeholder\s*=\s*"/.test(readFileSync(join(root, f), 'utf8')))
    expect(anyPlaceholder, 'لم يُقرأ أيُّ نصٍّ نائب').toBe(true)
  })

  it('بطاقةُ الشعبة لا تطلب معرّفا يُلصق — أُحيلت إلى منتقياتٍ بالاسم', () => {
    const src = readFileSync(join(root, 'src/pages/admin/CohortOps.tsx'), 'utf8')
    const prompts = [...src.matchAll(/placeholder\s*=\s*"([^"]*)"/g)].map((m) => m[1])
    expect(prompts.filter((p) => /UUID/i.test(p))).toEqual([])
  })

  it('والباقي لا يزيد — يُسمّى واحدا واحدا وينقص مع كلّ إحلال', () => {
    expect(uuidPrompts()).toEqual(REMAINING)
  })
})

/* ═════════ أرضيّةُ الخطّ في شاشات الفريق — قرارُ ٨ سبتمبر ٢٠٢٦ ═════════

   قِيس قبل الكنس: ٣٣٠ موضعا بأحدَ عشرَ بكسلا في `src/pages/admin` وحدَها،
   و١٩٢ باثنَي عشر، و**صفرٌ بستّةَ عشر** — أي أنّ ٧٨٪ من نصوص اللوحة دون
   الحدّ الأدنى الذي تقوله مراجعُ الواجهات العربيّة (١٤).

   وكان ذلك قرارا مكتوبا («جداولُ الفريق كثيفةٌ بقصد») نقضه صاحبُ المنصّة.

   والقاعدةُ هي قاعدةُ شاشات المتعلّم نفسُها، لا ثانيةٌ تفترق عنها: **المتنُ
   تقوله البنيةُ لا العين** — `<p>` و`<li>` و`as="p"` متن، وما لُفّ في حبّةٍ
   مستديرة أو حمل `uppercase`/`tracking-` شارةٌ ولو كان فقرة. */

/** سمةُ الأصناف — تُقرأ مركَّبةً لا حرفيّةً وحدَها */
function classAttrs(src: string): { index: number; cls: string }[] {
  const out: { index: number; cls: string }[] = []
  for (const m of src.matchAll(/class(?:Name)?\s*=\s*/g)) {
    const i = m.index! + m[0].length
    const q = src[i]
    if (q === '"' || q === "'") {
      const end = src.indexOf(q, i + 1)
      if (end > 0) out.push({ index: m.index!, cls: src.slice(i + 1, end) })
      continue
    }
    if (q !== '{') continue
    let depth = 0, end = -1
    for (let j = i; j < src.length && j - i < 4000; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') { depth--; if (depth === 0) { end = j; break } }
    }
    if (end < 0) continue
    const parts = [...src.slice(i + 1, end).matchAll(/`([^`]*)`|'([^']*)'|"([^"]*)"/g)]
      .map((x) => x[1] ?? x[2] ?? x[3] ?? '')
    if (parts.length > 0) out.push({ index: m.index!, cls: parts.join(' ') })
  }
  return out
}

function openTag(src: string, idx: number): { name: string; head: string } {
  for (let i = idx; i > 0 && idx - i < 3000; i--) {
    if (src[i] === '<' && /[A-Za-z]/.test(src[i + 1] ?? '')) {
      return { name: src.slice(i + 1).match(/^[A-Za-z][\w.]*/)?.[0] ?? '?', head: src.slice(i, idx) }
    }
  }
  return { name: '?', head: '' }
}

const SMALL = /\btext-(fine|xs|micro)\b/
const LABELISH = /rounded-full|uppercase|tracking-|sr-only/
const AS_P = /\bas\s*=\s*(?:"p"|'p'|\{"p"\}|\{'p'\})/

const { body, label } = (() => {
  const body: string[] = []
  const label: string[] = []
  for (const f of STAFF_ONLY) {
    const src = readFileSync(join(root, f), 'utf8')
    for (const a of classAttrs(src)) {
      if (!SMALL.test(a.cls)) continue
      const tag = openTag(src, a.index)
      const line = src.slice(0, a.index).split('\n').length
      const isBody = !LABELISH.test(a.cls) && !LABELISH.test(tag.head)
        && (/^(p|li)$/.test(tag.name) || AS_P.test(tag.head))
      ;(isBody ? body : label).push(`${f}:${line}  <${tag.name}>  ${a.cls}`)
    }
  }
  return { body, label }
})()

describe('شاشاتُ الفريق · أرضيّةُ الخطّ', () => {
  it('الاشتقاقُ يعمل — ولو انكسر لخضرّ ما بعده بلا معنى', () => {
    expect(STAFF_ONLY.length).toBeGreaterThan(40)
    expect(STAFF_ONLY).toContain('src/pages/admin/CohortOps.tsx')
    expect(STAFF_ONLY).not.toContain('src/pages/CoursePath.tsx')
    /* اللصيقاتُ باقيةٌ بقصد، فوجودُها دليلُ أنّ المسحَ يقرأ فعلا */
    expect(label.length, 'لم يُقرأ موضعٌ واحد — تعطّل المسحُ').toBeGreaterThan(50)
  })

  it('لا فقرةَ ولا عنصرَ قائمةٍ بحجمِ لصيقة — المتنُ أربعةَ عشر', () => {
    expect(
      body,
      'نصُّ متنٍ دون أربعةَ عشر في شاشة فريق. استعمل `text-read` — وإن كان '
      + 'شارةً فعلا فألبِسه `rounded-full` أو انقله إلى `<span>`:\n'
      + body.slice(0, 12).join('\n'),
    ).toEqual([])
  })

  it('ولا أحدَ عشرَ في المستودَع كلِّه — أرضيّةُ اللصيقة اثنا عشر', () => {
    const offenders: string[] = []
    for (const f of SRC.filter((x) => /\.tsx?$/.test(x))) {
      const src = readFileSync(join(root, f), 'utf8')
      for (const m of src.matchAll(/text-micro|text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (m[0] === 'text-micro' || Number(m[1]) < 12) offenders.push(`${f}: ${m[0]}`)
      }
    }
    expect(offenders, `استعمل text-fine (١٢px):\n${offenders.join('\n')}`).toEqual([])
  })

  it('وحقلُ الفريق واحدٌ لا تسعة — الصيغةُ في `FormKit` لا في كلّ صفحة', () => {
    const kit = readFileSync(join(root, 'src/components/FormKit.tsx'), 'utf8')
    expect(kit).toMatch(/staffControlCls[\s\S]{0,200}text-read/)
    /* ونقضُه: صفحةٌ تُعيد كتابةَ صيغةِ حقلٍ كاملةٍ في مكانها */
    const local: string[] = []
    for (const f of STAFF_ONLY.filter((x) => x.startsWith('src/pages/'))) {
      const src = readFileSync(join(root, f), 'utf8')
      if (/^const (input|select)Cls = (?:"|`)[^"`]*rounded-xl/m.test(src)) local.push(f)
    }
    expect(local, `صيغةُ حقلٍ مكتوبةٌ في مكانها — استورد staffControlCls:\n${local.join('\n')}`).toEqual([])
  })
})

/* ═════════ بطاقةُ الشعبة — أربعةُ ألسنةٍ لا سبعُ طيّات ═════════

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦) بعد وصفِه إيّاها بـ«معقّدة… فيها أمورٌ
   كثيرةٌ لا داعي لها».

   وما يُحرَس هنا **بنيةٌ لا نصّ**: أن يبقى لكلّ قسمٍ لسانٌ يقع فيه. فقسمٌ
   يُضاف بلا بوّابةٍ يظهر في الألسنة الأربعة معا — وهو بعينه الانبساطُ الذي
   أُزيل، يعود من باب النسخ بلا أن يحمرّ شيء. */
describe('بطاقةُ الشعبة · كلُّ قسمٍ في لسانه', () => {
  const ops = readFileSync(join(root, 'src/pages/admin/CohortOps.tsx'), 'utf8')
  const list = readFileSync(join(root, 'src/pages/admin/AdminCohorts.tsx'), 'utf8')
  const tabsFile = readFileSync(join(root, 'src/pages/admin/cohort-tabs.ts'), 'utf8')

  it('الألسنةُ أربعةٌ معرَّفةٌ في موضعٍ واحد، والاتّحادُ يطابق القائمة', () => {
    const union = [...tabsFile.matchAll(/"(identity|schedule|enrollment|content)"/g)].map((m) => m[1])
    /* أربعةٌ في الاتّحاد وأربعةٌ في القائمة = ثمانيةُ ورودات */
    expect(new Set(union).size).toBe(4)
    expect((tabsFile.match(/\{ id: "/g) ?? []).length).toBe(4)
  })

  it('لا قسمَ بلا لسان — كلُّ `<Section` مسبوقٌ ببوّابةِ لسانه', () => {
    /* ── ولماذا لا يُعَدّ عدًّا ──

       أوّلُ صياغةٍ قارنت عددَ الأقسام بعدد البوّابات (`gates >= sections`).
       ونُقضت فمرّت: في الملفّ بوّابةٌ زائدةٌ لا تخصّ قسما (زرُّ النشر)، فحين
       نُزعت بوّابةُ قسمٍ بقي العددان متساويَين وخضرّ الحارسُ على عطبٍ قائم.

       وهو العطبُ الذي يحذّر منه المستودَع: حارسٌ يخضرّ لسببٍ خاطئ. فالفحصُ
       الآن **على الموضع**: لكلّ `<Section` يُنظر إلى ما قبله حتّى نهايةِ
       القسم السابق — فإن لم تقع فيه بوّابةُ لسانٍ فالقسمُ مكشوفٌ في الأربعة. */
    const positions = [...ops.matchAll(/<Section /g)].map((m) => m.index!)
    expect(positions.length, 'اختفت الأقسامُ — تعطّل الفحصُ نفسُه').toBeGreaterThan(5)

    const ungated: string[] = []
    for (const at of positions) {
      const prevEnd = ops.lastIndexOf('</Section>', at)
      const window = ops.slice(prevEnd < 0 ? 0 : prevEnd, at)
      if (!/tab === "/.test(window)) {
        const line = ops.slice(0, at).split('\n').length
        ungated.push(`CohortOps.tsx:${line}`)
      }
    }
    expect(
      ungated,
      `قسمٌ بلا بوّابةِ لسان — يظهر في الألسنة الأربعة معا:\n${ungated.join('\n')}`,
    ).toEqual([])
  })

  it('ولكلّ لسانٍ ما يملؤه — لا لسانٌ يُفتح على فراغ', () => {
    for (const t of ['identity', 'schedule', 'enrollment', 'content']) {
      const inOps = (ops.match(new RegExp(`tab === "${t}"`, 'g')) ?? []).length
      const inList = (list.match(new RegExp(`tab === "${t}"`, 'g')) ?? []).length
      expect(inOps + inList, `اللسانُ «${t}» بلا محتوى`).toBeGreaterThan(0)
    }
  })

  it('ولا طيَّ داخلَ لسان — `MiniCard` أُزيلت فلا تعود', () => {
    /* الفحصُ على الاستعمال لا على ورود الحرف: التعليقُ الذي يشرح ما أُزيل
       يذكر اسمَها، وهو شرحٌ لا طيّة. */
    expect(ops).not.toMatch(/<MiniCard/)
    expect(ops).not.toMatch(/function MiniCard/)
  })
})

/* ═════════ طوابيرُ العمل — لكلِّ قائمةٍ تطول ما يُبلَغ به صفٌّ بعينه ═════════

   البندُ السابعُ من تقييم لوحة الإدارة. وأوّلُ قياسٍ له كان **مضلِّلا**: قال
   «ستٌّ من تسعٍ وعشرين فيها أداةُ فرز» فقُرئت «ثلاثٌ وعشرون بلا وسيلةِ
   وصول» — وهي ليست كذلك. فمنها ما له فلترٌ خاصٌّ به (`AuditLog` مرقَّمٌ من
   الخادم بوجوهٍ إحصائيّة)، ومنها لوحاتٌ وتفاصيلُ لا قوائمُ أصلا.

   والعدُّ الصحيح: **ثمانيةُ طوابيرَ تنمو ولا بحثَ فيها ولا ترقيم**. وهي ما
   أُصلح.

   ── وما يُحرَس ──

   الشاشةُ التي تقرأ **مصفوفةً من الخادم** تعرض قائمةً تنمو بنموّ العمل.
   فيلزمها ما يُبلَغ به صفٌّ بعينه: `ListToolbar` أو `matchesQuery`.

   والمستثنى يُسمّى واحدا واحدا بسببه — لا يُعَدّ عدًّا. */
describe('طوابيرُ الإدارة · لا قائمةَ تطول بلا وسيلةِ وصول', () => {
  /* لكلٍّ سببُه، ونوعُه لا رأيُنا فيه:

     لوحةٌ لا قائمة      · AdminDashboard  — أرقامٌ ومداخل، لا صفوفٌ تُبحث
     تفصيلُ كيانٍ واحد   · CohortOps · CohortWizard · TrainerOps
     مجموعةٌ محدودة      · Notifications (قوالبُ الإشعارات) · Reports (تعاريفُ التقارير)
     تشخيصٌ فنّيّ محدود  · DiagnosticQuality — شخصيّاتُ آخرِ جولةٍ وعددُها ثابت */
  const EXEMPT = new Set([
    'AdminDashboard', 'CohortOps', 'CohortWizard', 'TrainerOps',
    'Notifications', 'Reports', 'DiagnosticQuality',
  ])

  const screens = readdirSync(join(root, 'src/pages/admin'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ name: f.replace(/\.tsx$/, ''), src: readFileSync(join(root, 'src/pages/admin', f), 'utf8') }))
    /* تقرأ مصفوفةً من الخادم = تعرض قائمةً تنمو */
    .filter((x) => /apiGet<[A-Za-z]+\[\]>/.test(x.src))

  it('المسحُ يجد الطوابيرَ فعلا — فلا يمرّ بصفرٍ كاذب', () => {
    expect(screens.length, 'تعطّل المسحُ نفسُه').toBeGreaterThan(15)
    expect(screens.map((x) => x.name)).toContain('AdvisorRequests')
  })

  it('كلُّ طابورٍ يُبحث فيه — أو يُسمّى في المستثنى بسببه', () => {
    const bare = screens
      .filter((x) => !EXEMPT.has(x.name))
      .filter((x) => !/matchesQuery|ListToolbar/.test(x.src))
      .map((x) => x.name)
    expect(
      bare,
      'قائمةٌ تنمو بلا بحث. استعمل `ListToolbar` مع `paginate` و`matchesQuery` '
      + `— أو سَمِّها في المستثنى بسببها:\n${bare.join('\n')}`,
    ).toEqual([])
  })

  it('والمستثنى لا يتضخّم — كلُّ اسمٍ فيه يقابل ملفّا قائما', () => {
    /* نقضُه: اسمٌ يُترك في المستثنى بعد حذف ملفّه، فيصير البابُ مفتوحا
       لشاشةٍ جديدةٍ تحمل الاسمَ نفسَه وتمرّ بلا بحث. */
    const names = new Set(screens.map((x) => x.name))
    const stale = [...EXEMPT].filter((n) => !names.has(n))
    expect(stale, `أسماءٌ في المستثنى بلا ملفّ:\n${stale.join('\n')}`).toEqual([])
  })
})
