/* خريطةُ الموقع وllms.txt حيّين — بما يُعرض الآن لا بما كان يومَ البناء.

   ═══ لماذا من الخادم (٥ نوفمبر ٢٠٢٦) ═══

   صفحاتُ المسارات والدورات مُهيَّأةٌ كلُّها وقتَ البناء (`scripts/prerender-seo.ts`) —
   فكلُّ صفحةٍ منها موجودةٌ لمن يملك رابطَها، بقرار ٢١ أكتوبر. لكنّ **دعوةَ الزاحف**
   إليها شأنٌ آخر: المسارُ يُعرض حين تكون لكلّ دوراته شعبةٌ في فصله، والدورةُ حين
   تكون لها شعبة. وذلك في القاعدة ويتغيّر كلَّ يوم — والبناءُ لا يعرفه.

   فخريطةٌ ساكنةٌ إمّا تدعو إلى المساراتِ المخفيّة (وقرارُ صاحب المنصّة ٢٨ أكتوبر:
   «أبقِ المساراتِ... مخفيّة»)، وإمّا تسكت عن كلّ مسار. فيجيبها الخادم بالشروط
   نفسِها التي تُرشّح القوائم:
     · المسار ← `listedWhole` بجواب `listedCourses()` نفسِه.
     · الدورة ← لها شعبةٌ معروضة (`listedCohortWhere`).

   ولا صفحاتُ المدرّبين (`/t/:slug`) بعدُ: يجيبها الخادمُ لزواحف المعاينة وحدَها، ولقوقل
   قالبُ الرئيسة بـcanonicalها — فدعوتُه إليها تُسجَّل «نسخةً بديلة». تدخل حين تُهيَّأ.

   والصيغةُ في `src/application/site/seo-feeds.ts` — هي نفسُها التي يكتب بها البناءُ
   النسخةَ الساكنةَ الاحتياطيّة. */

import type { PrismaClient } from '@prisma/client'
import publicPathwaysJson from '../../src/data/catalog/public-pathways.json'
import { PUBLIC_PAGES, type PublicPage } from '../../src/application/site/public-pages'
import { CANONICAL_ORIGIN } from '../../src/application/site/origin'
import { llmsTxt, sitemapXml, type LlmsLink, type SitemapEntry } from '../../src/application/site/seo-feeds'
import { listedWhole } from '../../src/application/catalog/listed-courses'
import { faqs } from '../../src/data/siteContent'
import { PublicCatalogService } from './public-catalog.service'

/** الأصلُ الذي تُعلنه الصفحاتُ المُهيَّأة في `canonical` — والخريطةُ تطابقه حرفا */
export function seoOrigin(): string {
  return (process.env.VITE_SITE_ORIGIN || CANONICAL_ORIGIN).replace(/\/+$/, '')
}

interface PublicPathwaySource {
  id: string
  title: string
  after: string
  course_ids: string[]
}

const PATHWAYS = publicPathwaysJson.pathways as PublicPathwaySource[]
const PATHWAYS_SEASON = (publicPathwaysJson as { season?: string }).season ?? null

const LEGAL = new Set(['/p/privacy', '/p/terms', '/p/refund'])

/** ما يُعرض الآن — مساراتٌ ودورات، بالشروط التي ترشّح قوائم الموقع */
export interface LiveCatalog {
  pathways: LlmsLink[]
  courses: LlmsLink[]
}

export class SeoFeedsService {
  private readonly catalog: PublicCatalogService

  constructor(prisma: PrismaClient) {
    this.catalog = new PublicCatalogService(prisma)
  }

  async live(now = new Date()): Promise<LiveCatalog> {
    const [listed, published] = await Promise.all([this.catalog.listedCourses(now), this.catalog.courses()])

    const ids = new Set(listed.courseIds)
    const state = {
      state: 'ready' as const,
      ids,
      seasons: new Map(Object.entries(listed.seasons).map(([k, v]) => [k, new Set(v)])),
      season: listed.season,
    }
    const pathways = listedWhole(
      PATHWAYS.map((p) => ({ ...p, courseIds: p.course_ids, season: PATHWAYS_SEASON })),
      state,
    ).map((p) => ({ path: `/pathways/${p.id}`, title: p.title, note: p.after }))

    const courses = published
      .filter((c) => ids.has(c.id) && c.title)
      .map((c) => ({
        path: `/build/${c.id}`,
        title: c.title,
        note: c.totalHours > 0 ? `${c.totalHours} ساعة، مباشرة عبر الإنترنت` : undefined,
      }))

    return { pathways, courses }
  }

  /** ما يُعرض الآن، أو لا شيءَ منه إن تعذّرت القاعدة — فتبقى الصفحاتُ العامّة.
      خريطةٌ ناقصةٌ خيرٌ من ٥٠٠ يقرؤه قوقل «تعذّر جلبُ الخريطة». */
  async liveOrEmpty(onError: (e: unknown) => void, now = new Date()): Promise<LiveCatalog> {
    try {
      return await this.live(now)
    } catch (e) {
      onError(e)
      return EMPTY_LIVE
    }
  }
}

export const EMPTY_LIVE: LiveCatalog = { pathways: [], courses: [] }

/** خريطةُ الموقع: الصفحاتُ العامّة، فما يُعرض الآن */
export function liveSitemap(live: LiveCatalog): string {
  const entries: SitemapEntry[] = [
    ...PUBLIC_PAGES,
    ...live.pathways.map((l) => ({ path: l.path, priority: 0.8 })),
    ...live.courses.map((l) => ({ path: l.path, priority: 0.7 })),
  ]
  return sitemapXml(seoOrigin(), entries)
}

/** llms.txt: من نحن، فالصفحاتُ الأساسيّة، فما يُعرض الآن، فالأسئلةُ الشائعة */
export function liveLlmsTxt(live: LiveCatalog): string {
  const link = (p: PublicPage): LlmsLink => ({ path: p.path, title: p.title, note: p.description })
  return llmsTxt(seoOrigin(), {
    pages: PUBLIC_PAGES.filter((p) => !LEGAL.has(p.path)).map(link),
    pathways: live.pathways,
    courses: live.courses,
    faqs,
    optional: PUBLIC_PAGES.filter((p) => LEGAL.has(p.path)).map(link),
  })
}
