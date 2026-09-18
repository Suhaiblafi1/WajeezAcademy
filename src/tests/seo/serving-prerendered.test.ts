/* الخادمُ يقدّم الصفحةَ المُهيَّأة — وإلّا فالتهيئةُ حبرٌ في `dist/` لا يقرؤه أحد.

   `scripts/prerender-seo.ts` يكتب `/pathways` في `dist/pathways.html` بوسومها.
   فإن بقي الخادمُ على `try_files {path} /index.html` رجعت كلُّ صفحةٍ إلى
   `index.html` — بعنوان الرئيسة وcanonicalها — وصار كلُّ العمل بلا أثر.
   والسقوطُ صامت: الموقعُ يعمل، ولا شيءَ يحمرّ، ولا يظهر في قوقل.

   ولماذا `.html` لا مجلّد: مجلّدُ `pathways/index.html` يجعل الخادمَ يحوّل
   `/pathways` إلى `/pathways/` — عنوانا ثانيا بشرطةٍ مائلةٍ يخالف `canonical`
   المُعلَن، فيُقرأ تحويلا لا صفحة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const CADDY = readFileSync(join(root, 'deploy/Caddyfile'), 'utf8')
const HTACCESS = readFileSync(join(root, 'public/.htaccess'), 'utf8')

describe('Caddy — الملفُّ الذي يخدم', () => {
  /** وسائطُ `try_files` بترتيبها */
  const tryFiles = (/^\s*try_files\s+(.+)$/m.exec(CADDY)?.[1] ?? '').trim().split(/\s+/)

  it('يُلتقط سطرُ try_files أصلا', () => {
    expect(tryFiles.length, 'لم يُلتقط try_files').toBeGreaterThan(1)
  })

  it('يجرّب صفحةَ المسار المُهيَّأة قبل السقوط على index.html', () => {
    const page = tryFiles.indexOf('{path}.html')
    const fallback = tryFiles.indexOf('/index.html')
    expect(page, 'لا يُجرَّب {path}.html — فكلُّ صفحةٍ ترجع بوسوم الرئيسة').toBeGreaterThan(-1)
    expect(fallback).toBeGreaterThan(-1)
    expect(page, 'السقوطُ على index.html يسبق الصفحةَ المُهيَّأة فيبتلعها').toBeLessThan(fallback)
  })

  it('وصفحاتُ HTML لا تُخزَّن في المتصفّح — هي التي تدلّ على الأصول الجديدة', () => {
    /* والمقياسُ «مسارٌ بلا امتداد»: كلُّ صفحةٍ مُهيَّأةٍ تُطلب بلا امتداد */
    expect(CADDY).toMatch(/@page\s+not\s+path_regexp/)
    expect(CADDY).toMatch(/header\s+@page\s+Cache-Control\s+"no-cache"/)
  })

  it('وأصولُ البصمة تبقى مخزَّنةً سنة — لا تُلغى بقاعدة الصفحات', () => {
    expect(CADDY).toMatch(/header\s+@hashed\s+Cache-Control\s+"public, max-age=31536000, immutable"/)
  })
})

describe('Apache — النسخةُ الموازية', () => {
  /* ⚠️ لا يُقرأ على الإنتاج (خادمُنا Caddy)، لكنّه يبقى متطابقا لمن يقرؤه */
  it('يقدّم صفحةَ المسار المُهيَّأة إن وُجدت', () => {
    expect(HTACCESS).toMatch(/RewriteCond %\{DOCUMENT_ROOT\}\/\$1\.html -f/)
    expect(HTACCESS).toMatch(/RewriteRule \^\(\.\+\?\)\/\?\$ \/\$1\.html \[L\]/)
  })

  it('وقاعدةُ الصفحات تسبق السقوطَ الشامل — الترتيبُ في mod_rewrite يحسم', () => {
    const page = HTACCESS.indexOf('%{DOCUMENT_ROOT}/$1.html -f')
    const catchAll = HTACCESS.indexOf('RewriteRule ^ index.html [L]')
    expect(page).toBeGreaterThan(-1)
    expect(catchAll).toBeGreaterThan(page)
  })

  it('واستثناءُ assets يبقى قبلهما — أصلٌ مفقودٌ يردّ 404 لا صفحة', () => {
    const assets = HTACCESS.indexOf('RewriteCond %{REQUEST_URI} ^/assets/')
    const page = HTACCESS.indexOf('%{DOCUMENT_ROOT}/$1.html -f')
    expect(assets).toBeGreaterThan(-1)
    expect(page).toBeGreaterThan(assets)
  })
})

describe('عاملُ الخدمة — قوقعةٌ لكلّ مسار', () => {
  const SW = readFileSync(join(root, 'public/sw.js'), 'utf8')

  it('لا يخزّن كلَّ التنقّلات تحت مفتاحٍ واحد', () => {
    /* كان المفتاحُ `SHELL` للجميع — صحيحا يومَ كان الخادمُ يردّ الملفَّ نفسَه
       لكلّ مسار. وبعد التهيئة صار يردّ عند الانقطاع صفحةً بعنوانٍ ليس عنوانَها. */
    expect(SW, 'مفتاحٌ واحدٌ لكلّ تنقّل').not.toMatch(/networkFirst\(request,\s*SHELL\)/)
    expect(SW).toMatch(/navigationFirst\(request,\s*url\.origin \+ url\.pathname\)/)
  })

  it('و`SHELL` يبقى ملاذا أخيرا لمسارٍ لم يُزَر', () => {
    expect(SW).toMatch(/caches\.match\(key\)\)\s*\|\|\s*\(await caches\.match\(SHELL\)\)/)
  })
})
