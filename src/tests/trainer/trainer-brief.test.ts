/* «التدريبُ معنا» — صفحةُ الدعوة: عامّةٌ لمن معه الرابط، مخفيّةٌ عن غيره (٥ أكتوبر ٢٠٢٦).

   القرارُ في `application/trainer/trainer-brief.ts`: «صفحةٌ أو صفحتان… برابطٍ في
   الموقع لكن مخفيّ». فأربعةٌ تُحرَس، والفحصُ على البنية بعد نزع التعليقات —
   فالتعليقُ الذي يشرح القرارَ يذكر المسارَ ولا يُحسب رابطا إليه:

   ① **تُفتح بلا دخول** — المدعوُّ لا حسابَ له: المسارُ في جدول المسارات قبل
      حارس الأدوار.
   ② **ولا يقود إليها شيء** — لا ملفَّ في `src` يذكر مسارَها غيرُها ومُعرِّفُها
      وجدولُ المسارات، ولا هي في `PUBLIC_PAGES` (خريطةُ الموقع)، وتعلن `noindex`.
      وحجبُ الزاحف في `src/tests/seo/robots.test.ts` بمطابقِه الحقيقيّ.
   ③ **وكلُّ رابطٍ فيها يُفتح** — مرساةُ الدليل قسمٌ موجود، والمسارُ مسارٌ يُخدَم.
   ④ **وما تقوله يطابق مصدرَه** — صيغُ الأتعاب صيغُ `TrainerCompensationRule`
      لا أقلّ ولا أكثر، وحجمُ الكتالوج حجمُه. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRAINER_BRIEF_PATH } from '../../application/trainer/trainer-brief'
import { TRAINER_GUIDE_PATH } from '../../application/trainer/trainer-guide'
import { PUBLIC_PAGES } from '../../application/site/public-pages'
import { GUIDE_SECTIONS } from '../../data/trainer-guide/content'
import * as BRIEF from '../../data/trainer-brief/content'
import { FAMILY_INTRO, FEATURE_HERO, FEATURES } from '../../data/about'

const root = process.cwd()
const strip = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (p: string) => strip(readFileSync(join(root, p), 'utf8'))
const APP = code('src/App.tsx')
const PAGE = code('src/pages/trainer/TrainerBrief.tsx')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('① تُفتح بلا دخول', () => {
  /* في الكتلة العامّة نفسِها التي فيها الدليل — بعده وقبل الحارس الذي يليه.
     وعموميّةُ الدليل يحرسها `guide-link.test.ts` (③). */
  it('المسارُ في جدول المسارات، بجانب الدليل وقبل حارس الأدوار', () => {
    const guide = APP.indexOf(`path="${TRAINER_GUIDE_PATH}"`)
    const route = APP.indexOf(`path="${TRAINER_BRIEF_PATH}"`)
    const guard = APP.indexOf('<Route element={<RequireRole', guide)
    expect(route, 'لا مسارَ للصفحة في App.tsx').toBeGreaterThan(-1)
    expect(guide).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(-1)
    expect(route, 'الصفحةُ قبل الدليل — خارجَ كتلته العامّة').toBeGreaterThan(guide)
    expect(route, 'الصفحةُ داخلَ حارس الأدوار — والمدعوُّ لا حسابَ له').toBeLessThan(guard)
    expect(APP.indexOf('<Route element={<RequireRole allow={TRAINER_ROLES} />}>'), 'وقبل حارس البوّابة بعينه').toBeGreaterThan(route)
  })

  it('وتحت `/trainer/` — فيحجبها سطرُ robots.txt الذي يحجب البوّابة', () => {
    expect(TRAINER_BRIEF_PATH.startsWith('/trainer/')).toBe(true)
  })
})

