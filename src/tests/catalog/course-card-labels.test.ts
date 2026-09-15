/* حارسُ وسمَي بطاقة الدورة ومصطلحِها — على الشيفرة بلا تعاليقها.

   ═══ ما يُحرَس ═══

   قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦) ثلاثةٌ في بطاقةٍ واحدة:

   ١) وسمُ «مختارة» كان وحدَه، فتبقى المساحةُ بجانبه فارغةً في كلّ دورةٍ غير
      مختارة — وهنّ الأكثر. فإلى جانبه وسمُ **المجال** كما تصفّي به الرقاقاتُ
      فوق النتائج، فللمختارة وسمان ولغيرها واحد.

   ٢) والمصطلحُ الإنجليزيُّ كان سطرا عاريا «مرميّا» تحت العنوان، فصار في
      صندوقٍ شفّاف.

   ٣) و**كلُّ** دورةٍ تُترجَم — كان ستّون من إحدى وثمانين، فتختلف البطاقاتُ
      في بنيتها بلا سببٍ يراه القارئ.

   ═══ ولمَ تُمحى التعاليقُ قبل الفحص ═══

   القاعدةُ في `CLAUDE.md`: مرّ في هذا المستودَع ثلاثةُ حرّاسٍ خضراءَ لأسبابٍ
   خاطئة، أحدُها طابق نصّا في **تعليق**. وهذا الملفُّ يفحص أصنافا وأسماءَ حقول
   — وكلُّها مكتوبةٌ في التعاليق التي تشرحها (رأسُ `CourseTitle.tsx` يذكر
   `border-white/10 bg-white/[0.03]` حرفا). فتُمحى التعاليقُ أوّلا، ولا يُقاس
   إلّا ما يُصيَّر. */

import '../setup-catalog'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { courses } from '@/data/courses'
import { hasTermEn } from '@/application/catalog/course-title'

/** الملفُّ بلا تعاليقه — كتلا وأسطرا */
const code = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

const CATALOG = code('src/pages/Catalog.tsx')
const TITLE = code('src/components/CourseTitle.tsx')

/* ═══ وبطاقةُ الدورة تُقرأ من الشجرة لا من الملفّ ═══

   جُرّب `toContain('pathwayDomain(c.pathwayId)')` أوّلا، فنُقض بحذف الوسم من
   البطاقة — **فخضرّ**: العبارةُ نفسُها في سطر التصفية فوقَها
   (`pathwayDomain(c.pathwayId) === cat`). فالمطابقةُ على الملفّ تقول «الدالّةُ
   مذكورةٌ في مكانٍ ما»، والمحروسُ أنّها **تُصيَّر داخل البطاقة**.

   فتُقرأ شجرةُ النحو: تُلتمَس `visibleCourses.map(...)` — وهي شبكةُ الدورات
   وحدَها — ويُفتَّش في جسدها عن نداءٍ بهذا الشكل داخل تعبيرِ JSX. */
const source = ts.createSourceFile(
  'Catalog.tsx',
  readFileSync(join(process.cwd(), 'src/pages/Catalog.tsx'), 'utf8'),
  ts.ScriptTarget.Latest,
  /* setParentNodes */ true,
  ts.ScriptKind.TSX,
)

/** أوّلُ عقدةٍ تحقّق الشرط */
function find(node: ts.Node, ok: (n: ts.Node) => boolean): ts.Node | undefined {
  if (ok(node)) return node
  return ts.forEachChild(node, (child) => find(child, ok))
}

/** كلُّ العقد المحقِّقة للشرط في شجرةٍ فرعيّة */
function findAll(node: ts.Node, ok: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const walk = (n: ts.Node) => {
    if (ok(n)) out.push(n)
    ts.forEachChild(n, walk)
  }
  walk(node)
  return out
}

/** جسدُ `<قائمة>.map(...)` — الشجرةُ التي تُصيَّر بطاقةً */
function mapBody(list: string): ts.Node {
  const call = find(source, (n) =>
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.name.text === 'map' &&
    n.expression.expression.getText(source) === list,
  )
  expect(call, `لم تُوجد ${list}.map — تغيّرت بنيةُ الشبكة`).toBeTruthy()
  const arrow = (call as ts.CallExpression).arguments[0]
  expect(arrow && (ts.isArrowFunction(arrow) || ts.isFunctionExpression(arrow))).toBe(true)
  return (arrow as ts.ArrowFunction).body
}

