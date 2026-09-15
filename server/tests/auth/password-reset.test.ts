/* استعادةُ كلمة المرور — الرحلةُ كاملةً من الطلب إلى الدخول.

   ولمَ ملفٌّ لها الآن: المسارُ قائمٌ منذ البداية، والرسالةُ تُرسَل منذ أن
   وُصلت قناةُ البريد — ولم يكن للرحلة حارسٌ واحد. كلُّ ما مسّ
   `/api/auth/password/forgot` اختبارُ حقلِ الفخّ (`rbac/honeypot.test.ts`)،
   وهو يثبت أنّ الآليَّ يُردّ لا أنّ الإنسانَ يمرّ. فالطريقُ الذي يسلكه من
   نسي كلمتَه كان غيرَ مفحوصٍ من طرفه إلى طرفه.

   والفحصُ هنا على المسار (`app.inject`) لا على الخدمة وحدَها: الرمزُ يُولَّد
   في الخدمة، لكنّ ما يصل الإنسانَ يمرّ بالمسار — وهناك كان يُسقَط قبلُ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

/** يطلب الاستعادةَ من المسار ويعيد الرمزَ كما يعيده في التطوير */
async function forgot(email: string): Promise<{ status: number; body: { message: string; devToken?: string | null } }> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email } })
  return { status: res.statusCode, body: JSON.parse(res.body) as { message: string; devToken?: string | null } }
}

describe('رحلةُ من نسي كلمتَه', () => {
  it('طلبٌ فرمزٌ فكلمةٌ جديدةٌ فدخولٌ بها', async () => {
    await auth.register('forgot.happy@test.local', 'OldPass#12345', 'ناسٍ')

    const asked = await forgot('forgot.happy@test.local')
    expect(asked.status).toBe(200)
    expect(asked.body.devToken, 'لا رمزَ يصل صاحبَه').toBeTruthy()

    const done = await app.inject({
      method: 'POST', url: '/api/auth/password/reset',
      payload: { token: asked.body.devToken, newPassword: 'NewPass#12345' },
    })
    expect(done.statusCode).toBe(200)

    const session = await auth.login('forgot.happy@test.local', 'NewPass#12345')
    expect(session.token).toBeTruthy()
    /* والقديمةُ لا تعمل بعدها — وإلّا فالاستعادةُ إضافةٌ لا استبدال */
    await expect(auth.login('forgot.happy@test.local', 'OldPass#12345'))
      .rejects.toMatchObject({ code: 'bad_credentials' })
  })

  it('والرمزُ يُستهلَك مرّةً — فالرابطُ لا يُفتح مرّتين', async () => {
    await auth.register('forgot.once@test.local', 'OldPass#12345', 'مرّةٌ واحدة')
    const { tokenForDelivery } = await auth.requestPasswordReset('forgot.once@test.local')
    await auth.resetPassword(tokenForDelivery!, 'First#123456')
    await expect(auth.resetPassword(tokenForDelivery!, 'Second#123456'))
      .rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('ولا يعمل بعد ساعتِه', async () => {
    const { userId } = await auth.register('forgot.expired@test.local', 'OldPass#12345', 'متأخّر')
    const { tokenForDelivery } = await auth.requestPasswordReset('forgot.expired@test.local')
    await prisma.passwordResetToken.updateMany({
      where: { userId, purpose: 'reset' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await expect(auth.resetPassword(tokenForDelivery!, 'TooLate#12345'))
      .rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('وتعيينُ الكلمة يُبطل الجلساتِ القائمة — من سرق الكلمةَ يخرج معها', async () => {
    await auth.register('forgot.sessions@test.local', 'OldPass#12345', 'جلسات')
    const old = await auth.login('forgot.sessions@test.local', 'OldPass#12345')
    expect(await auth.resolve(old.token)).not.toBeNull()

    const { tokenForDelivery } = await auth.requestPasswordReset('forgot.sessions@test.local')
    await auth.resetPassword(tokenForDelivery!, 'Rotated#12345')
    expect(await auth.resolve(old.token)).toBeNull()
  })

  /* ═══ بابٌ واحدٌ لا بابان ═══

     الدعوةُ تُبطل ما قبلها صراحةً (`issueInvite`): «رابطان صالحان لحسابٍ
     واحدٍ بابان لا باب». ولم تكن الاستعادةُ تفعل — فكلُّ طلبٍ يترك رمزَه
     حيّا ساعةً كاملة، ومن طلب ثلاثا فله ثلاثةُ أبوابٍ مفتوحةٍ في وقتٍ واحد.
     والعرفُ واحدٌ في البابين، فيُطبَّق فيهما. */
  it('وطلبٌ ثانٍ يُبطل الأوّل — بابٌ واحدٌ لا بابان', async () => {
    const { userId } = await auth.register('forgot.twice@test.local', 'OldPass#12345', 'مرّتان')
    const first = await forgot('forgot.twice@test.local')
    const second = await forgot('forgot.twice@test.local')
    expect(second.body.devToken).not.toBe(first.body.devToken)

    const live = await prisma.passwordResetToken.count({
      where: { userId, purpose: 'reset', usedAt: null },
    })
    expect(live, 'رمزُ استعادةٍ ساري المفعولِ واحدٌ لا أكثر').toBe(1)

    await expect(auth.resetPassword(first.body.devToken!, 'ViaOld#123456'), 'والأوّلُ لا يعمل بعدها')
      .rejects.toMatchObject({ code: 'invalid_token' })
    /* والأخيرُ يعمل — الإبطالُ يُصيب ما قبلَه لا ما هو */
    await auth.resetPassword(second.body.devToken!, 'ViaNew#123456')
    expect((await auth.login('forgot.twice@test.local', 'ViaNew#123456')).token).toBeTruthy()
  })

  /* ودعوةٌ ساريةٌ لا تسقط بطلب الاستعادة: غرضان مستقلّان، ولكلٍّ عمرُه
     (`invitations-and-archive.test.ts` يثبّت بقاءهما معا). */
  it('ولا تمسّ الدعوةَ السارية — الإبطالُ على غرضِه وحدَه', async () => {
    const { userId } = await auth.register('forgot.invite@test.local', 'Random#Placeholder1', 'مدعوّ')
    await prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
    const invite = await auth.issueInvite(userId)

    await forgot('forgot.invite@test.local')
    const live = await prisma.passwordResetToken.findMany({ where: { userId, usedAt: null } })
    expect(live.map((r) => r.purpose).sort()).toEqual(['invite', 'reset'])
    /* والدعوةُ ما زالت تُفتح */
    await auth.resetPassword(invite.token, 'ViaInvite#123')
    expect((await prisma.user.findUnique({ where: { id: userId } }))!.status).toBe('active')
  })

  it('وبريدٌ لا حسابَ له: الردُّ نفسُه ولا رمزَ يُكتب', async () => {
    const before = await prisma.passwordResetToken.count()
    const res = await forgot('nobody.at.all@test.local')
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('إن كان البريد مسجلا')
    expect(res.body.devToken ?? null, 'لا رمزَ لحسابٍ لا وجودَ له').toBeNull()
    expect(await prisma.passwordResetToken.count()).toBe(before)
  })
})