describe('② ولا يقود إليها شيء', () => {
  it('لا ملفَّ يذكر مسارَها غيرُها ومُعرِّفُها وجدولُ المسارات', () => {
    const allowed = new Set([
      'src/App.tsx',
      'src/application/trainer/trainer-brief.ts',
      'src/pages/trainer/TrainerBrief.tsx',
    ])
    const leaks = walk(join(root, 'src'))
      .map((f) => relative(root, f))
      .filter((f) => !f.startsWith('src/tests/') && !allowed.has(f))
      .filter((f) => {
        const src = code(f)
        return src.includes(TRAINER_BRIEF_PATH) || /\bTRAINER_BRIEF_PATH\b/.test(src)
      })
    expect(leaks, `يقود إلى الصفحة المخفيّة: ${leaks.join('، ')}`).toEqual([])
  })

  it('وليست في خريطة الموقع', () => {
    expect(PUBLIC_PAGES.map((p) => p.path)).not.toContain(TRAINER_BRIEF_PATH)
  })

  it('وتعلن noindex', () => {
    const seo = PAGE.slice(PAGE.indexOf('<SeoHead'), PAGE.indexOf('/>', PAGE.indexOf('<SeoHead')))
    expect(seo, 'لا SeoHead في الصفحة').toContain('path={TRAINER_BRIEF_PATH}')
    expect(seo, 'الصفحةُ المخفيّةُ لا تقول للزاحف ألّا يفهرسها').toMatch(/\bnoindex\b/)
  })
})

