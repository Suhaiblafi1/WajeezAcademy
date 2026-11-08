/* سياسةُ الأمان تسمح بإطار فيديو المدرّب — وبأصوله الثلاثة وحدَها (٨ نوفمبر ٢٠٢٦).

   ═══ لماذا ═══

   «تعرّف على مدرّبك» يضع في صفحة الدورة إطارا من يوتيوب أو فيميو أو درايف (`marketing-video.ts`). و`frame-src`
   في السياسة كانت `'self' https://calendly.com` وحدَها — فالإطارُ يُحجب في الإنتاج مستطيلا فارغا، ولا يظهر ذلك في
   التطوير: خادمُ Vite لا يرسل هذه الترويسة أصلا (درسُ `csp-allows-image-decode.test.ts` نفسُه).

   ═══ وما يُحرَس ═══

   ① كلُّ أصلٍ يبني منه `videoEmbedOf` إطارا موجودٌ في `frame-src` — في `Caddyfile` العامل وفي نسخته `.htaccess`.
      والأصولُ تُقرأ من `VIDEO_EMBED_ORIGINS` نفسِها، فأصلٌ جديدٌ هناك بلا سياسةٍ هنا يُسقطه.
   ② ولا يُفتح `frame-src` أوسعَ من ذلك: لا نجمة، ولا `https:` كلُّها، ولا أصلٌ لا نبني منه شيئا.

   والفحصُ على توجيهات السياسة مفكوكةً — لا على ورود اسمٍ في الملفّ. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { VIDEO_EMBED_ORIGINS } from '@/application/trainer/marketing-video'

const ROOT = join(__dirname, '..', '..', '..')
/** المصدرُ العامل ونسختُه الموازية — `serving-headers.test.ts` يُبقيهما متطابقين */
const SOURCES = ['deploy/Caddyfile', 'public/.htaccess']

/** `frame-src` من السياسة — قائمةُ مصادرها */
function frameSrc(file: string): string[] {
  const header = readFileSync(join(ROOT, file), 'utf8').match(/Content-Security-Policy"?\s+"([^"]+)"/)
  if (!header) throw new Error(`لا سياسة أمان في ${file}`)
  for (const part of header[1].split(';')) {
    const tokens = part.trim().split(/\s+/)
    if (tokens[0] === 'frame-src') return tokens.slice(1)
  }
  return []
}

/** ما كان مسموحا قبل الفيديو — حجزُ مقابلة المتقدّم (`BookInterview.tsx`) */
const BEFORE = ["'self'", 'https://calendly.com']

describe('سياسةُ الأمان وإطارُ فيديو المدرّب يتّفقان', () => {
  for (const file of SOURCES) {
    it(`⚠️ ${file}: كلُّ أصلٍ نبني منه إطارا مسموحٌ في frame-src`, () => {
      const allowed = frameSrc(file)
      expect(allowed.length, 'لا frame-src أصلا — الحارسُ يقيس فراغا').toBeGreaterThan(0)
      for (const origin of Object.values(VIDEO_EMBED_ORIGINS)) {
        expect(allowed, `${origin} محجوبٌ — يظهر الإطارُ في صفحة الدورة فارغا`).toContain(origin)
      }
    })

    it(`⚠️ ${file}: ولا شيءَ أوسعُ منها في frame-src`, () => {
      const extra = frameSrc(file).filter((s) => !BEFORE.includes(s) && !Object.values(VIDEO_EMBED_ORIGINS).includes(s))
      expect(extra, 'فُتح frame-src لما لا نبني منه إطارا').toEqual([])
    })
  }
})
