/* سجلُّ الصفحات العامّة — ما يُفهرَس، وأنّه لا يفترق عن مساراتِ التطبيق.

   العطبُ الذي وُلد السجلُّ لأجله موصوفٌ في رأس
   `src/application/site/public-pages.ts`: الموقعُ كان يردّ `index.html` نفسَه
   لكلّ مسار، فكلُّ عنوانٍ يُعلن `canonical` الرئيسة — فطُويت صفحاتُ الموقع
   كلُّها في عنوانٍ واحد ولم يظهر منها شيءٌ في قوقل.

   والذي يُقاس هنا: أنّ السجلَّ **لا يكذب**. فصفحةٌ فيه بلا مسارٍ في `App.tsx`
   تُهيَّأ ملفّا لا يصله أحد، ومسارٌ عامٌّ خارجه يبقى بلا وسوم — وهو العطبُ
   بعينه عائدا لصفحةٍ واحدة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLIC_PAGES,
  pageTitle,
  publicPageByPath,
  ROBOTS_INDEXABLE,
  ROBOTS_PRIVATE,
  seoFor,
} from '../../application/site/public-pages'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = readFileSync(join(root, 'src/App.tsx'), 'utf8')

/** مساراتُ `<Route path="…">` كما تُعلن في `App.tsx` — بنيةً لا نصّا */
function declaredRoutes(): string[] {
  return [...APP.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
}

/** هل يصل هذا العنوانُ إلى مُصيِّر؟

    والمطابقةُ على النمط لا على الحرف: صفحاتُ `/p/about` و`/p/faq` وأخواتُها
    يخدمها مسارٌ واحدٌ بمتغيّر (`/p/:slug`) — فمقارنةُ النصّ وحدَها كانت
    ستعدّها أشباحا وهي أحياءٌ تُخدَم فعلا. */
function isServed(path: string, routes: string[]): boolean {
  return routes.some((route) => {
    const pattern = new RegExp(
      '^' +
        route
          .split('/')
          .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
          .join('/') +
        '$',
    )
    return pattern.test(path)
  })
}

describe('سجلُّ الصفحات العامّة', () => {
  it('يُلتقط من App.tsx شيءٌ أصلا — وإلّا فما بعده يفحص فراغا', () => {
    /* حارسٌ للحارس: لو تغيّرت صيغةُ إعلان المسارات لعادت مجموعةٌ فارغة،
       فمرّ كلُّ ما بعدها وهو لا يقيس شيئا. */
    expect(declaredRoutes().length).toBeGreaterThan(20)
  })

  it('كلُّ صفحةٍ في السجلّ لها مسارٌ حقيقيٌّ في App.tsx', () => {
    const routes = declaredRoutes()
    const ghosts = PUBLIC_PAGES.map((p) => p.path).filter((p) => !isServed(p, routes))
    expect(ghosts, `صفحاتٌ تُهيَّأ ولا يصلها أحد:\n${ghosts.join('\n')}`).toEqual([])
  })

  it('ولا مسارَ مكرّرٌ — ملفّان يتنازعان عنوانا واحدا', () => {
    const paths = PUBLIC_PAGES.map((p) => p.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('لكلّ صفحةٍ عنوانٌ ووصفٌ لا يشاركها فيهما غيرُها', () => {
    /* وهذا هو العطبُ الأصليُّ مقيسا: كلُّ الصفحات كانت تحمل عنوانَ الرئيسة
       ووصفَها حرفا بحرف، فيراها قوقل نسخا مكرّرةً لصفحةٍ واحدة. */
    const titles = PUBLIC_PAGES.map((p) => p.title)
    const descriptions = PUBLIC_PAGES.map((p) => p.description)
    expect(new Set(titles).size, 'عنوانٌ مكرّر').toBe(titles.length)
    expect(new Set(descriptions).size, 'وصفٌ مكرّر').toBe(descriptions.length)
  })

  it('والمساراتُ مطلقةٌ بلا شرطةٍ في الذيل — وإلّا خالف العنوانُ canonical', () => {
    for (const p of PUBLIC_PAGES) {
      expect(p.path.startsWith('/'), `«${p.path}» لا يبدأ بشرطة`).toBe(true)
      if (p.path !== '/') {
        expect(p.path.endsWith('/'), `«${p.path}» ينتهي بشرطة`).toBe(false)
      }
    }
  })

  it('والوصفُ جملةٌ تامّةٌ في حدود ما يعرضه قوقل', () => {
    for (const p of PUBLIC_PAGES) {
      expect(p.description.length, `وصفُ «${p.path}» أقصرُ من أن يقول شيئا`).toBeGreaterThan(50)
      expect(p.description.length, `وصفُ «${p.path}» يُقتطع في النتيجة`).toBeLessThan(320)
      expect(p.title.trim(), `عنوانُ «${p.path}» فارغ`).not.toBe('')
    }
  })

  it('واسمُ الموقع يُذيَّل مرّةً واحدة — لا يُكتب في العنوان نفسِه', () => {
    for (const p of PUBLIC_PAGES) {
      expect(pageTitle(p.title)).toBe(`${p.title} — أكاديمية وجيز`)
      /* «أكاديمية وجيز — أكاديمية وجيز» تنتج من عنوانٍ يحمل الاسمَ سلفا */
      expect(pageTitle(p.title).split('أكاديمية وجيز').length - 1, `اسمُ الموقع مكرّرٌ في «${p.path}»`).toBe(1)
    }
  })

  it('و`seoFor` تسقط على مسارٍ غير مسجَّل — لا تُطفئ الوسومَ صامتة', () => {
    expect(() => seoFor('/pathways')).not.toThrow()
    expect(() => seoFor('/لا-وجود-له')).toThrow()
    expect(publicPageByPath('/لا-وجود-له')).toBeUndefined()
  })

  it('وتوجيهُ الفهرسة يأذن بالمقتطف الكامل والصورة الكبيرة', () => {
    expect(ROBOTS_INDEXABLE).toContain('index')
    expect(ROBOTS_INDEXABLE).toContain('max-image-preview:large')
    expect(ROBOTS_INDEXABLE).toContain('max-snippet:-1')
    expect(ROBOTS_PRIVATE).toBe('noindex, nofollow')
  })
})

describe('البوّاباتُ الداخليّة لا تدخل السجلّ', () => {
  /* بوّابةٌ تُهيَّأ ملفّا ساكنا تصير صفحةً عامّةً في الفهرس — وفيها عنوانُ
     شاشةٍ لا يراها إلّا صاحبُ حساب. */
  const PRIVATE_PREFIXES = ['/student', '/advisor', '/trainer/', '/admin', '/auth', '/r/', '/s/']

  it.each(PRIVATE_PREFIXES)('لا صفحةَ عامّةً تحت «%s»', (prefix) => {
    const leaked = PUBLIC_PAGES.filter((p) => p.path.startsWith(prefix))
    expect(leaked.map((p) => p.path)).toEqual([])
  })
})
