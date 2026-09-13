/* حالُ رابط السجلّ — أربعُ حالاتٍ وترتيبٌ بينها.

   والحالةُ كانت شرطا في JSX لا يُفحص إلّا بمطابقة نصِّ ملفّ. وأُخرجت لتُنادى
   بحالاتها، فالترتيبُ بينها هو ما يخطئ فيه القارئ: رابطٌ أُلغي وأجلُه باقٍ،
   ورابطٌ أُلغي بعد أن انتهى أجلُه. */

import { describe, expect, it } from 'vitest'
import { dossierLinkState } from '@/application/trainer/dossier-link-state'

const NOW = new Date('2026-09-13T12:00:00Z').getTime()
const future = '2026-10-13T12:00:00Z'
const past = '2026-09-01T12:00:00Z'

describe('حالُ رابط السجلّ', () => {
  it('لم يُفتح بعد — أجلُه باقٍ ولا فتحةَ له', () => {
    const s = dossierLinkState({ expiresAt: future, revokedAt: null, firstOpenedAt: null, lastOpenedAt: null }, NOW)
    expect(s).toEqual({ textAr: 'لم يُفتح بعد', spent: false })
  })

  it('وفُتح — يُقال متى آخرَ مرّة', () => {
    const s = dossierLinkState({
      expiresAt: future, revokedAt: null,
      firstOpenedAt: '2026-09-10T09:00:00Z', lastOpenedAt: '2026-09-12T09:00:00Z',
    }, NOW)
    expect(s.spent).toBe(false)
    expect(s.textAr).toContain('فُتح آخرَ مرّة')
  })

  it('وانتهى أجلُه — فلا يُفتح ولا يُلغى', () => {
    const s = dossierLinkState({ expiresAt: past, revokedAt: null, firstOpenedAt: null, lastOpenedAt: null }, NOW)
    expect(s).toEqual({ textAr: 'انتهى أجلُه', spent: true })
  })

  it('⚠️ والإلغاءُ يسبق الأجلَ — ومن أُلغي رابطُه لا يُقال «انتهى أجلُه»', () => {
    /* الترتيبُ ليس تجميليّا: «انتهى أجلُه» تُقرأ حادثةً وقعت بنفسها، و«أُلغي»
       تُقرأ فعلَ إنسانٍ قصده. ومن ألغى رابطا ثمّ رآه «منتهيا» ظنّ أنّ إلغاءه
       لم يقع. */
    const revokedWhileValid = dossierLinkState(
      { expiresAt: future, revokedAt: '2026-09-11T09:00:00Z', firstOpenedAt: null, lastOpenedAt: null }, NOW)
    expect(revokedWhileValid.textAr).toBe('أُلغي')

    const revokedAfterExpiry = dossierLinkState(
      { expiresAt: past, revokedAt: '2026-09-11T09:00:00Z', firstOpenedAt: null, lastOpenedAt: null }, NOW)
    expect(revokedAfterExpiry.textAr, 'غلب الأجلُ الإلغاءَ — فضاع أنّ إنسانا ألغاه').toBe('أُلغي')
  })

  it('والملغى والمنتهي كلاهما منقضٍ — فلا يُعرض لهما زرُّ إلغاء', () => {
    for (const row of [
      { expiresAt: past, revokedAt: null, firstOpenedAt: null, lastOpenedAt: null },
      { expiresAt: future, revokedAt: '2026-09-11T09:00:00Z', firstOpenedAt: null, lastOpenedAt: null },
    ]) {
      expect(dossierLinkState(row, NOW).spent).toBe(true)
    }
  })
})
