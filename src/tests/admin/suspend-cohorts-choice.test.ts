/* نافذةُ إيقاف المدرّب تسأل عن شعبه التي لم تبدأ (٢٤ أكتوبر ٢٠٢٦).
   «لقد قمت بإيقاف المدرّب.. لماذا ما زالت شعبتُه ظاهرةً لدينا؟» — واختار صاحبُ المنصّة أن يُختار لكلّ شعبةٍ في
   النافذة: تُلغى أو تبقى لبديل، والافتراضُ «تبقى». والأثرُ يحرسه `server/tests/trainer/suspend-cohorts.test.ts`.
   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('نافذة الإيقاف', () => {
  const ops = code('src/pages/admin/TrainerRunOps.tsx')
  const box = code('src/components/admin/SuspendCohortsChoice.tsx')

  it('⚠️ تعرض شعبه وترسل ما اختير إلغاؤه وحده — ويبدأ الاختيار فارغا مع كل نافذة', () => {
    expect(ops).toContain('<SuspendCohortsChoice profileId={suspendTarget.profileId} cancelIds={suspendCancel} onChange={setSuspendCancel} />')
    expect(ops).toContain('note: reason?.trim() || undefined, cancelCohortIds: [...suspendCancel],')
    expect(ops).toContain('onClick={() => { setSuspendCancel(new Set()); setSuspendTarget(t); }}')
  })

  it('⚠️ خياران لكل شعبة، و«أبقها» هو ما لم يختر غيره', () => {
    expect(box).toMatch(/checked=\{!cancelIds\.has\(c\.id\)\} onChange=\{\(\) => set\(c\.id, false\)\} \/>\s*أبقها لمدرب بديل/)
    expect(box).toMatch(/checked=\{cancelIds\.has\(c\.id\)\} onChange=\{\(\) => set\(c\.id, true\)\} \/>\s*ألغها/)
  })

  it('⚠️ ولا تقول ما لا يقع — كانت «وتلغى جلساته القادمة»', () => {
    expect(ops).not.toContain('وتلغى جلساته القادمة')
  })

  it('⚠️ وما أبقي يرى في «تبدأ قريبا» بشارته', () => {
    expect(code('src/components/admin/UpcomingCohorts.tsx')).toContain('{r.trainerSuspended && <Chip tone="danger">مدربها موقوف — أسند بديلا أو ألغها</Chip>}')
  })
})