describe('③ وكلُّ رابطٍ فيها يُفتح', () => {
  const text = JSON.stringify(Object.values(BRIEF))
  const links = [...text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1])
  const routes = new Set([...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))
  const guideIds = new Set(['first-week', 'faq', 'help', 'journey', ...GUIDE_SECTIONS.map((s) => s.id)])

  it('تُقرأ الروابطُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(links.length).toBeGreaterThan(6)
  })

  it('ومرساةُ الدليل قسمٌ فيه', () => {
    const broken = links
      .filter((h) => h.startsWith(`${TRAINER_GUIDE_PATH}#`))
      .filter((h) => !guideIds.has(h.split('#')[1]))
    expect(broken, `مراسٍ لا قسمَ لها في الدليل: ${broken.join('، ')}`).toEqual([])
  })

  /* والمسارُ بمتغيّرٍ (`/p/:slug`) يُطابَق بمقطعه — و«من نحن» على `/p/about` */
  const served = (path: string) => [...routes].some((r) =>
    r === path || new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`).test(path))

  it('والمسارُ مسارٌ يُخدَم', () => {
    const broken = links.filter((h) => h.startsWith('/')).map((h) => h.split('#')[0]).filter((p) => !served(p))
    expect(broken, `روابطُ إلى مساراتٍ لا تُخدَم: ${broken.join('، ')}`).toEqual([])
  })
})

describe('④ وما تقوله يطابق مصدرَه', () => {
  it('صيغُ الأتعاب صيغُ قاعدة التعويض — لا أقلّ ولا أكثر', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const model = schema.slice(schema.indexOf('model TrainerCompensationRule'))
    const line = /type\s+String\s*\/\/\s*([\w |]+)/.exec(model)
    expect(line, 'تغيّر سطرُ النوع في TrainerCompensationRule — راجع هذا الحارس').toBeTruthy()
    const types = line![1].split('|').map((t) => t.trim()).filter(Boolean).sort()
    expect(BRIEF.PAY_MODELS.map((m) => m.id).sort()).toEqual(types)
  })

  it('والموصى بها واحدةٌ، وهي «لكلّ متعلّم» — صاحبةُ الحدّ الأدنى وأجرِ الرابط', () => {
    expect(BRIEF.PAY_MODELS.filter((m) => m.recommended).map((m) => m.id)).toEqual(['per_seat'])
  })

  /* «ضع هذا المثال عند الحدّ الأدنى» (٦ أكتوبر ٢٠٢٦): أرضيّةُ الشعبة التي قرّرها في
     ١ أكتوبر خمسةَ عشرَ متعلّما بـ٢٢٥ دولارا (`seat-fee.ts`) — ١٥ للمقعد. ومثالٌ
     يبدأ فوقها يَعِد المدعوَّ بأكثرَ ممّا يُتّفق عليه. */
  it('ومثالُ الأجر يبدأ عند الحدّ الأدنى للمقعد — ١٥ دولارا', () => {
    expect(BRIEF.PAY_EXAMPLE_USD.min, 'أدنى المثال فوق الحدّ الأدنى للمقعد (٢٢٥ ÷ ١٥)').toBe(225 / 15)
    expect(BRIEF.PAY_EXAMPLE_AR).toContain(`بين ${225 / 15} و${BRIEF.PAY_EXAMPLE_USD.max} دولارا`)
  })

  it('وحجمُ الكتالوج حجمُه', () => {
    const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
      courses: unknown[]; launch_pathways: unknown[]
    }
    expect(Math.abs(catalog.courses.length - BRIEF.CATALOG_COURSES_ABOUT), '«نحو» تبعد عن العدد أكثرَ من عشر').toBeLessThanOrEqual(10)
    expect(catalog.launch_pathways.length).toBe(BRIEF.CATALOG_PATHWAYS)
  })
})

/* ═══ ⑤ ولا «نؤهّلك» — قرارُ صاحب المنصّة (٥ أكتوبر ٢٠٢٦) ═══
   «لا تقل نؤهّلك لأنّها قد تُقرأ ندرّبك» — ومدرّبٌ خبيرٌ يُدعى لا يُقال له إنّه سيُؤهَّل.
   والفحصُ على نصوص الصفحة (بياناتِها وشيفرةِ عرضها بلا تعليقاتها) بعد نزع الحركات،
   فلا تمرّ الكلمةُ بشدّةٍ أو بلاها. و«أهل» وحدَها لا تُطابَق: «أهلا» ليست منها. */
describe('⑤ ولا «نؤهّلك» في نصٍّ يقرؤه المدعوّ', () => {
  const bare = (t: string) => t.replace(/[\u064B-\u0652]/g, '')
  const QUALIFY = /[نتيأ]ؤهل|تأهيل|مؤهل/

  it('تُقرأ النصوصُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(bare('نؤهّلك'), 'نزعُ الحركات لا يعمل').toMatch(QUALIFY)
    expect(bare('تؤهَّل لها')).toMatch(QUALIFY)
    expect(bare('أهلا وسهلا')).not.toMatch(QUALIFY)
  })

  it('لا في بيانات الصفحة ولا في عرضها', () => {
    const texts = [JSON.stringify(Object.values(BRIEF)), PAGE]
    const hits = texts.flatMap((t) => [...bare(t).matchAll(new RegExp(QUALIFY, 'g'))].map((m) => m[0]))
    expect(hits, `«نؤهّلك» وأخواتُها في الصفحة: ${hits.join('، ')} — قل «نختار لك»`).toEqual([])
  })
})

/* ═══ ⑥ و«من نحن» في الورقة الأولى، والصفحةُ ثلاثُ ورقات (٥ أكتوبر ٢٠٢٦) ═══ */
describe('⑥ «من نحن» أوّلا، وثلاثُ ورقات', () => {
  it('نصُّ «من نحن» من `data/about.ts` نفسِه — لا نسخةٌ تفترق', () => {
    expect(BRIEF.ABOUT_SECTION.body).toBe(FAMILY_INTRO.body)
    expect(BRIEF.ABOUT_SECTION.products.map((p) => p.url)).toEqual(FAMILY_INTRO.products.map((p) => p.url))
    expect(BRIEF.ABOUT_JOURNEY.map((j) => j.id), 'محطّاتُ «من نحن» لا تقابلها محطّاتُ الصفحة').toEqual(FEATURES.map((f) => f.id))
  })

  it('ثلاثُ ورقات، و«من نحن» في الأولى قبل الثانية', () => {
    const sheets = [...PAGE.matchAll(/className="brief-sheet[\s"]/g)].map((m) => m.index!)
    expect(sheets.length, 'الصفحةُ ليست ثلاثَ ورقات').toBe(3)
    const about = PAGE.indexOf('<About />')
    expect(about, '«من نحن» لا تُعرض').toBeGreaterThan(-1)
    expect(about > sheets[0] && about < sheets[1], '«من نحن» خارجَ الورقة الأولى').toBe(true)
  })

  it('وكلُّ ورقةٍ تبدأ صفحتَها في الطباعة', () => {
    expect(PAGE).toMatch(/\.brief-sheet \+ \.brief-sheet \{ break-before: page; \}/)
  })

  /* ونقلةٌ من الأختين إلى المحطّات (٥ أكتوبر ٢٠٢٦): «لا يوجد نقلة» — فبينهما تعريفٌ
     بالأكاديمية من «من نحن» نفسِه، وجملةٌ تعدّ المحطّاتِ وتسمّي محطّةَ المدرّب */
  it('وبين الأختين والمحطّات تعريفٌ بالأكاديمية — من «من نحن» نفسِه', () => {
    expect(BRIEF.ACADEMY_INTRO.name).toBe(FAMILY_INTRO.title)
    expect(BRIEF.ACADEMY_INTRO.tagline).toBe(FEATURE_HERO.lines.join(' '))
    expect(BRIEF.ACADEMY_INTRO.body.startsWith(FEATURE_HERO.lead.split(':')[0])).toBe(true)
    const products = PAGE.indexOf('a.products.map')
    const intro = PAGE.indexOf('{ACADEMY_INTRO.name}')
    const journey = PAGE.indexOf('ABOUT_JOURNEY.map')
    expect(products).toBeGreaterThan(-1)
    expect(intro, 'التعريفُ بالأكاديمية لا يُعرض').toBeGreaterThan(-1)
    expect(intro > products && intro < journey, 'التعريفُ ليس بين الأختين والمحطّات').toBe(true)
  })

  it('والجملةُ تعدّ المحطّاتِ وتسمّي محطّةَ المدرّب كما هي', () => {
    const count: Record<number, string> = { 3: 'ثلاثُ', 4: 'أربعُ', 5: 'خمسُ', 6: 'ستُّ', 7: 'سبعُ' }
    const ordinal = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة']
    const at = BRIEF.ABOUT_JOURNEY.findIndex((j) => j.id === 'training')
    expect(at, 'لا محطّةَ تدريب').toBeGreaterThan(-1)
    expect(BRIEF.ACADEMY_INTRO.body).toContain(`${count[BRIEF.ABOUT_JOURNEY.length]} محطّات`)
    expect(BRIEF.ACADEMY_INTRO.body).toContain(`محطّتُها ${ordinal[at]}`)
  })
})

/* ═══ ⑦ وورقُها غيرُ ورق الدليل (٥ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة إنّ الناسَ يتبيّنون الصفحةَ بشكلها لا بعنوانها: من ضغط فيها
   رابطا إلى الدليل يجب أن يرى أنّه انتقل. فلونُ الورق يُقرأ من الورقتين نفسَيهما —
   أنماطِ الدليل (`GuideKit.tsx`) وأنماطِ الصفحة — في الداكن والفاتح والمطبوع، ويُقاس
   البعدُ بينهما. والعلّةُ في رأس `BRIEF_CSS`. */
describe('⑦ وورقُها غيرُ ورق الدليل', () => {
  const KIT = code('src/components/guide/GuideKit.tsx')
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  /** قيمةُ متغيّرٍ في كتلةٍ تبدأ سطرَها بمحدِّدٍ بعينه — لا في كتلةٍ تذكره بين غيره */
  const varIn = (css: string, selector: string, name: string) => {
    const block = new RegExp(`(?:^|\\n)\\s*${esc(selector)}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
    const v = block && new RegExp(`${esc(name)}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(block)
    return v ? [Number(v[1]), Number(v[2]), Number(v[3])] : null
  }
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const apart = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const LIGHT = 'html[data-theme="light"]'

  const guide = { dark: varIn(KIT, '.guide-root', '--g-paper'), light: varIn(KIT, `${LIGHT} .guide-root`, '--g-paper') }
  const brief = {
    dark: varIn(PAGE, '.guide-root.brief-root', '--g-paper'),
    light: varIn(PAGE, `${LIGHT} .guide-root.brief-root`, '--g-paper'),
    print: varIn(PAGE, `html .guide-root.brief-root, ${LIGHT} .guide-root.brief-root`, '--g-paper'),
  }

  it('تُقرأ الألوانُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(guide.dark && guide.light, 'لا يُقرأ ورقُ الدليل من GuideKit.tsx').toBeTruthy()
    expect(brief.dark && brief.light && brief.print, 'لا يُقرأ ورقُ الصفحة من TrainerBrief.tsx').toBeTruthy()
  })

  it('والصفحةُ تلبسه: صنفُ ورقها على جذرها', () => {
    expect(PAGE).toMatch(/<div dir="rtl" className="guide-root brief-root[\s"]/)
  })

  /* ٢٤ على مكعّب الألوان: الكريميُّ والسماويُّ الباهت بينهما ٢٥، والكحليُّ وأخضرُ
     الدليل الداكن ٣٢ — وما دون ذلك ورقٌ تخطئه العين */
  it.each(['dark', 'light'] as const)('في %s: بعيدٌ عن ورق الدليل', (theme) => {
    expect(apart(brief[theme]!, guide[theme]!), `ورقُ الصفحة في ${theme} يشبه ورقَ الدليل`).toBeGreaterThanOrEqual(24)
  })

  it('والمطبوعُ ورقُ الفاتح نفسُه — وقماشُ الورقة (`@page`) وما تحت المحتوى بلونه', () => {
    expect(brief.print).toEqual(brief.light)
    expect(apart(brief.print!, guide.light!)).toBeGreaterThanOrEqual(24)
    const page = /@page\s*\{[^}]*?background:\s*(#[0-9A-Fa-f]{6})/.exec(PAGE)?.[1]
    const under = /html, body \{ background-color: (#[0-9A-Fa-f]{6}) !important; \}/.exec(PAGE)?.[1]
    expect(page && hex(page), 'قماشُ الورقة المطبوعة غيرُ ورقها').toEqual(brief.print)
    expect(under && hex(under), 'ما تحت آخر المحتوى في الطباعة غيرُ ورقها').toEqual(brief.print)
  })
})

/* ═══ ⑧ ورابطُ الدليل يسمّي قسمَه (٥ أكتوبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة أن تقود الروابطُ إلى القسم بعينه، أو تذكر على الأقلّ أين يقع.
   الهبوطُ يحرسه `guide-land-on-hash.test.ts`، وهنا الرقمُ: كلُّ رابطٍ إلى قسمٍ مرقّمٍ
   يحمل «(القسم NN)» — رقمَه في الدليل نفسِه، كما تكتبه شارتُه. */
describe('⑧ ورابطُ الدليل يسمّي قسمَه', () => {
  const text = JSON.stringify(Object.values(BRIEF))
  const toGuide = [...text.matchAll(new RegExp(`\\[([^\\[\\]"]+)\\]\\(${TRAINER_GUIDE_PATH}#([a-z-]+)\\)`, 'g'))]
    .map((m) => ({ label: m[1], id: m[2], n: GUIDE_SECTIONS.findIndex((s) => s.id === m[2]) + 1 }))
    .filter((l) => l.n > 0)

  it('تُقرأ الروابطُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(toGuide.length).toBeGreaterThanOrEqual(4)
  })

  it('وكلٌّ يحمل رقمَ قسمه في الدليل — لا رقما غيرَه ولا بلا رقم', () => {
    const wrong = toGuide
      .filter((l) => !l.label.endsWith(`(القسم ${String(l.n).padStart(2, '0')})`))
      .map((l) => `${l.label} ← #${l.id} هو القسم ${l.n}`)
    expect(wrong, `روابطُ لا تسمّي قسمَها: ${wrong.join('، ')}`).toEqual([])
  })
})
