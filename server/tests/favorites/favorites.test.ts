/* مفضّلةٌ تخصّ صاحبَها، وتنتقل من متصفّحه إلى حسابه (ع-٨).

   ═══ ما يُحرَس، ولمَ ═══

   ① **لا تُخلط مفضّلةٌ بمفضّلة.** الجدولُ يحمل الناسَ كلَّهم في صفوفٍ
      متجاورة، وترشيحٌ ناقصٌ يُري إنسانا ما حفظه غيرُه.
   ② **والقلبُ يُنقر مرارا** — نقرتان لا تصنعان صفّين، وإزالةُ ما ليس
      محفوظا ليست خطأً.
   ③ **وما كان في المتصفّح لا يضيع.** المفضّلةُ كانت `localStorage`، ومن
      حفظ فيها أمس يجب أن يجدها اليوم في حسابه. والرفعُ يُعاد فلا يضاعِف. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { FavoritesService } from '../../services/favorites.service'

let prisma: PrismaClient
let favorites: FavoritesService
let meId: string
let otherId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  favorites = new FavoritesService(prisma)
  const auth = new AuthService(prisma)
  const me = await auth.register('fav-me@test.local', 'Learner#12345', 'صاحبُ المفضّلة')
  const other = await auth.register('fav-other@test.local', 'Learner#12345', 'متعلّمٌ آخر')
  meId = me.userId
  otherId = other.userId
}, 180_000)

describe('ع-٨ · المفضّلة', () => {
  it('يُحفظ المسارُ والدورةُ كلاهما — وكانت المساراتِ وحدَها', async () => {
    await favorites.add(meId, 'pathway', 'P-DEMO-1')
    await favorites.add(meId, 'course', 'C-DEMO-1')
    const mine = await favorites.mine(meId)
    expect(mine.map((r) => `${r.kind}:${r.refId}`).sort())
      .toEqual(['course:C-DEMO-1', 'pathway:P-DEMO-1'])
  })

  it('① ولا يرى مفضّلةَ غيره', async () => {
    await favorites.add(otherId, 'pathway', 'P-HIS-ONLY')
    const mine = await favorites.mine(meId)
    expect(mine.map((r) => r.refId), 'صفٌّ لغيره ظهر في مفضّلته').not.toContain('P-HIS-ONLY')
    const his = await favorites.mine(otherId)
    expect(his.map((r) => r.refId)).toEqual(['P-HIS-ONLY'])
  })

  it('② ونقرتان لا تصنعان صفّين', async () => {
    await favorites.add(meId, 'course', 'C-TWICE')
    await favorites.add(meId, 'course', 'C-TWICE')
    const rows = await prisma.favorite.findMany({ where: { userId: meId, refId: 'C-TWICE' } })
    expect(rows, 'صفّان لشيءٍ واحد').toHaveLength(1)
  })

  it('وإزالةُ ما ليس محفوظا ليست خطأً — القلبُ يُنقر مرّتين', async () => {
    await expect(favorites.remove(meId, 'course', 'C-NEVER-SAVED')).resolves.toMatchObject({
      saved: false,
    })
  })

  it('ويُزال ما حُفظ', async () => {
    await favorites.add(meId, 'pathway', 'P-GONE')
    await favorites.remove(meId, 'pathway', 'P-GONE')
    const mine = await favorites.mine(meId)
    expect(mine.map((r) => r.refId)).not.toContain('P-GONE')
  })

  it('③ ونوعٌ مجهولٌ يُردّ — و`kind` عمودٌ نصّيٌّ لا قيدَ فيه', async () => {
    await expect(favorites.add(meId, 'trainer', 'T-1')).rejects.toMatchObject({ status: 400 })
    const rows = await prisma.favorite.findMany({ where: { userId: meId, kind: 'trainer' } })
    expect(rows, 'نوعٌ مجهولٌ وصل القاعدة').toHaveLength(0)
  })

  it('③ وما كان في المتصفّح يُرفع مرّةً — وإعادتُه لا تضاعِف', async () => {
    const stale = [
      { kind: 'pathway', refId: 'P-FROM-BROWSER' },
      { kind: 'pathway', refId: 'P-DEMO-1' }, // محفوظٌ عنده أصلا
    ]
    const first = await favorites.merge(meId, stale)
    expect(first.merged, 'لم يُرفع ما كان في المتصفّح').toBe(1)

    const again = await favorites.merge(meId, stale)
    expect(again.merged, 'الرفعُ يضاعِف حين يُعاد').toBe(0)

    const mine = await favorites.mine(meId)
    expect(mine.filter((r) => r.refId === 'P-FROM-BROWSER'), 'صفّان لما جاء من المتصفّح')
      .toHaveLength(1)
  })

  it('والرفعُ يُسقط ما لا يصلح ولا يسقط معه ما يصلح', async () => {
    const res = await favorites.merge(meId, [
      { kind: 'trainer', refId: 'T-BAD' },
      { kind: 'course', refId: 'C-GOOD' },
    ])
    expect(res.merged, 'صفٌّ فاسدٌ أسقط الصالحَ معه').toBe(1)
    const mine = await favorites.mine(meId)
    expect(mine.map((r) => r.refId)).toContain('C-GOOD')
    expect(mine.map((r) => r.refId)).not.toContain('T-BAD')
  })
})
