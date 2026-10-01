/* ما يرسله مركِّبُ العقد يعرفه مخطّطُ المسار — وإلّا أُسقط بلا خطأ.
 *
 * ═══ العطبُ الذي وُجد (١ أكتوبر ٢٠٢٦) ═══
 *
 * المركِّبُ في `TrainerContracts.tsx` يرسل اسمَ الطرف الثاني وتاريخَ جلسة
 * التهيئة ورابطَها، والخدمةُ تقرؤها وتُثبّتها — ومخطّطُ المسار (`composeBody`
 * في `admin-trainer.routes.ts`) لم يكن يعرفها. و`z.object` يُسقط ما لا يعرفه
 * **بلا خطأ**: فكان الاسمُ المكتوبُ لا يصل، والجلسةُ لا تُطبَع، ولا شيءَ يقول.
 * وكلُّ اختبارٍ كان ينادي الخدمةَ مباشرةً فلا يمرّ بالمسار.
 *
 * ويُقاس **بالبنية**: مفاتيحُ الكائن الذي تبنيه الشاشة، ومفاتيحُ مخطّط المسار —
 * والأولى بعضُ الثانية. فخانةٌ تُضاف إلى الشاشة وتُنسى في المسار تُسقط هذا.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/** مفاتيحُ الكائن الذي يُعيده `composeBody` في الشاشة */
function screenKeys(): string[] {
  const src = bare('src/pages/admin/TrainerContracts.tsx')
  const at = src.indexOf('const composeBody = useMemo(')
  if (at < 0) return []
  const ret = src.indexOf('    return {\n', at)
  const end = src.indexOf('\n    };', ret)
  if (ret < 0 || end < 0) return []
  return [...src.slice(ret, end).matchAll(/^ {6}(\w+)[,:]/gm)].map((m) => m[1])
}

/** مفاتيحُ `composeBody` في مخطّط المسار — المستوى الأوّل وحدَه */
function routeKeys(): string[] {
  const src = bare('server/http/routes/admin-trainer.routes.ts')
  const at = src.indexOf('const composeBody = z.object({')
  if (at < 0) return []
  const end = src.indexOf('\n  })\n', at)
  /* والقيمةُ قد تكون مخطّطا مسمًّى (`requiredDocuments: requiredDocumentsSchema`)
     لا `z.` مباشرة — فيُقرأ المفتاحُ بعمقه وحدَه: أربعةُ فراغاتٍ هي المستوى الأوّل،
     وما تحت `compensation` أعمقُ فلا يُقرأ. */
  return [...src.slice(at, end).matchAll(/^ {4}(\w+):/gm)].map((m) => m[1])
}

describe('ما يرسله المركِّبُ يصل الخادم', () => {
  const sent = screenKeys()
  const known = routeKeys()

  it('القائمتان مقروءتان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(sent.length, 'لم تُقرأ مفاتيحُ الشاشة').toBeGreaterThan(5)
    expect(known.length, 'لم تُقرأ مفاتيحُ المسار').toBeGreaterThan(5)
    expect(sent, 'المقروءُ من الشاشة ليس كائنَ التركيب').toContain('title')
  })

  it('كلُّ خانةٍ ترسلها الشاشةُ يعرفها المسار — فلا يُسقَط شيءٌ صامتا', () => {
    const dropped = sent.filter((k) => !known.includes(k))
    expect(dropped, `يُسقطها المسارُ بلا خطأ — أضِفها إلى composeBody: ${dropped.join('، ')}`).toEqual([])
  })
})
