/* العودةُ بعد الدخول إلى ما فُتح قبله — والعلّةُ في رأس `application/links/return-to.ts` */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authPathFor, returnTargetOf } from '@/application/links/return-to'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const GUARD = code('src/components/RequireRole.tsx')
const AUTH = code('src/pages/Auth.tsx')

describe('العودة بعد الدخول', () => {
  it('⚠️ الطريق يحمل ما فتحه، والصفحة تقرؤه كما كان — بمساره واستعلامه وموضعه', () => {
    const target = '/admin/member-grant?q=WG-ABCD2345#grant-registrants'
    const path = authPathFor(target)
    expect(path.startsWith('/auth?next=')).toBe(true)
    expect(returnTargetOf(path.slice('/auth'.length))).toBe(target)
  })

  it('⚠️ لا تحويل إلى خارج الموقع ولا حلقة', () => {
    for (const bad of ['https://evil.test/x', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/auth', '/auth?next=/x', '/']) {
      expect(returnTargetOf(`?next=${encodeURIComponent(bad)}`), bad).toBeNull()
      expect(authPathFor(bad), bad).toBe('/auth')
    }
    expect(returnTargetOf('')).toBeNull()
  })

  it('⚠️ الحارس يرسل ما فُتح، وصفحة الدخول تعود إليه قبل بوابة الدور', () => {
    expect(GUARD).toMatch(/if \(state === 'anon'\) return <Navigate to=\{authPathFor\(`\$\{location\.pathname\}\$\{location\.search\}\$\{location\.hash\}`\)\} replace \/>/)
    expect(AUTH).toMatch(/const back = returnTargetOf\(useLocation\(\)\.search\)/)
    expect(AUTH).toMatch(/<AuthGate onDone=\{\(\) => navigate\(back \?\? homePathForRoles\(readRoles\(\)\)\)\} \/>/)
  })
})
