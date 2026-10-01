/* زرُّ «حدِّثْ نصَّ العروض المفتوحة» صامتٌ ما لم يُطلَب البريد.
 *
 * أمرُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): «I want to refresh them silently».
 * والخادمُ يُبلِغ افتراضا (`notify` غائبةً تعني نعم) — فالصمتُ يقع بما ترسله
 * الشاشة. فيُقاس الطرفان: الخانةُ تبدأ غيرَ مؤشَّرة، والنداءُ يحمل قيمتَها.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCREEN = readFileSync(join(root, 'src/pages/admin/TrainerContracts.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('تحديثُ العروض المفتوحة صامتٌ افتراضا', () => {
  it('الخانةُ تبدأ غيرَ مؤشَّرة', () => {
    expect(SCREEN).toMatch(/\[refreshNotify,\s*setRefreshNotify\]\s*=\s*useState\(false\)/)
  })

  it('والنداءُ يحمل قيمتَها — وإلّا أبلغ الخادمُ افتراضا', () => {
    const at = SCREEN.indexOf('"/api/admin/trainer-contracts/refresh-bodies"')
    expect(at, 'لم يُقرأ نداءُ التحديث').toBeGreaterThan(0)
    expect(SCREEN.slice(at, at + 120)).toMatch(/\{\s*notify:\s*refreshNotify\s*\}/)
  })
})
