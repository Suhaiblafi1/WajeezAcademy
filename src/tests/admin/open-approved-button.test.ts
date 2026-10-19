/* ═══ «افتح المعتمدة كلها» في لسان «معتمدة — تنتظر فتحك» (١٩ أكتوبر ٢٠٢٦) ═══
 *
 * «أريد أن أفتح الشعبَ التي لها مدرّبٌ واعتُمدت موادُّها — كلَّها مرّةً واحدة، عدا ما تمّ نقلُه» (صاحب المنصّة).
 * الزرُّ في لسان المعتمدة وحدَه، ويعاين قبل أن ينفّذ: الطلبُ الأوّلُ قراءةٌ، والكتابةُ بـ«نفّذ» وحدَه.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PAGE = readFileSync(resolve(__dirname, '../../pages/admin/AdminCohorts.tsx'), 'utf8')
const BTN = readFileSync(resolve(__dirname, '../../components/admin/OpenApproved.tsx'), 'utf8')

describe('افتح المعتمدة كلها', () => {
  it('في لسان المعتمدة وحده', () => {
    expect(PAGE).toMatch(/list === "approved" && <OpenApproved onDone=/)
  })

  it('يعاين بقراءة، ولا يكتب إلا بـ«نفّذ»', () => {
    const load = BTN.slice(BTN.indexOf('const load'), BTN.indexOf('const apply'))
    const apply = BTN.slice(BTN.indexOf('const apply'), BTN.indexOf('const ready'))
    expect(load).toMatch(/apiGet<Preview>\("\/api\/admin\/cohorts\/open-approved"\)/)
    expect(load).not.toMatch(/apiPost/)
    expect(apply).toMatch(/apiPost<Result>\("\/api\/admin\/cohorts\/open-approved"\)/)
    const confirm = BTN.slice(BTN.lastIndexOf('<Button', BTN.indexOf('>نفّذ<')), BTN.indexOf('>نفّذ<'))
    expect(confirm).toMatch(/onClick=\{\(\) => void apply\(\)\}/)
  })

  it('ويسمي ما نقل فيبقى', () => {
    expect(BTN).toMatch(/p\.moved\.map/)
  })
})
