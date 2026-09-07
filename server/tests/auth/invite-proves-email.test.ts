/* البند ٦٧ · من فتح رابطا وصله بالبريد فقد أثبت أنّ العنوان يبلغه.
 *
 * ── لماذا لم يظهر هذا العطبُ من قبل ──
 *
 * حواجزُ الشراء والشهادة الأربعةَ مشروطةٌ بـ`emailChannelEnabled()`: تسقط
 * تلقائيّا وقناةُ البريد مغلقة («قفلٌ بلا مفتاحٍ لا يُقفل»). فبقي هذا العطبُ
 * غيرَ مرئيٍّ حتّى وُصلت القناة — واستيقظت الحواجزُ الأربعةُ دفعةً واحدة.
 *
 * وحينها صار **من دخل بدعوةٍ ممنوعا من الشراء**: أثبتَ عنوانَه بفتح رابطٍ لم
 * يصل إلّا إليه، والمنصّةُ تعدّه غيرَ موثَّق فتطلب منه أن يُثبت ما أثبته.
 *
 * وأخصُّ من يمسّه: العميلُ الذي يُدخله المستشارُ بنفسه (البند ٢٥) — يُدعى،
 * ويضع كلمتَه، ثمّ يُردّ عند أوّل شراء.
 *
 * ── وقوّةُ الدليل ──
 *
 * رمزُ الدعوة (ورمزُ الاستعادة) لا يُولَّد إلّا ليُرسَل إلى ذلك العنوان بعينه،
 * ولا يُعاد في ردّ الخادم خارج التطوير (`devToken` مشروطٌ بـNODE_ENV). فمن جاء
 * به قرأ الصندوق — وهو الدليلُ نفسُه الذي يطلبه رابطُ التوثيق لا أضعفُ منه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let auth: AuthService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 240_000)

async function invited(email: string) {
  const { userId } = await auth.register(email, 'Random#Placeholder1', 'مدعوٌّ جديد')
  await prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
  const invite = await auth.issueInvite(userId)
  return { userId, token: invite.token }
}

describe('٦٧ · الدعوةُ المفتوحةُ توثيقٌ للبريد', () => {
  it('الحالُ قبل الفتح: غيرُ موثَّق — فالتسجيلُ وحدَه لا يُثبت عنوانا', async () => {
    const { userId } = await invited('proof.before@test.local')
    const u = await prisma.user.findUnique({ where: { id: userId } })
    expect(u!.emailVerifiedAt).toBeNull()
  })

  it('ووضعُ الكلمة برمز الدعوة يوثّق البريد ويُفعّل الحساب معا', async () => {
    const { userId, token } = await invited('proof.invite@test.local')
    await auth.resetPassword(token, 'NewPass#12345')
    const u = await prisma.user.findUnique({ where: { id: userId } })
    expect(u!.status, 'لم يُفعَّل الحساب').toBe('active')
    expect(
      u!.emailVerifiedAt,
      'دخل بدعوةٍ وصلت بريدَه ثمّ يُمنع من الشراء حتّى «يوثّق» ما أثبته',
    ).not.toBeNull()
  })

  it('ورمزُ الاستعادة كذلك — دليلُه هو الدليلُ نفسُه', async () => {
    const { userId } = await auth.register('proof.reset@test.local', 'OldPass#12345', 'مستعيد')
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.emailVerifiedAt).toBeNull()
    const { tokenForDelivery } = await auth.requestPasswordReset('proof.reset@test.local')
    await auth.resetPassword(tokenForDelivery!, 'NewPass#12345')
    const u = await prisma.user.findUnique({ where: { id: userId } })
    expect(u!.emailVerifiedAt).not.toBeNull()
    /* والحسابُ النشِطُ لا يُقلَب «مدعوّا» ولا العكس — التفعيلُ للدعوة وحدَها */
    expect(u!.status).toBe('active')
  })

  it('ولا يُزاح توثيقٌ سابقٌ إلى تاريخٍ جديد — أوّلُ إثباتٍ هو الإثبات', async () => {
    const { userId, token } = await invited('proof.keep@test.local')
    const first = new Date('2026-01-01T00:00:00.000Z')
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: first } })
    await auth.resetPassword(token, 'NewPass#12345')
    const u = await prisma.user.findUnique({ where: { id: userId } })
    expect(u!.emailVerifiedAt?.toISOString()).toBe(first.toISOString())
  })
})
