/* «من نحن» — حكايةٌ بأرقامٍ لها مصادر، ونسخةٌ نصّيّةٌ لا تفترق عن الصفحة.

   طلب صاحبُ المنصّة (٢٣ سبتمبر ٢٠٢٦) أن تروي الصفحةُ الحكايةَ كاملةً
   بأرقامها: التطبيق، ثمّ وجيز مهارات، ثمّ الأكاديمية. وذلك نسخٌ جزئيٌّ
   للقاعدة ٢ في `data/trustMetrics.ts` («لا رقمَ من التطبيق العامّ») —
   **لهذه الصفحة وحدَها**. فالذي يُحرس هنا حدودُ ذلك النسخ:

   · كلُّ رقمٍ في فصلٍ من السجلّ بمصدره، ومن نطاق فصله لا غيره (القاعدة ٥).
   · ولا رقمَ يُكتب باليد في النثر — إلّا سنةً.
   · وشريطُ الرئيسيّة باقٍ على وجيز مهارات وحدها (القاعدة ١).
   · والنسخةُ التي يقرؤها الزاحف هي الحكايةُ نفسُها لا نسخةٌ ثانية.
   · والصفحةُ تدلّ على ما وعد به الطلب: المنهجيّةُ من التشخيص، والتواصلُ
     في الختام — والفحصُ على خصائص JSX لا على ورود الكلمة في تعليق. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ABOUT_DESCRIPTION, ABOUT_HERO, ABOUT_TITLE, ACADEMY_STEPS, AUDIENCES, CHAPTERS, CHAPTER_ORDER,
  CLOSING, HONESTY_LINE, OUTCOMES, aboutSources, aboutStaticPage, type ChapterId,
} from '@/data/about'
import { homeTrustMetrics, metricsFor, wajeezAppStats, type TrustScope } from '@/data/trustMetrics'
import { staticPageBySlug } from '@/data/siteContent'
import { publicPageByPath } from '@/application/site/public-pages'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/* بلا تعليقات: الحارسُ على ما يُصيَّر، وذِكرُ المسار في شرحٍ ليس رابطا إليه */
const code = (file: string) =>
  readFileSync(join(root, file), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/** نطاقُ كلّ فصل — وما لا نطاقَ له لا رقمَ فيه */
const SCOPE: Record<ChapterId, TrustScope | null> = {
  app: 'wajeez_app',
  maharat: 'wajeez_skills',
  academy: null,
  next: null,
}

describe('أرقامُ الحكاية من السجلّ الموثَّق', () => {
  it('كلُّ فصلٍ أرقامُه من نطاقه وحدَه — لا يُنسب رقمُ التطبيق إلى غيره', () => {
    for (const id of CHAPTER_ORDER) {
      const scope = SCOPE[id]
      const metrics = CHAPTERS[id].metrics
      if (scope === null) {
        expect(metrics, `فصلُ «${id}» لا نطاقَ له ويعرض أرقاما`).toEqual([])
        continue
      }
      expect(metrics.length, `فصلُ «${id}» بلا أرقام`).toBeGreaterThan(0)
      for (const m of metrics) {
        expect(m.source_scope, `«${m.key}» في فصل «${id}»`).toBe(scope)
      }
    }
  })

  it('ولكلّ رقمٍ مصدرٌ وسياقٌ وتاريخُ تحقّق — ومعتمدٌ للعرض', () => {
    for (const id of CHAPTER_ORDER) {
      for (const m of CHAPTERS[id].metrics) {
        expect(m.approved_for_display, m.key).toBe(true)
        expect(m.source_url, m.key).toMatch(/^https:\/\//)
        expect(m.source_context.trim().length, m.key).toBeGreaterThan(10)
        expect(m.last_verified_at, m.key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('و`metricsFor` تسقط على مفتاحٍ غائبٍ أو مرفوضٍ أو من نطاقٍ آخر — لا تُسقطه صامتة', () => {
    expect(() => metricsFor('wajeez_app', ['لا-وجود-له'])).toThrow()
    /* مرفوضٌ في السجلّ لتضارب صياغة مصدره */
    expect(() => metricsFor('wajeez_skills', ['user_rating'])).toThrow()
    /* رقمُ وجيز مهارات لا يُطلب باسم التطبيق */
    expect(() => metricsFor('wajeez_app', ['organizations'])).toThrow()
    expect(metricsFor('wajeez_app', ['app_users']).map((m) => m.key)).toEqual(['app_users'])
  })

  it('⚠️ وشريطُ الرئيسيّة باقٍ على وجيز مهارات — نسخُ القاعدة ٢ لـ«من نحن» وحدَها', () => {
    const home = homeTrustMetrics()
    expect(home.length).toBeGreaterThan(0)
    expect(home.every((m) => m.source_scope === 'wajeez_skills')).toBe(true)
    const appKeys = new Set(wajeezAppStats.map((m) => m.key))
    expect(home.filter((m) => appKeys.has(m.key))).toEqual([])
    expect(wajeezAppStats.every((m) => !m.selected_for_home)).toBe(true)
  })
})

describe('ولا رقمَ مكتوبٌ باليد في النثر', () => {
  /* كلُّ ما يُقرأ من نصّ الحكاية. والرقمُ الموثَّقُ يأتي من السجلّ في صفّ
     الأرقام؛ أمّا النثرُ فيكتب أعداده كلماتٍ («ثمانمئة ألف») ومصدرُها في
     «من أين هذه الأرقام؟» — ولا يُسمح فيه برقمٍ إلّا سنة. */
  const prose: string[] = [
    ...ABOUT_HERO.lines, ABOUT_HERO.lead, ABOUT_DESCRIPTION, ABOUT_TITLE,
    ...CHAPTER_ORDER.flatMap((id) => [CHAPTERS[id].title, CHAPTERS[id].station, CHAPTERS[id].stationNote, ...CHAPTERS[id].paragraphs]),
    ...ACADEMY_STEPS.flatMap((s) => [s.title, s.body]),
    ...OUTCOMES.flatMap((o) => [o.title, o.body, o.link?.label ?? '']),
    ...AUDIENCES.flatMap((a) => [a.who, a.gets]),
    HONESTY_LINE, CLOSING.title, CLOSING.body,
  ]

  it('النصُّ يُقرأ فعلا — وإلّا مرّ الحارسُ على فراغ', () => {
    expect(prose.join(' ').length).toBeGreaterThan(2000)
  })

  it('كلُّ رقمٍ في النثر سنةٌ من هذا القرن', () => {
    const digits = prose.flatMap((t) => t.match(/[0-9٠-٩][0-9٠-٩,.٬]*/g) ?? [])
    const notYears = digits.filter((d) => !/^20\d{2}$/.test(d))
    expect(notYears, `رقمٌ مكتوبٌ باليد — مكانُه السجلّ: ${notYears.join('، ')}`).toEqual([])
  })

  it('وللنثر مصادرُه — روابطُ حقيقيّة، ومصادرُ الأرقام نفسُها من السجلّ', () => {
    const sources = aboutSources()
    for (const s of sources) {
      expect(s.url, s.claim).toMatch(/^https:\/\//)
      expect(s.claim.trim(), s.url).not.toBe('')
    }
    const metricUrls = CHAPTER_ORDER.flatMap((id) => CHAPTERS[id].metrics.map((m) => m.source_url))
    for (const u of metricUrls) expect(sources.some((s) => s.url === u), u).toBe(true)
  })
})

describe('النسخةُ النصّيّة هي الحكايةُ نفسُها', () => {
  const page = aboutStaticPage()
  const text = page.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n')

  it('صفحةُ `/p/about` في المحتوى الثابت هي المشتقّةُ من الحكاية', () => {
    expect(staticPageBySlug('about')).toEqual(page)
  })

  it('وفيها كلُّ فصلٍ وكلُّ محطّةٍ وكلُّ رقمٍ معروض', () => {
    for (const id of CHAPTER_ORDER) {
      expect(text).toContain(CHAPTERS[id].title)
      for (const p of CHAPTERS[id].paragraphs) expect(text).toContain(p)
      for (const m of CHAPTERS[id].metrics) expect(text).toContain(m.display_value)
    }
    for (const s of ACADEMY_STEPS) expect(text).toContain(s.title)
    for (const o of OUTCOMES) expect(text).toContain(o.title)
  })

  it('وعنوانُ البحث ووصفُه من الحكاية — والوصفُ في حدود ما يعرضه قوقل', () => {
    const seo = publicPageByPath('/p/about')
    expect(seo?.title).toBe(ABOUT_TITLE)
    expect(seo?.description).toBe(ABOUT_DESCRIPTION)
    expect(ABOUT_DESCRIPTION.length).toBeGreaterThan(50)
    expect(ABOUT_DESCRIPTION.length).toBeLessThan(320)
  })
})

describe('والصفحةُ تدلّ على ما وعد به الطلب', () => {
  const about = code('src/pages/About.tsx')
  const linksTo = (path: string) => new RegExp(`\\bto="${path.replace(/[?]/g, '\\?')}"`).test(about)

  it('المنهجيّةُ من محطّة التشخيص، والتشخيصُ نفسُه', () => {
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
