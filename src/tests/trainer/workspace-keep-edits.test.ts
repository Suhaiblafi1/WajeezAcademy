/* ═══ ما في يد المدرّب لا يُمحى بلقاءٍ أو مهمّة (٢٠ أكتوبر ٢٠٢٦) — `CohortWorkspace.tsx` ═══

   إضافةُ لقاءٍ أو نقلُه أو ربطُه، وحفظُ مهمّةٍ أو حذفُها، تعيد قراءةَ الصفحة ولا تكتب في الخطّة. وكانت القراءةُ
   تضع المحفوظَ مكانَ ما في يده: من كتب وصفا ثمّ أضاف لقاءً ذهب ما كتب بلا كلمة. والنسخُ والإرسالُ يكتبان في
   الخطّة فيُقرأ بعدهما المحفوظ.

   والفحصُ على الشيفرة بلا تعليقاتها. ورُئي ساقطا: أُسقط شرطُ `keepEdits` من `load` فسقط الأوّل، وأُعيد
   `onDone={() => void load()}` فسقط الثاني. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('ما في اليد يبقى بعد لقاء أو مهمّة', () => {
  it('⚠️ القراءة لا تضع المحفوظ مكان ما في اليد حين يطلب ذلك', () => {
    expect(WS).toMatch(/const load = useCallback\(async \(first = false, keepEdits = false\)/)
    expect(WS).toMatch(/if \(!\(keepEdits && dirtyRef\.current\)\) \{\s*setContent\(nextContent\);\s*setIdentity\(nextIdentity\);[\s\S]{0,80}setBaseline\(/)
  })

  it('⚠️ واللقاءات والمهامّ تطلبه — والنسخ والإرسال لا', () => {
    expect(WS, 'لقاء يعيد الصفحة على المحفوظ').not.toContain('onDone={() => void load()}')
    expect(WS.match(/onDone=\{\(\) => void load\(false, true\)\}/g)).toHaveLength(3)
    expect(WS).toMatch(/await load\(false, keepEdits\)/)
    expect(WS).toContain('?.review, Boolean(editingId)), true);')
    expect(WS).toMatch(/: "حذفت المهمّة"\), true\);/)
    expect(WS).toMatch(/\/axes`, \{ moduleIds: \[e\.target\.value\] \}\),\s*`ربط «\$\{x\.title\}» بمحوره`,\s*true,/)
    /* والنسخُ يكتب الخطّةَ كلَّها — فيُقرأ المحفوظ */
    expect(WS).toMatch(/plan\/copy`[\s\S]{0,400}\},\s*\);\s*\}\}/)
  })
})