describe('بطاقةُ الدورة — وسمان لا وسمٌ ومساحةٌ فارغة', () => {
  it('المحوُ يعمل — وإلّا مرّ ما بعده بمطابقةِ تعليق', () => {
    expect(CATALOG, 'التعاليقُ لم تُمحَ').not.toContain('/*')
    expect(CATALOG.length, 'الملفُّ لم يُقرأ').toBeGreaterThan(1000)
    expect(TITLE.length).toBeGreaterThan(200)
  })

  it('وسمُ المجال داخل بطاقة الدورة — بالدالّة التي تصفّي بها الرقاقات', () => {
    /* داخلَ البطاقة، وفي تعبير JSX يُصيَّر — لا في شرط تصفيةٍ فوقها. ولا يُقبل
       `c.category` مكانَه: تلك فئةُ **الجمهور** التي حُذفت من هنا عن قصد. */
    const rendered = findAll(mapBody('visibleCourses'), (n) =>
      ts.isJsxExpression(n) && n.expression?.getText(source) === 'pathwayDomain(c.pathwayId)',
    )
    expect(rendered.length, 'ذهب وسمُ المجال عن بطاقة الدورة').toBeGreaterThan(0)
  })

  it('وإلى جانب «مختارة» لا مكانَها — فللمختارة وسمان', () => {
    const card = mapBody('visibleCourses')
    const featured = findAll(card, (n) =>
      ts.isJsxExpression(n) && (n.expression?.getText(source) ?? '').includes('bestsellerCourseIds.has(c.id)'),
    )
    expect(featured.length, 'ذهب وسمُ «مختارة»').toBeGreaterThan(0)
    /* والوسمان أخوان في صفٍّ واحد: وسمُ المجال ليس داخلَ شرط «مختارة» —
       **ولا داخلَ واحدٍ من شروطه** لو تعدّدت — وإلّا عادت المساحةُ فارغةً في
       غير المختارة، وهي العلّةُ التي من أجلها أُضيف. (جُرّبت الصيغةُ على
       `featured[0]` وحدَه فنُقضت بشرطٍ ثانٍ يحمل الوسمَ فمرّت خضراء.) */
    const inside = featured.flatMap((cond) =>
      findAll(cond, (n) =>
        ts.isJsxExpression(n) && n.expression?.getText(source) === 'pathwayDomain(c.pathwayId)',
      ),
    )
    expect(inside, 'وسمُ المجال مشروطٌ بـ«مختارة»').toEqual([])
  })

  it('وهو الوسمُ نفسُه الذي تعرضه الرقاقاتُ — لا قائمةٌ ثانية', () => {
    /* الرقاقاتُ تُبنى من `pathwayDomains`، والتصفيةُ تقارن بـ`pathwayDomain`.
       فلو صُنع للبطاقة معجمٌ آخرُ لقرأ الزائرُ اسمين للشيء الواحد. */
    expect(CATALOG).toContain('pathwayDomains.map(')
    expect(CATALOG).toContain('pathwayDomain(c.pathwayId) === cat')
  })

  it('والمصطلحُ الإنجليزيُّ في صندوقٍ شفّاف — لا سطرٌ عارٍ', () => {
    const span = TITLE.match(/dir="ltr"[\s\S]{0,400}?>/)?.[0] ?? ''
    expect(span, 'لم يُعثر على سطر المصطلح').toContain('className')
    expect(span, 'لا حدَّ للصندوق').toMatch(/\bborder\b/)
    expect(span, 'لا أرضيّةَ للصندوق').toMatch(/\bbg-/)
    expect(span, 'الانحناءُ يصنع الصندوق').toMatch(/rounded-/)
    expect(span, 'بلا حشوٍ لا يكون صندوقا').toMatch(/px-/)
  })
})

describe('وكلُّ دورةٍ تُترجَم', () => {
  it('لا دورةَ في الكتالوج بلا مصطلحٍ إنجليزيّ', () => {
    expect(courses.length).toBeGreaterThan(50)
    const without = courses.filter((c) => !hasTermEn(c.termEn)).map((c) => c.id)
    expect(without, 'دوراتٌ بلا مصطلحٍ إنجليزيّ').toEqual([])
  })

  it('والمصطلحُ لاتينيٌّ لا عربيٌّ منسوخ', () => {
    const arabic = courses.filter((c) => /[؀-ۿ]/.test(c.termEn ?? '')).map((c) => c.id)
    expect(arabic, 'مصطلحٌ «إنجليزيّ» فيه حرفٌ عربيّ').toEqual([])
  })
})
