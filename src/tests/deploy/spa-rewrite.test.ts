/* إعادة التوجيه الشاملة لا تبتلع /assets — وإلا مات الموقع بعد كل نشر.

   كانت القاعدة `/((?!api/).*)` تُحوّل كلَّ ما ليس API إلى index.html. وهي
   تعمل بعد فحص الملفات، فالأصل الموجود يُقدَّم والمفقود يقع في التحويل:
   فيردّ الخادم على `/assets/index-قديم.js` رمزَ **200** ونوعَ **text/html**
   بدل 404.

   وأثرها أنّ الموقع يموت لكل زائر يحمل صفحةً مخزّنة بعد أيّ نشر: بصمات
   الأصول تتغيّر مع كل بناء، فيطلب متصفّحه الأصل القديم، فيتلقّى HTML بدل
   JavaScript، فيرفضه بصرامة أنواع الوحدات:

     Failed to load module script: Expected a JavaScript-or-Wasm module script
     but the server responded with a MIME type of "text/html".

   ولا يُركَّب شيء — صفحة بيضاء «لا تحمّل بتاتا». ولا يظهر العطب في أيّ فحص
   من الخارج: كلّ طلبٍ جديد يجلب index.html جديدا بأصوله الصحيحة، فيبدو
   الموقع سليما لمن يفتحه أوّل مرّة ويموت لمن كان يتصفّحه.

   والصواب أن يُستثنى `assets/` فيردّ المفقود 404 صريحا: يفشل الطلب فورا،
   وإعادةُ التحميل تجلب index.html الجديد بأصوله الجديدة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CFG = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[]
}

/** يحاكي مطابقة Vercel: القاعدة تلتقط المسار أم لا؟ */
const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path)

describe('إعادة توجيه SPA', () => {
  const spa = CFG.rewrites.find((r) => r.destination === '/index.html')

  it('القاعدة الشاملة موجودة — بدونها تسقط كل صفحة عميقة', () => {
    expect(spa).toBeDefined()
  })

  it('لا تلتقط /assets — الأصل المفقود يجب أن يردّ 404 لا HTML', () => {
    for (const p of [
      '/assets/index-BS48O6Qj.js',
      '/assets/index-CSD1e989.css',
      '/assets/Diagnostic-BBo2hD_0.js',
    ]) {
      expect(matches(spa!.source, p), `${p} يقع في التحويل فيُقدَّم HTML مكانه`).toBe(false)
    }
  })

  it('ولا تلتقط /api — وإلا انقطع الخادم', () => {
    expect(matches(spa!.source, '/api/version')).toBe(false)
    expect(matches(spa!.source, '/api/public/core-catalog')).toBe(false)
  })

  it('وتلتقط مسارات الصفحات — وإلا سقط التحديث على صفحة عميقة', () => {
    for (const p of ['/', '/pathways', '/pathways/PW-EMP-003', '/diagnostic', '/student/learning']) {
      expect(matches(spa!.source, p), `${p} لا يقع في التحويل فيسقط بـ404`).toBe(true)
    }
  })
})
