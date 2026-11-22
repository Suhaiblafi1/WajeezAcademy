/* صناديقُ الدورات في صفحة «منحة مؤثرين وجيز» — أخفُّ، وقائمةٌ واحدةٌ أرخصُها أوّلا (٢٢ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اجعل صناديقَ الدورات أخفّ: اسمُ المدرّب تحت الصورة بكلمتين فقط، واحذف النصوصَ تحت اسم الدورة،
   واجعل الصندوقَ أصغر، واعرض كلَّ الدورات بطريقةٍ واحدة لا بالأقسام. والتغييرُ لحملات المؤثّرين فقط. وابدأ بالأرخص —
   وابدأ بالثلاث التي استعملناها قبل». فهنا: الترتيبُ واسمُ المدرّب القصيرُ دالّتين، وبنيةُ الصفحة: صفحةُ المؤثّر قائمةٌ
   واحدةٌ بصفٍّ خفيف، وصفحاتُ المنح الأخرى بأقسامها وصفِّها كما كانت. والتعليقاتُ تُنزع قبل الفحص. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INFLUENCER_FEATURED_COURSES, influencerCourseOrder, trainerShortNameAr } from '@/application/commerce/influencer-cards'
import { PUBLIC_PATHS } from '@/application/commerce/private-path'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
/** جسمُ دالّةٍ في الصفحة — من تعريفها إلى أوّل إغلاقٍ لها بعمقها */
const body = (start: string) => {
  const i = PAGE.indexOf(start)
  expect(i, `لا ${start}`).toBeGreaterThan(-1)
  return PAGE.slice(i, PAGE.indexOf('\n    };\n', i))
}

const c = (courseId: string, price: number, startsAt: string | null = '2026-12-05T17:00:00Z') => ({ courseId, price, startsAt })
const ids = (xs: { courseId: string }[]) => xs.map((x) => x.courseId)

describe('① ترتيب صفحة المؤثر', () => {
  it('⚠️ الثلاث التي استعملناها قبل — دورات مسار بلاك فرايدي العام بترتيبها', () => {
    expect(INFLUENCER_FEATURED_COURSES).toEqual(['C-JOB-104', 'C-MGR-107', 'C-BIZ-107'])
    expect(INFLUENCER_FEATURED_COURSES).toEqual(PUBLIC_PATHS.BF80.courseIds)
  })

  it('⚠️ المميزة أولا بترتيبها ولو كانت أغلى — ثم الباقي بالأرخص', () => {
    const list = [c('A', 50), c('C-BIZ-107', 200), c('B', 30), c('C-JOB-104', 180), c('C', 90), c('C-MGR-107', 300)]
    expect(ids(influencerCourseOrder(list))).toEqual(['C-JOB-104', 'C-MGR-107', 'C-BIZ-107', 'B', 'A', 'C'])
  })

  it('⚠️ والأرخص بالسعر الذي يراه الزائر — والتساوي بالأقرب بدءا ثم بموضعها', () => {
    const list = [c('late', 40, '2027-01-10T17:00:00Z'), c('soon', 40, '2026-12-01T17:00:00Z'), c('cheap', 100), c('none', 40, null), c('soon2', 40, '2026-12-01T17:00:00Z')]
    /* «cheap» بسعرٍ قائمتُه أعلى ويراه الزائرُ أرخص */
    const seen = (x: { courseId: string; price: number }) => (x.courseId === 'cheap' ? 10 : x.price)
    expect(ids(influencerCourseOrder(list, seen))).toEqual(['cheap', 'soon', 'soon2', 'late', 'none'])
  })

  it('⚠️ وما غاب من المميزة عن القائمة يتخطى — ولا تتغير القائمة المعطاة', () => {
    const list = [c('A', 20), c('C-BIZ-107', 90), c('B', 10)]
    const before = ids(list)
    expect(ids(influencerCourseOrder(list))).toEqual(['C-BIZ-107', 'B', 'A'])
    expect(ids(list)).toEqual(before)
    expect(influencerCourseOrder([])).toEqual([])
  })
})

