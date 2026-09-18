/* قواعدُ الزحف — ولا صفحةَ عامّةٍ يمنعها ملفُّنا بأيدينا.

   ── العطبُ الذي أمسكه هذا الحارسُ ──

   كان في `public/robots.txt` سطرُ «Disallow: /trainer» قصدا لبوّابة المدرّب.
   ومطابقةُ robots.txt **بالبادئة**، بلا حدٍّ عند نهاية الكلمة — فالسطرُ يحجب
   `/trainers` كذلك: صفحةَ الفريق التدريبيّ العامّة، **وهي مُعلَنةٌ في خريطة
   الموقع**. أي أنّ الخريطةَ تدعو الزاحفَ إلى عنوانٍ يمنعه الملفُّ نفسُه،
   فيُسجَّل في Search Console «محجوبٌ بـrobots.txt» ولا يُفهرَس أبدا.

   ── ولماذا يُنفَّذ المنطقُ هنا ولا يُطابَق نصّ ──

   حارسٌ يتأكّد أنّ السطرَ «Disallow: /trainer/» مكتوبٌ حرفا يمرّ أخضرَ ولو
   بقي «Disallow: /trainer» تحته. فالمقيسُ **أثرُ القواعد على كلّ مسارٍ عامّ**:
   تُقرأ القواعدُ كما يقرؤها الزاحف (أطولُ مطابقةٍ تغلب)، ثمّ يُسأل عن كلّ
   صفحةٍ في `PUBLIC_PAGES`: أتُزار أم تُمنع؟ */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_PAGES } from '../../application/site/public-pages'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const ROBOTS = readFileSync(join(root, 'public/robots.txt'), 'utf8')

interface Rule {
  allow: boolean
  pattern: string
}

/** قواعدُ كتلة `User-agent: *` — وهي الكتلةُ الوحيدة عندنا */
function rules(): Rule[] {
  const out: Rule[] = []
  let inStar = false
  for (const raw of ROBOTS.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') inStar = value === '*'
    else if (inStar && (key === 'allow' || key === 'disallow')) {
      if (value) out.push({ allow: key === 'allow', pattern: value })
    }
  }
  return out
}

/** هل يُطابق النمطُ هذا المسار؟ بادئةٌ، و`$` حدٌّ عند النهاية، و`*` أيُّ شيء */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const re = new RegExp(
    '^' + body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (anchored ? '$' : ''),
  )
  return re.test(path)
}

/** قرارُ الزاحف: أطولُ نمطٍ مطابقٍ يغلب، وعند التساوي يغلب الإذن */
function isCrawlable(path: string): boolean {
  let best: Rule | null = null
  for (const rule of rules()) {
    if (!matches(rule.pattern, path)) continue
    if (!best || rule.pattern.length > best.pattern.length) best = rule
    else if (rule.pattern.length === best.pattern.length && rule.allow) best = rule
  }
  return best ? best.allow : true
}

describe('robots.txt لا يمنع صفحةً عامّة', () => {
  it('تُقرأ قواعدُ الملفّ أصلا — وإلّا فما بعده يفحص فراغا', () => {
    expect(rules().length, 'لم تُلتقط قاعدةٌ واحدة').toBeGreaterThan(5)
  })

  it.each(PUBLIC_PAGES.map((p) => p.path))('«%s» مسموحٌ للزاحف', (path) => {
    expect(
      isCrawlable(path),
      'صفحةٌ في خريطة الموقع يمنعها robots.txt — تُسجَّل «محجوبةً» ولا تُفهرَس',
    ).toBe(true)
  })

  /* العطبُ بعينه: `/trainers` تحت `Disallow: /trainer` — ويُثبَّت مستقلّا
     لئلّا يذوب في القائمة أعلاه إن سقطت الصفحةُ يوما من السجلّ. */
  it('و`/trainers` بعينها — وقد حجبها «Disallow: /trainer» بالبادئة', () => {
    expect(isCrawlable('/trainers')).toBe(true)
    expect(isCrawlable('/trainers?q=تسويق')).toBe(true)
  })

  it('والبوّاباتُ ممنوعةٌ فعلا — لا يُفتح البابُ باسم إصلاح الحجب', () => {
    for (const path of [
      '/student/learning',
      '/student/certificates',
      '/advisor/cases',
      '/trainer/paths',
      '/trainer/qualifications',
      '/admin/publishing',
      '/auth/reset',
      '/r/some-token',
      '/s/abc123',
      '/join-trainer/status',
    ]) {
      expect(isCrawlable(path), `«${path}» مكشوفٌ للزاحف`).toBe(false)
    }
  })

  it('وخريطةُ الموقع مُعلَنةٌ بالعلامة لا بنطاقٍ مكتوبٍ حرفا', () => {
    const line = ROBOTS.split('\n').find((l) => l.trim().toLowerCase().startsWith('sitemap:'))
    expect(line, 'لا سطرَ Sitemap — الزاحفُ يبحث بنفسه').toBeDefined()
    expect(line).toContain('%VITE_SITE_ORIGIN%/sitemap.xml')
  })

  it('ولا كتلةَ مفردةٍ لزاحفِ إجابةٍ — فهي تُسقط منعَ الكتلة العامّة', () => {
    /* زاحفٌ له كتلتُه يقرؤها **وحدَها** ويُهمل كتلة `*` كلَّها، ومنها منعُ
       البوّابات. فإذنٌ يُكتب له ليقرأ العامَّ ينتهي بفتح الداخليّ. */
    const agents = [...ROBOTS.matchAll(/^\s*User-agent:\s*(.+)$/gim)].map((m) => m[1].trim())
    expect(agents, `كتلٌ مفردةٌ تُسقط المنعَ العامّ: ${agents.join('، ')}`).toEqual(['*'])
  })
})
