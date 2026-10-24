/* «أعد فتحها» على الشعبة الملغاة (٢٤ أكتوبر ٢٠٢٦) — «ماذا لو أردت أن أتراجع عن الإلغاء؟» (صاحب المنصّة).
   والأثرُ يحرسه `server/tests/learning/cohort-reopen.test.ts`. والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('إعادة فتح الملغاة', () => {
  it('⚠️ الزر على الملغاة التي لم يمض موعدها وحدها', () => {
    expect(code('src/pages/admin/AdminCohorts.tsx')).toMatch(/\{c\.status === "cancelled" && notStartedYet\(c\.startsAt\) && \(\s*<ReopenCancelledBox/)
  })
  it('⚠️ يقول ما يقع قبل أن يضغط، ثم يعيدها', () => {
    const box = code('src/components/admin/ReopenCancelledBox.tsx')
    expect(box).toContain('<li>تعود كما كانت قبل الإلغاء، بمواعيدها ومتعلميها.</li>')
    expect(box).toContain('<li>يصل مدربها ومتعلميها أنها عادت.</li>')
    expect(box).toContain('apiPost<{ learnersTold: number }>(`/api/admin/cohorts/${cohortId}/reopen`)')
  })
})
