/* الترويساتُ تُحرَس في الملفّ الذي **يخدم**، لا في الذي كان يخدم.

   ─────────── كيف وقع العطب ───────────

   ترويساتُ الأمان كانت في `public/.htaccess` — وهو ملفُّ **Apache**. ثمّ
   انتقلت المنصّةُ إلى خادم Hetzner خلف **Caddy**، و**Caddy لا يقرأ
   `.htaccess` إطلاقا**. فصار ما يخدم الزائرَ هو `deploy/Caddyfile` وحدَه،
   وبقي الحارسُ (`htaccess-spa-rewrite.test.ts`) يفحص ملفّا لا يُقرأ.

   ولم يكن ذلك نظريّا: `worker-src 'self'` كانت في `.htaccess` **ولم تكن في
   `Caddyfile`**. وهي ليست زينة — تعليقُها يقول إنّها عولجت مرّةً (طلبُ
   السحب ١٢) لأنّ تركَها يجعل سفاري يرتدّ في سلسلة
   `worker-src ← child-src ← script-src` ومعالجتُها معروفةٌ بثقوبها عنده،
   فيُرفض عاملُ الخدمة (`public/sw.js`) بلا سببٍ ظاهر. أي أنّ عطبا عولج
   وعاد حيّا على المضيف الجديد، بلا أن يحمرّ شيء.

   ─────────── فما يُحرَس هنا ───────────

   أنّ **كلَّ توجيهٍ في سياسة المحتوى المكتوبةِ في `.htaccess` موجودٌ في
   `Caddyfile`**. والاتّجاهُ مقصودٌ في جهةٍ واحدة: لـCaddy أن يزيد (HSTS،
   وإخفاءُ ترويسة الخادم — وكلاهما فيه فعلا)، وليس له أن ينقص. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const HTACCESS = read('public/.htaccess')
const CADDY = read('deploy/Caddyfile')

/** توجيهاتُ سياسة المحتوى من نصٍّ يحتويها — بأسمائها ومصادرها */
function cspDirectives(text: string): Map<string, string> {
  const m = /Content-Security-Policy\s+"([^"]+)"/.exec(text)
  if (!m) return new Map()
  const out = new Map<string, string>()
  for (const part of m[1].split(';')) {
    const t = part.trim()
    if (!t) continue
    const sp = t.indexOf(' ')
    out.set(sp === -1 ? t : t.slice(0, sp), sp === -1 ? '' : t.slice(sp + 1).trim())
  }
  return out
}

describe('الملفُّ الذي يخدم هو الذي يُحرَس', () => {
  it('كلاهما يعلن سياسةَ محتوى — وإلّا فالمقارنةُ تقارن فراغا', () => {
    /* حارسٌ للحارس: لو انكسر الالتقاطُ لعادت خريطتان فارغتان، فمرّ كلُّ ما
       بعده وهو لا يفحص شيئا. */
    expect(cspDirectives(HTACCESS).size, 'لم تُلتقط سياسةُ .htaccess').toBeGreaterThan(5)
    expect(cspDirectives(CADDY).size, 'لم تُلتقط سياسةُ Caddyfile').toBeGreaterThan(5)
  })

  it('ولا توجيهَ في .htaccess يغيب عن Caddyfile — وقد غاب `worker-src` فعلا', () => {
    const apache = cspDirectives(HTACCESS)
    const caddy = cspDirectives(CADDY)
    const missing = [...apache.keys()].filter((d) => !caddy.has(d))
    expect(missing, `توجيهاتٌ تخدم على Apache ولا تخدم على Caddy:\n${missing.join('\n')}`).toEqual([])
  })

  it('ومصادرُ كلِّ توجيهٍ هي هي — لا سياسةٌ أرخى على المضيف الحيّ', () => {
    const apache = cspDirectives(HTACCESS)
    const caddy = cspDirectives(CADDY)
    const looser: string[] = []
    for (const [name, sources] of apache) {
      const there = caddy.get(name)
      if (there === undefined) continue
      for (const src of sources.split(/\s+/).filter(Boolean)) {
        if (!there.includes(src)) looser.push(`${name}: «${src}» في Apache وليست في Caddy`)
      }
    }
    expect(looser, looser.join('\n')).toEqual([])
  })

  it('و`worker-src` بعينها — لأنّها عولجت مرّةً ثمّ عادت', () => {
    expect(cspDirectives(CADDY).get('worker-src'), 'عاملُ الخدمة يُرفض على سفاري').toBe("'self'")
  })

  it('ولـCaddy أن يزيد: نقلٌ آمنٌ إلزاميّ، واسمُ الخادم مكتوم', () => {
    expect(CADDY).toContain('Strict-Transport-Security')
    expect(CADDY).toContain('-Server')
  })
})
