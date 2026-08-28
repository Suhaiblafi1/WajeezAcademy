import { useEffect } from 'react'
import { siteOrigin } from '@/application/site/origin'

/* رأس SEO لكل صفحة: عنوان ووصف ومشاركة وفهرسة — يُحقن عند التنقل */
interface Props {
  title: string
  description: string
  /** مسار الصفحة للرابط القانوني والمشاركة — مثل /pathways */
  path?: string
  /** الصفحات الداخلية غير العامة لا تُفهرس */
  noindex?: boolean
}

const SITE = 'أكاديمية وجيز'
/* الأصل لم يعد ثابتا هنا: في الفترة التجريبية كان يُعلن canonical إلى نطاق لا
   يستجيب. انظر src/application/site/origin.ts. */

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

export default function SeoHead({ title, description, path = '/', noindex = false }: Props) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE}`
    document.title = fullTitle
    const url = `${siteOrigin()}${path}`
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:locale', 'ar_AR')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url
  }, [title, description, path, noindex])
  return null
}
