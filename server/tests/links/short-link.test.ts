/* الرابطُ القصير في القاعدة — يُسَكّ ويُحَلّ ولا يُخرِج أحدا (ط-٣).

   ═══ ولمَ حارسٌ على القاعدة وقد حُرست القاعدةُ في `src/tests` ═══

   ذاك يقرأ **النصّ**: أنّ الشرطَ مكتوبٌ وأنّ الشاشةَ تناديه. وهذا يقرأ ما
   **يقع فعلا**: أنّ صفّا بوجهةٍ خارجيّة لا يدخل الجدولَ أصلا، وأنّ صفّا
   دخل بيدٍ من قبلُ — أو عُدِّل في القاعدة مباشرةً — لا يُحوَّل إليه عند
   القراءة. والتحويلُ المفتوحُ عطبٌ يُكتب مرّةً ويبقى يعمل سنة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { ShortLinkService } from '../../services/short-link.service'

let prisma: PrismaClient
let links: ShortLinkService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  links = new ShortLinkService(prisma)
}, 240_000)

describe('الرابطُ القصير', () => {
  it('يُسَكّ ويُحَلّ — ويُسجَّل من سكَّه', async () => {
    const minted = await links.mint('/student/learning', null, 'اختبار')
    expect(minted.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(minted.path).toBe(`/s/${minted.code}`)
    expect(minted.url.endsWith(minted.path), 'العنوانُ الكاملُ لا ينتهي بمسار الرابط').toBe(true)

    expect(await links.resolve(minted.code)).toEqual({ target: '/student/learning' })

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'short_link.create', entityId: minted.code },
    })
    expect(audit, 'سُكَّ رابطٌ ولم يُسجَّل في الأثر').not.toBeNull()
  })

  it('ولا يُسَكّ إلى خارج الدار — والتحويلُ المفتوحُ يُردّ عند الكتابة', async () => {
    for (const bad of ['https://evil.example/login', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'student/learning']) {
      await expect(
        links.mint(bad, null),
        `قُبل سكُّ رابطٍ إلى وجهةٍ خارجيّة: ${bad}`,
      ).rejects.toMatchObject({ code: 'bad_target' })
    }
    expect(await prisma.shortLink.count({ where: { target: { contains: 'evil' } } })).toBe(0)
  })

  it('وصفٌّ عُدِّل في القاعدة بيدٍ لا يُحوَّل إليه — الشرطُ يُقرأ عند الخروج أيضا', async () => {
    const minted = await links.mint('/student/billing', null)
    /* يُحاكى ما لا يمرّ من الباب: صفٌّ كُتب قبل أن يُحرَس، أو بيدٍ في القاعدة */
    await prisma.shortLink.update({ where: { code: minted.code }, data: { target: 'https://evil.example' } })
    await expect(links.resolve(minted.code)).rejects.toMatchObject({ status: 404 })
  })

  it('والمبطَلُ والمجهولُ يُردّان بالجواب نفسِه — فلا يُعرَف أيُّهما كان', async () => {
    const minted = await links.mint('/', null)
    await links.revoke(minted.code, null)

    const revoked = await links.resolve(minted.code).catch((e: { status: number; message: string }) => e)
    const unknown = await links.resolve('ZZZZZZ').catch((e: { status: number; message: string }) => e)
    expect(revoked).toMatchObject({ status: 404 })
    expect(unknown).toMatchObject({ status: 404 })
    expect(
      (revoked as { message: string }).message,
      'جوابان مختلفان يقولان لمن يجرّب الرموزَ أيُّها كان موجودا',
    ).toBe((unknown as { message: string }).message)

    /* ولا يُحذف صفُّه: رابطٌ طُبع لا يُستعاد، ومحوُه يجعله «غيرَ موجود» لا «مسحوبا» */
    const row = await prisma.shortLink.findUnique({ where: { code: minted.code } })
    expect(row, 'مُحي صفُّ الرابط بدل أن يُبطَل').not.toBeNull()
    expect(row!.revokedAt).not.toBeNull()
  })

  it('ورمزان لا يتطابقان', async () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i += 1) codes.add((await links.mint('/', null)).code)
    expect(codes.size, 'تكرّر رمزٌ في عشرين سكّة').toBe(20)
  })
})
