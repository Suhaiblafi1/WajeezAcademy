/* «من نحن» — تعريفٌ مختصر، ثمّ ما يميّزنا، ونسخةٌ نصّيّةٌ لا تفترق عن الصفحة.

   طلب صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦) أن تبدأ الصفحةُ بأنّ الأكاديمية جزءٌ من
   وجيز مع موقعَي أخويها، ثمّ تقول ما يميّزنا، ولا تكرّر ما في الرئيسيّة.
   فالذي يُحرس هنا:

   · الافتتاحُ هو التعريف: عنوانُ الصفحة الأوّل فيه، وموقعا تطبيق وجيز ووجيز
     مهارات روابطُ حقيقيّةٌ منه.
   · ولا شيءَ من الرئيسيّة: لا شعاراتِ إعلامٍ ولا جدارَ مؤسساتٍ ولا أرقامَ
     ثقة — والفحصُ على ما يُستورد لا على ورود كلمة.
   · ولا رقمَ يُكتب باليد في النثر — إلّا سنةً.
   · والنسخةُ التي يقرؤها الزاحف هي الصفحةُ نفسُها لا نسخةٌ ثانية.
   · والصفحةُ تدلّ على ما وعد به الطلب: التشخيصُ والمنهجيّة والكتالوج،
     والتواصلُ في الختام. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ABOUT_DESCRIPTION, ABOUT_TITLE, CLOSING, FAMILY_INTRO, FEATURES, FEATURE_HERO, HONESTY_LINE,
  OUTCOMES, PRICE, SOURCE_KINDS, aboutStaticPage,
} from '@/data/about'
import { homeTrustMetrics, metricsFor, wajeezAppStats } from '@/data/trustMetrics'
import { staticPageBySlug } from '@/data/siteContent'
import { publicPageByPath } from '@/application/site/public-pages'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/* بلا تعليقات: الحارسُ على ما يُصيَّر، وذِكرُ المسار في شرحٍ ليس رابطا إليه */
const code = (file: string) =>
  readFileSync(join(root, file), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const about = code('src/pages/About.tsx')

describe('الافتتاحُ: الأكاديميةُ جزءٌ من وجيز', () => {
  it('أخوا الأكاديمية بموقعيهما على وجيز — روابطُ https حقيقيّة', () => {
    expect(FAMILY_INTRO.products.map((p) => p.name)).toEqual(['تطبيق وجيز', 'وجيز مهارات'])
    for (const p of FAMILY_INTRO.products) expect(p.url, p.name).toMatch(/^https:\/\/wajeez\.com(\/|$)/)
  })

  it('وعنوانُ الصفحة الأوّلُ (`h1`) هو التعريف، والتعريفُ أوّلُ ما يُصيَّر', () => {
    const h1s = about.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? []
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toContain('{FAMILY_INTRO.brand}')
    expect(h1s[0]).toContain('{FAMILY_INTRO.belongs}')
    expect(`${FAMILY_INTRO.brand} ${FAMILY_INTRO.belongs}`).toBe(FAMILY_INTRO.title)
    const body = about.slice(about.indexOf('export default function About'))
    expect(body.indexOf('<FamilyIntro />'), 'الافتتاحُ غائب').toBeGreaterThan(-1)
    expect(body.indexOf('<FamilyIntro />')).toBeLessThan(body.indexOf('<Hero />'))
  })

  it('والروابطُ تُصيَّر من الموقعَين نفسيهما — لا عنوانٌ مكتوبٌ باليد في الصفحة', () => {
    expect(about).toMatch(/FAMILY_INTRO\.products\.map\(/)
    expect(about).toMatch(/href=\{p\.url\}/)
    expect(about).not.toMatch(/href="https:\/\/wajeez\.com/)
  })
})

describe('وسطرا «ما يميّزنا» يُلوَّن منهما ما سُمّي', () => {
  it('كلُّ عبارةٍ ملوّنةٍ واردةٌ في سطرٍ بعينه — وإلّا لم يُلوَّن شيءٌ صامتا', () => {
    expect(FEATURE_HERO.highlights.length).toBeGreaterThan(0)
    for (const h of FEATURE_HERO.highlights) {
      expect(FEATURE_HERO.lines.filter((l) => l.includes(h)), h).toHaveLength(1)
    }
  })
})

describe('ولا شيءَ من الرئيسيّة يتكرّر', () => {
  const imports = about.match(/^import[\s\S]*?from '[^']+'/gm) ?? []
  const imported = imports.join('\n')

  it('الاستيراداتُ تُقرأ فعلا — وإلّا مرّ الحارسُ على فراغ', () => {
    expect(imports.length).toBeGreaterThan(5)
  })

  it('لا شعاراتِ إعلامٍ ولا جدارَ مؤسساتٍ ولا أرقامَ ثقة', () => {
    expect(imported).not.toMatch(/\bpartnerLogos\b/)
    expect(imported).not.toMatch(/EcosystemOrgStrip/)
    expect(imported).not.toMatch(/data\/trustMetrics/)
  })

  it('وخطُّ الصفحة خطُّ المنصّة — لا رقعةَ فيها', () => {
    expect(about).not.toMatch(/Aref Ruqaa/)
  })
})

describe('ما يميّزنا — كما سمّاه صاحبُ المنصّة', () => {
  it('المحطّاتُ الخمسُ بترتيب الرحلة، ثمّ السعر', () => {
    expect(FEATURES.map((f) => f.id)).toEqual(['advisor', 'sources', 'training', 'experts', 'graduation'])
    expect(PRICE.title).toMatch(/مخفّضة/)
    expect(PRICE.title).toMatch(/مجتمع المحلّي/)
  })

  it('ولكلّ محطّةٍ شكلُها على الخطّ — لا محطّةَ بلا رسم', () => {
    const spine = about.match(/const SPINE: Record<FeatureId, ReactNode> = \{([\s\S]*?)\n\}/)?.[1] ?? ''
    for (const f of FEATURES) expect(spine, f.id).toMatch(new RegExp(`\\b${f.id}:`))
  })
})

describe('ولا رقمَ مكتوبٌ باليد في النثر', () => {
  const prose: string[] = [
    ABOUT_TITLE, ABOUT_DESCRIPTION, FAMILY_INTRO.title, FAMILY_INTRO.body,
    ...FAMILY_INTRO.products.flatMap((p) => [p.name, p.note, p.pitch]),
    ...FEATURE_HERO.highlights,
    ...FEATURE_HERO.lines, FEATURE_HERO.lead,
    ...FEATURES.flatMap((f) => [f.margin, f.station, f.stationNote, f.title, ...f.paragraphs]),
    ...SOURCE_KINDS, PRICE.margin, PRICE.title, ...PRICE.paragraphs,
    ...OUTCOMES.flatMap((o) => [o.title, o.body, o.link?.label ?? '']),
    HONESTY_LINE, CLOSING.title, CLOSING.body,
  ]

  it('النصُّ يُقرأ فعلا — وإلّا مرّ الحارسُ على فراغ', () => {
    expect(prose.join(' ').length).toBeGreaterThan(1500)
  })

  it('كلُّ رقمٍ في النثر سنةٌ من هذا القرن', () => {
    const digits = prose.flatMap((t) => t.match(/[0-9٠-٩][0-9٠-٩,.٬]*/g) ?? [])
    const notYears = digits.filter((d) => !/^20\d{2}$/.test(d))
    expect(notYears, `رقمٌ مكتوبٌ باليد: ${notYears.join('، ')}`).toEqual([])
  })
})

describe('وشريطُ الرئيسيّة باقٍ على وجيز مهارات', () => {
  it('لا رقمَ من التطبيق العامّ في شريط الرئيسيّة (القاعدة ١ و٢ في `trustMetrics`)', () => {
    const home = homeTrustMetrics()
    expect(home.length).toBeGreaterThan(0)
    expect(home.every((m) => m.source_scope === 'wajeez_skills')).toBe(true)
    const appKeys = new Set(wajeezAppStats.map((m) => m.key))
    expect(home.filter((m) => appKeys.has(m.key))).toEqual([])
  })

  it('و`metricsFor` تسقط على مفتاحٍ غائبٍ أو مرفوضٍ أو من نطاقٍ آخر — لا تُسقطه صامتة', () => {
    expect(() => metricsFor('wajeez_app', ['لا-وجود-له'])).toThrow()
    expect(() => metricsFor('wajeez_skills', ['user_rating'])).toThrow()
    expect(() => metricsFor('wajeez_app', ['organizations'])).toThrow()
    expect(metricsFor('wajeez_app', ['app_users']).map((m) => m.key)).toEqual(['app_users'])
  })
})

describe('النسخةُ النصّيّة هي الصفحةُ نفسُها', () => {
  const page = aboutStaticPage()
  const text = page.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n')

  it('صفحةُ `/p/about` في المحتوى الثابت هي المشتقّة', () => {
    expect(staticPageBySlug('about')).toEqual(page)
  })

  it('وفيها التعريفُ بموقعَيه، وكلُّ محطّة، والسعرُ والختام', () => {
    expect(text).toContain(FAMILY_INTRO.body)
    for (const p of FAMILY_INTRO.products) expect(text).toContain(p.url)
    for (const f of FEATURES) {
      expect(text).toContain(f.title)
      for (const p of f.paragraphs) expect(text).toContain(p)
    }
    for (const o of OUTCOMES) expect(text).toContain(o.title)
    expect(text).toContain(PRICE.title)
    expect(text).toContain(HONESTY_LINE)
    expect(text).toContain(CLOSING.body)
  })

  it('وعنوانُ البحث ووصفُه منها — والوصفُ في حدود ما يعرضه قوقل', () => {
    const seo = publicPageByPath('/p/about')
    expect(seo?.title).toBe(ABOUT_TITLE)
    expect(seo?.description).toBe(ABOUT_DESCRIPTION)
    expect(ABOUT_DESCRIPTION.length).toBeGreaterThan(50)
    expect(ABOUT_DESCRIPTION.length).toBeLessThan(320)
  })
})

describe('والصفحةُ تدلّ على ما وعد به الطلب', () => {
  const linksTo = (path: string) => new RegExp(`\\bto="${path.replace(/[?]/g, '\\?')}"`).test(about)

  it('التشخيصُ والمنهجيّة', () => {
    expect(linksTo('/methodology'), 'لا رابطَ إلى المنهجيّة').toBe(true)
    expect(linksTo('/diagnostic'), 'لا رابطَ إلى التشخيص').toBe(true)
  })

  it('والمساراتُ والدوراتُ والفريقُ التدريبيّ', () => {
    for (const p of ['/pathways', '/courses', '/trainers']) expect(linksTo(p), p).toBe(true)
  })

  it('⚠️ والختامُ «تواصل معنا» — وهو الذهبيُّ الوحيدُ في الصفحة', () => {
    expect(about.match(/tone="primary"/g) ?? []).toHaveLength(1)
    expect(about).toMatch(/<Button as=\{Link\} to="\/contact" tone="primary"/)
  })

  it('و«من نحن» تُصيَّر من صفحتها لا من قالب الفقرات', () => {
    const staticSrc = code('src/pages/Static.tsx')
    expect(staticSrc).toMatch(/lazy\(\(\) => import\("\.\/About"\)\)/)
    expect(staticSrc).toMatch(/if \(slug === "about"\) return <AboutPage \/>/)
  })
})
