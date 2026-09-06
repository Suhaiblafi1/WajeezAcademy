/* إعادة توجيه SPA على .htaccess (Apache) — لا تبتلع الأصول المفقودة.

   ⚠️ **وهذا الملفُّ لا يُقرأ على خادم الإنتاج.** خادمُنا Caddy، ولا يقرأ
   `.htaccess` بتاتا — والسلوكُ المحروسُ هنا يُنفَّذ هناك بـ`try_files` في
   `deploy/Caddyfile`. فما يُثبته هذا الحارس: أنّ النصَّ صحيحٌ لمن يقرؤه، **لا
   أنّ أحدا يقرؤه**. ويجاوره `deploy/README.md` بالتنبيه نفسِه، لأنّ ترويسات
   الأمان نُقلت إلى هنا مرّةً فسقطت كلُّها صامتةً على خادمٍ لا يفتح الملفّ.

   نفسُ عطب vercel.json القديم قبل إصلاحه: طلبُ أصلٍ حُذف بعد نشرٍ جديد كان
   سيُرَدّ عليه بـ`index.html` (200 · text/html) بدل 404 — فالمتصفّح يرفضه
   بصرامة أنواع الوحدات لسكربتات type="module"، وتبقى صفحةٌ بيضاء لا تحمّل
   بتاتا لكلّ زائرٍ يحمل صفحةً مخزّنة من قبل النشر. والصوابُ 404 صريح: يفشل
   الطلبُ فورا، وإعادةُ التحميل تجلب index.html الجديد بأصوله الجديدة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HTACCESS = readFileSync(join(process.cwd(), 'public/.htaccess'), 'utf8')

describe('إعادة توجيه SPA على .htaccess', () => {
  it('الملفات والمجلدات الموجودة فعلا تُقدَّم كما هي قبل أي تحويل', () => {
    expect(HTACCESS).toMatch(/RewriteCond %\{REQUEST_FILENAME\} -f/)
    expect(HTACCESS).toMatch(/RewriteCond %\{REQUEST_FILENAME\} -d/)
  })

  it('أصلٌ مفقود تحت assets/ يردّ 404 صريحا — لا index.html', () => {
    expect(
      HTACCESS,
      'بدون هذه القاعدة يعود الأصل المفقود 200 · text/html فيُرفض كسكربت',
    ).toMatch(/RewriteCond %\{REQUEST_URI\} \^\/assets\/\s*\n\s*RewriteRule \^ - \[R=404,L\]/)
  })

  it('استثناءُ assets يسبق القاعدة الشاملة — الترتيبُ في mod_rewrite يحسم', () => {
    const assetsIdx = HTACCESS.indexOf('RewriteCond %{REQUEST_URI} ^/assets/')
    const catchAllIdx = HTACCESS.indexOf('RewriteRule ^ index.html [L]')
    expect(assetsIdx).toBeGreaterThan(-1)
    expect(catchAllIdx).toBeGreaterThan(assetsIdx)
  })

  it('القاعدة الشاملة موجودة — بدونها تسقط كل صفحة عميقة', () => {
    expect(HTACCESS).toMatch(/RewriteRule \^ index\.html \[L\]/)
  })
})