describe('② اسم المدرب تحت صورته', () => {
  it('⚠️ كلمتان على الأكثر: أول اسمه وآخره — والكلمة والكلمتان كما هما', () => {
    expect(trainerShortNameAr('سارة أحمد خليل العلي')).toBe('سارة العلي')
    expect(trainerShortNameAr('محمد سالم يوسف')).toBe('محمد يوسف')
    expect(trainerShortNameAr('  ليلى   حداد ')).toBe('ليلى حداد')
    expect(trainerShortNameAr('Omar')).toBe('Omar')
    expect(trainerShortNameAr('John Michael Smith')).toBe('John Smith')
  })

  it('⚠️ والاسم المركب لا يقطع نصفه — «عبد الله» و«نور الدين» كلمة واحدة، و«بن» تسقط', () => {
    expect(trainerShortNameAr('عبد الله محمد الخطيب')).toBe('عبد الله الخطيب')
    expect(trainerShortNameAr('أحمد محمود عبد الرحمن')).toBe('أحمد عبد الرحمن')
    expect(trainerShortNameAr('محمد نور الدين')).toBe('محمد نور الدين')
    expect(trainerShortNameAr('محمد بن سلمان')).toBe('محمد سلمان')
  })
})

describe('③ صفحة المؤثر قائمة واحدة بصف خفيف — والمنح الأخرى كما كانت', () => {
  it('⚠️ الترتيب لصفحة المؤثر وحدها، بالسعر الذي يراه — وأولاه «ابدأ بها» تختار له', () => {
    expect(PAGE).toMatch(/const flat = useMemo\(\s*\(\) => \(forInfluencer && view \? influencerCourseOrder\(view\.openCourses, \(x\) => grantPrice\(x\.price, pct\)\) : null\),/)
    /* والبذرُ الأوّلُ يتنحّى له، وأثرُه يختار أوّلَ قائمته وحدَها */
    expect(PAGE).toMatch(/if \(!view \|\| !stored \|\| seeded\) return;\s*if \(flat\) return;/)
    const at = PAGE.indexOf('if (!flat || !view || !stored || seeded) return;')
    expect(at, 'لا بذر لصفحة المؤثر').toBeGreaterThan(-1)
    const seed = PAGE.slice(at)
    expect(seed).toMatch(/^[^]*?const start = flat\.slice\(0, 1\)\.map\(\(x\) => x\.courseId\);\s*const open = [^;]*;\s*setSuggested\(start\);\s*setPicked\(firstPicks\([^;]*, start, view\.campaign\.maxCourses\)\);/)
  })

  it('⚠️ قائمة واحدة بلا أقسام في صفحة المؤثر — والأقسام لغيرها', () => {
    const at = PAGE.indexOf(') : flat ? (')
    expect(at, 'لا فرع للمؤثر').toBeGreaterThan(-1)
    const branch = PAGE.slice(at, PAGE.indexOf(') : (', at))
    expect(branch).toMatch(/\{flat\.map\(\(x\) => lightRow\(x\)\)\}/)
    expect(branch, 'أقسام في صفحة المؤثر').not.toMatch(/sections|<details|row\(x/)
    /* وما بعده فرعُ المنح الأخرى — بمختاراتها فوق وأقسامها المطويّة كما كانت */
    const rest = PAGE.slice(PAGE.indexOf(') : (', at), PAGE.indexOf('{GRANT_OUTCOMES_TITLE_AR}'))
    expect(rest).toMatch(/\{top\.map\(\(x\) => row\(x\)\)\}/)
    expect(rest).toMatch(/<details key=\{sec\.domain\} className="group">/)
    expect(rest).toMatch(/\{sec\.items\.map\(\(x\) => row\(x, true\)\)\}/)
    expect(rest, 'صف خفيف في المنح الأخرى').not.toMatch(/lightRow/)
  })

  it('⚠️ الصف الخفيف: اسم المدرب بكلمتين تحت الصورة، ولا نص تحت العنوان إلا سعره ويومه', () => {
    const light = body('const lightRow = ')
    const label = light.slice(light.indexOf('<label'), light.indexOf('</label>'))
    /* اسمُه تحت الصورة: بعد الصورة وقبل عمود العنوان */
    const photo = label.indexOf('<img'), name = label.indexOf('{trainerShortNameAr(x.trainer.name)}'), title = label.indexOf('{x.titleAr}</span>')
    expect(photo).toBeGreaterThan(-1)
    expect(name, 'لا اسم قصير').toBeGreaterThan(photo)
    expect(name, 'الاسم ليس تحت الصورة').toBeLessThan(title)
    expect(label, 'عاد «مع …»').not.toMatch(/مع \{x\.trainer/)
    expect(label, 'عاد الوعد').not.toMatch(/aboutAr/)
    expect(label, 'عاد سطر المجال واللقاءات').not.toMatch(/domainAr|grantSessionsAr|Zoom|perMeeting|للقاء/)
    /* ولا ثمنُ لقاء في الصفّ كلّه — قرارُ صاحب المنصّة (٢٢ نوفمبر ٢٠٢٦): «ازل كلمة السعر للقاء فهو يشتت» */
    expect(light, 'عاد ثمن اللقاء').not.toMatch(/للقاء|perMeeting|grantPerSession/)
    /* وما تحت العنوان: سطرُ السعر بيوم البدء قصيرا — ثمّ تحذيرُ التعارض إن كان */
    const under = label.slice(title)
    expect(under).toMatch(/\{money\(pay\)\}/)
    expect(under).toMatch(/تبدأ \{cohortDayAr\(x\.startsAt, \{ day: "numeric", month: "long" \}\)\}/)
    expect(label).toContain('onChange={() => toggle(x.courseId)}')
    /* وأصغر: صورةٌ ٨٠ لا ٩٦–١١٢، وحشوةٌ أضيق، وعنوانٌ بخطّ القراءة لا بخطّ الصفّ */
    expect(label).toMatch(/className="h-20 w-20 rounded-xl object-cover shadow"/)
    expect(light).toMatch(/className=\{`px-3 py-2\.5 /)
    expect(label).toMatch(/<span className="block text-read font-bold leading-6">\{x\.titleAr\}<\/span>/)
    expect(light, 'غابت النبذة المطوية').toMatch(/\{about\(x\)\}/)
    expect(light).toMatch(/const startHere = flat\?\.\[0\]\?\.courseId === x\.courseId;/)
    expect(light).toMatch(/\{startHere && <span[^>]*>.*ابدأ بها<\/span>\}/)
  })

  it('⚠️ وصف المنح الأخرى على حاله: «مع …» والوعد وسطر المجال واللقاءات وثمن اللقاء', () => {
    const row = body('const row = ')
    expect(row).toMatch(/مع \{x\.trainer\.name\}/)
    expect(row).toMatch(/\{sum\?\.aboutAr && \(/)
    expect(row).toMatch(/\{x\.domainAr && !inSection \? `\$\{x\.domainAr\} · ` : ""\}تبدأ \{cohortDayAr\(x\.startsAt\)\}/)
    expect(row).toMatch(/للقاء<\/span>\}/)
    expect(row).toMatch(/className="h-24 w-24 rounded-2xl object-cover shadow-lg sm:h-28 sm:w-28"/)
    expect(row, 'صار صف المنح خفيفا').not.toMatch(/trainerShortNameAr/)
  })

  it('⚠️ ونصوصه بلا تشكيل', () => {
    const light = body('const lightRow = ')
    const said = ['ابدأ بها', 'تبدأ', 'ابدأ بالأولى، وكودك يبقى لباقيها بنفس الخصم.']
    for (const t of said) {
      expect(light + PAGE, t).toContain(t)
      expect(plainAr(t)).toBe(t)
    }
  })
})
