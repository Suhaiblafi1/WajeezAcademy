/* الدعوةُ تصلح سبعةَ أيّام، و«مدعوّ» حالةٌ تنتهي بأوّل دخول، والأرشفةُ
   بديلٌ للحذف يحفظ السجلّ.

   الأصلُ في جولة ٢٠٢٦-٠٩ (الرحلة ٩): الدعوةُ كانت رمزَ استعادةٍ عمرُه ساعة،
   فأوّلُ محاولةِ تأهيلِ موظّفٍ تفشل غالبا ويُطلب منه أن يصنع لنفسه ما كان
   يجب أن يصله. والحذفُ النهائيُّ كان الخيارَ الوحيدَ لمن غادر. */

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

/** حسابٌ أُنشئ كما تُنشئه شاشةُ الإدارة: كلمةٌ عشوائيّةٌ وحالةُ «مدعوّ» */
async function invitedAccount(email: string) {
  const { userId } = await auth.register(email, 'Random#Placeholder1', 'موظّفٌ جديد')
  await prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
  const invite = await auth.issueInvite(userId)
  return { userId, ...invite }
}

describe('دعوةٌ تصلح سبعةَ أيّام', () => {
  it('عمرُها سبعةُ أيّامٍ لا ساعة', async () => {
    const { expiresAt } = await invitedAccount('invite.ttl@test.local')
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })

  it('ولها غرضٌ مستقلٌّ عن رمز الاستعادة — فلا يُقرأ أحدُهما مكانَ الآخر', async () => {
    const { userId } = await invitedAccount('invite.purpose@test.local')
    const rows = await prisma.passwordResetToken.findMany({ where: { userId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].purpose).toBe('invite')

    await auth.requestPasswordReset('invite.purpose@test.local')
    const purposes = (await prisma.passwordResetToken.findMany({ where: { userId } })).map((r) => r.purpose).sort()
    expect(purposes).toEqual(['invite', 'reset'])
  })

  it('وإعادةُ الإرسال تُبطل ما قبلها — رابطان صالحان لحسابٍ واحدٍ بابان لا باب', async () => {
    const { userId, token: first } = await invitedAccount('invite.resend@test.local')
    const { token: second } = await auth.issueInvite(userId)
    expect(second).not.toBe(first)

    const live = await prisma.passwordResetToken.findMany({ where: { userId, purpose: 'invite', usedAt: null } })
    expect(live, 'دعوةٌ ساريةٌ واحدةٌ لا أكثر').toHaveLength(1)

    /* والقديمُ لا يعمل بعدها */
    await expect(auth.resetPassword(first, 'NewPass#12345')).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('وحالُها يُقرأ: سارية، أو منتهية، أو لا دعوة', async () => {
    const fresh = await invitedAccount('invite.state@test.local')
    expect((await auth.inviteState(fresh.userId)).state).toBe('pending')

    /* تُقدَّم إلى الماضي كما لو مرّت ثمانيةُ أيّام */
    await prisma.passwordResetToken.updateMany({
      where: { userId: fresh.userId, purpose: 'invite' },
      data: { expiresAt: new Date(Date.now() - 86_400_000) },
    })
    expect((await auth.inviteState(fresh.userId)).state).toBe('expired')

    const plain = await auth.register('invite.none@test.local', 'Password#12345', 'بلا دعوة')
    expect((await auth.inviteState(plain.userId)).state).toBe('none')
  })
})

describe('«مدعوّ» حالةٌ تنتهي بأوّل كلمةِ مرور', () => {
  it('تعيينُ الكلمة من دعوةٍ يُفعّل الحساب', async () => {
    const { userId, token } = await invitedAccount('invite.activate@test.local')
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status).toBe('invited')

    await auth.resetPassword(token, 'MyOwnPass#123')
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status).toBe('active')
    /* ويدخل بها فعلا */
    const session = await auth.login('invite.activate@test.local', 'MyOwnPass#123')
    expect(session.token).toBeTruthy()
  })

  it('واستعادةٌ عاديّةٌ لا تُغيّر حالةَ حسابٍ موقوف', async () => {
    const { userId } = await invitedAccount('invite.suspended@test.local')
    await auth.suspend(userId)
    const { tokenForDelivery } = await auth.requestPasswordReset('invite.suspended@test.local')
    await auth.resetPassword(tokenForDelivery!, 'AnotherPass#123')
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status, 'الموقوفُ لا يُفعَّل بكلمةِ مرور').toBe('suspended')
  })
})

describe('الأرشفةُ: مغادرةٌ لا محو', () => {
  it('تُغلق الحسابَ وتُبطل جلساتِه ودعواتِه، وتبقي سجلّاتَه', async () => {
    const { userId, token } = await invitedAccount('archive.me@test.local')
    await auth.resetPassword(token, 'LeaverPass#123')
    const session = await auth.login('archive.me@test.local', 'LeaverPass#123')
    const { token: freshInvite } = await auth.issueInvite(userId)

    await auth.archive(userId, userId, 'انتهى تعاونُنا في نهاية الفصل — قرارٌ إداريّ')

    const user = await prisma.user.findUnique({ where: { id: userId } })
    expect(user!.status).toBe('archived')
    expect(user, 'الحسابُ باقٍ — الأرشفةُ ليست حذفا').not.toBeNull()
    expect(await prisma.session.count({ where: { userId, revokedAt: null } }), 'لا جلسةَ قائمة').toBe(0)
    await expect(auth.resolve(session.token)).resolves.toBeNull()
    await expect(auth.resetPassword(freshInvite, 'BackDoor#12345'), 'ولا دعوةَ تُفتح لحسابٍ أُغلق')
      .rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('وسببُها يُكتب — لا أرشفةَ بلا تفسيرٍ يُقرأ بعد سنة', async () => {
    const { userId } = await invitedAccount('archive.reason@test.local')
    await expect(auth.archive(userId, userId, 'غادر')).rejects.toMatchObject({ code: 'reason_required' })
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status).toBe('invited')
  })

  it('ولا تُكرَّر، وتُراجَع بإعادةِ التنشيط', async () => {
    const { userId } = await invitedAccount('archive.twice@test.local')
    await auth.archive(userId, userId, 'سببٌ كافٍ ومكتوبٌ للسجلّ')
    await expect(auth.archive(userId, userId, 'سببٌ كافٍ ومكتوبٌ للسجلّ')).rejects.toMatchObject({ code: 'already_archived' })

    await auth.unarchive(userId)
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status).toBe('active')
    await expect(auth.unarchive(userId)).rejects.toMatchObject({ code: 'not_archived' })
  })
})
