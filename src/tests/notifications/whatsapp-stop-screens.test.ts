/* من ردّ «توقف» على واتساب — في شاشتين (١١ نوفمبر ٢٠٢٦). والعلّةُ في `server/services/whatsapp-optout.service.ts`.

   ① **قائمةُ من عبّأ**: من سُجّل لا زرَّ واتساب له، ويُقال ذلك ويُرجَع عنه؛ ومن لم يُسجَّل بجانب زرّه «قال توقف».
   ② **حالةُ المستشار**: يُقال بجانب رقمه، ويسجّله المستشارُ أو يرجع عنه.
   ونصوصُهما بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { WA_STOP_AR, WA_STOPPED_AR } from '@/pages/admin/GrantRegistrants'
import { WA_STOP_CASE_AR, WA_STOPPED_CASE_AR } from '@/pages/advisor/Cases'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const REG = code('src/pages/admin/GrantRegistrants.tsx')
const CASES = code('src/pages/advisor/Cases.tsx')

describe('من رد «توقف» على واتساب', () => {
  it('⚠️ قائمة من عبأ: لا زر واتساب لمن سجل — ويرجع عنه، وبجانب الزر «قال توقف»', () => {
    expect(REG, 'زر واتساب يظهر لمن قال توقف').toMatch(/\{r\.waStopped \? \(\s*<>\s*<span[^>]*>\{WA_STOPPED_AR\}<\/span>[\s\S]*?\) : wa && \(/)
    expect(REG).toMatch(/onClick=\{\(\) => void setWa\(r, true\)\}[^>]*>\s*\{WA_STOP_AR\}/)
    expect(REG).toMatch(/onClick=\{\(\) => void setWa\(r, false\)\}[^>]*>\s*تراجع/)
    expect(REG).toMatch(/apiPut\(`\/api\/admin\/member-grant\/registrants\/\$\{r\.id\}\/whatsapp`, \{ stopped \}\)/)
  })

  it('⚠️ حالة المستشار: بجانب رقمه، ويسجله أو يرجع عنه', () => {
    expect(CASES).toMatch(/detail\.whatsappStopped \? \(/)
    expect(CASES).toMatch(/apiPost\(`\/api\/advisor\/cases\/\$\{detail\.id\}\/whatsapp`, \{ stopped: true \}\)/)
    expect(CASES).toMatch(/apiPost\(`\/api\/advisor\/cases\/\$\{detail\.id\}\/whatsapp`, \{ stopped: false \}\)/)
  })

  it('نصوصها بلا تشكيل', () => {
    for (const t of [WA_STOP_AR, WA_STOPPED_AR, WA_STOP_CASE_AR, WA_STOPPED_CASE_AR, 'تراجع']) expect(plainAr(t), t).toBe(t)
  })
})
