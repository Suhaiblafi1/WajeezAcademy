/* تجديد معاينة روابطه من لوحته (٢٧ أكتوبر ٢٠٢٦): لا يطلب عدة المشاركة إلا ولمعاينته شعبة ترسم.
   والعلة في `refreshMyLinkPreviews` (`src/components/trainer/link-preview.ts`): `share-kit` ينشئ كود الخصم أول مرة يطلب،
   فكانت اللوحة تسك كودا وأثره لكل مدرب يفتحها ولو لم تكن له شعبة. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
const replies: Record<string, unknown> = {}
vi.mock('@/services/api', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push(path); return replies[path] }),
  apiUpload: vi.fn(async () => undefined),
}))

/* لا DOM في هذه البيئة — والدالة لا تقرأ من المتصفح إلا تخزين الجلسة */
const store = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  clear: () => store.clear(),
})

describe('تجديد المعاينة من لوحته', () => {
  beforeEach(() => { calls.length = 0; store.clear() })

  it('⚠️ بلا شعبة: لا تطلب العدة فلا يسك كود', async () => {
    replies['/api/trainer/me/referral-links'] = []
    const { refreshMyLinkPreviews } = await import('@/components/trainer/link-preview')
    await refreshMyLinkPreviews()
    expect(calls).toEqual(['/api/trainer/me/referral-links'])
  })

  it('ومع شعبة تطلبها — ومرة في الجلسة', async () => {
    replies['/api/trainer/me/referral-links'] = [{ cohortId: 'c1', courseTitle: 'أ', startsAt: null }]
    replies['/api/trainer/me/share-kit'] = {
      name: 'ص', headline: null, photoUrl: null, code: 'WJ30-A', percentOff: 30, hisCodes: [],
      short: { wide: null, cohorts: {} }, previews: {},
    }
    const { refreshMyLinkPreviews } = await import('@/components/trainer/link-preview')
    await refreshMyLinkPreviews()
    expect(calls).toEqual(['/api/trainer/me/referral-links', '/api/trainer/me/share-kit'])
    await refreshMyLinkPreviews()
    expect(calls.length, 'جددت مرتين في الجلسة').toBe(2)
  })
})
