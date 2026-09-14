/* سياسةُ الأمان تسمح بما تحتاجه شيفرتُنا لفكّ الصور — وقد منعت ما احتاجته.

   ═══ العطبُ الذي كُتب له، وقد وقع في الإنتاج ═══

   `prepare-image.ts` كان يفكّ الصورةَ بـ`URL.createObjectURL(file)`، ثمّ
   يسندها إلى `<img>`. و`deploy/Caddyfile` يقول `img-src 'self' data:` —
   **بلا `blob:`**. فمنع المتصفّحُ الرابطَ، وأطلق `onerror`.

   ورسالتُنا عند `onerror` كانت: «تعذّرت قراءةُ الصورة — قد يكون الملفُّ
   تالفا». فرفع صاحبُ المنصّة صورةً سليمةً وقيل له إنّها تالفة. والعطبُ
   مضاعَف: منعٌ لم نقرأ سياستَه، ورسالةٌ تتّهم صاحبَها بما ليس فيه.

   ولم يظهر في تطويرٍ ولا اختبار: خادمُ Vite لا يرسل هذه الترويسة أصلا، وهي
   تسكن `Caddyfile` — أي أنّ الفرقَ بين البيئتَين هو الذي أخفاه.

   ═══ وما يُحرَس ═══

   صار الفكُّ `createImageBitmap` (بلا رابطٍ أصلا، فلا تمسّه السياسة)،
   وتراجعُه `data:` — وهي **مسموحةٌ اليوم**. فهذا الحارسُ يثبّت ذلك السماح:
   من ضيّق السياسةَ يوما فنزع `data:` كسر التراجعَ صامتا، ولا يظهر إلّا على
   متصفّحٍ قديمٍ عند مستخدمٍ بعيد.

   ولا يحرس هذا `blob:` ولا يطلبها: الاستغناءُ عنها قرارٌ — ألّا تُوسَّع
   سياسةُ الموقع كلِّه لأجل شاشةٍ واحدة.

   ═══ وكيف رُئي ساقطا ═══

   نُزعت `data:` من `img-src` في `Caddyfile` فسقط، ثمّ أُعيدت. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const caddyfile = readFileSync(join(__dirname, '..', '..', '..', 'deploy', 'Caddyfile'), 'utf8')

/** يستخرج توجيهةً من سياسة الأمان — بنيةً لا بحثا عن نصّ */
function cspDirective(name: string): string[] {
  const header = caddyfile.match(/Content-Security-Policy\s+"([^"]+)"/)
  if (!header) throw new Error('لا سياسةَ أمانٍ في Caddyfile أصلا')
  for (const part of header[1].split(';')) {
    const tokens = part.trim().split(/\s+/)
    if (tokens[0] === name) return tokens.slice(1)
  }
  return []
}

describe('سياسةُ الأمان وفكُّ الصور يتّفقان', () => {
  it('السياسةُ موجودةٌ وفيها `img-src` — وإلّا فالحارسُ يقيس فراغا', () => {
    expect(cspDirective('img-src').length).toBeGreaterThan(0)
  })

  it('و`data:` مسموحةٌ — عليها يقوم تراجعُ الفكّ في المتصفّحات القديمة', () => {
    expect(
      cspDirective('img-src'),
      'نُزعت `data:` من img-src: تراجعُ `prepare-image.ts` يُمنع، فتُردّ صورةٌ سليمةٌ '
      + 'برسالةٍ تتّهم الملفَّ — وهو العطبُ الذي وقع بعينه مع `blob:`.',
    ).toContain('data:')
  })

  it('والصورُ من أصلنا مسموحةٌ — عليها تُعرض الصورةُ بعد رفعها', () => {
    expect(cspDirective('img-src')).toContain("'self'")
  })
})
