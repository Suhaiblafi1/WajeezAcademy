/* رابطُ مسارٍ باسمه يصل إلى مكانٍ قائم (ن-١١).

   ═══ ما كان ═══

   `TrainerPath.slug` يُشتقّ مرّةً ويبقى — ومكتوبٌ في المخطّط أنّه «عنوانُه
   العامّ» — ثمّ يخرج في ثلاثة ردود **ولا عنوانَ في المنصّة يحلّه**. حقلٌ
   يَعِد بشيءٍ لا يملكه أحد.

   ═══ وما يُحرَس هنا ═══

   ① **العنوانُ مسجَّل** — وإلى الصفحة التي تحوّل، لا إلى أخرى.
   ② **والوجهةُ قائمة** — `/t/:slug` مسجَّلٌ هو أيضا، فالتحويلُ لا يقع في
      فراغ.
   ③ **والمرساةُ مالكُها واحد** — من يكتبها ومن يقصدها يناديان الدالّةَ
      نفسَها. فلو تُركت نصّا في الموضعَين لَجاز أن يُغيَّر أحدُهما وحدَه،
      فينزل الزائرُ في رأس صفحةٍ طويلةٍ بلا ما جاء له، ولا شيءَ يحمرّ.
   ④ **والتحويلُ يستبدل ولا يكدّس** — وإلّا حبس زرُّ الرجوع الزائرَ في
      حلقة.

   والفحصُ على البنية: الطريقُ في `App.tsx` يُقرأ باسم مكوّنه ثمّ يُتبَع إلى
   الملفّ الذي يستورده — لا بورودِ نصٍّ في سطر. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathAnchorId } from '@/application/trainer/public-slug'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const APP = read('src/App.tsx')

/** الملفُّ الذي يقف خلف طريقٍ مسجَّل — لا اسمُ المكوّن وحدَه */
function pageBehind(routePath: string): string | null {
  const route = new RegExp(`path="${routePath.replace(/[/:]/g, (c) => `\\${c}`)}"\\s+element=\\{<(\\w+)\\s*/>\\}`)
  const hit = APP.match(route)
  if (!hit) return null
  const lazyDecl = new RegExp(`const ${hit[1]} = lazy\\(\\(\\) => import\\('([^']+)'\\)\\)`)
  return APP.match(lazyDecl)?.[1] ?? null
}

describe('رابطُ المسار باسمه', () => {
  it('‏/path/:slug مسجَّلٌ ويقف خلفه المحوِّل', () => {
    expect(pageBehind('/path/:slug')).toBe('./pages/PathRedirect')
  })

  it('ووجهتُه — صفحةُ المدرّب — مسجَّلةٌ هي أيضا', () => {
    expect(pageBehind('/t/:slug')).toBe('./pages/TrainerPublic')
  })

  it('المرساةُ تُنادى من مالكها في الموضعَين', () => {
    const renderer = read('src/pages/TrainerPublic.tsx')
    const redirector = read('src/pages/PathRedirect.tsx')
    for (const [name, src] of [['العارض', renderer], ['المحوِّل', redirector]] as const) {
      expect(src, `${name} لا ينادي pathAnchorId`).toMatch(/pathAnchorId\(/)
      expect(src, `${name} يكتب المرساةَ نصّا بيده`).not.toMatch(/`?#?path-\$\{/)
    }
    /* والدالّةُ نفسُها تُنتج ما يقابل ما يكتبه العارضُ في `id` */
    expect(pathAnchorId('abu-bakr-data')).toBe('path-abu-bakr-data')
  })

  it('والتحويلُ يستبدل العنوانَ ولا يكدّسه', () => {
    expect(read('src/pages/PathRedirect.tsx')).toMatch(/<Navigate\s+replace\s+to=/)
  })
})
