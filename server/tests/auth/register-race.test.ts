/* تسجيلان معا بالبريد نفسِه (٩ نوفمبر ٢٠٢٦) — والعلّةُ في `AuthService.register`.

   ضغطتان على «أنشئ حسابا» تمرّان كلتاهما بسؤال «أهذا البريدُ مسجّل؟»، فيردّ الفهرسُ الفريدُ الثانية — وكان الردُّ ٥٠٠ «خطأ
   في الخادم» والحسابُ قد أُنشئ. فصار «البريدُ مسجّل» (٤٠٩) كما لو سُئل بعد ثانية. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
}, 240_000)

describe('تسجيلان معا بالبريد نفسه', () => {
  it('⚠️ يمضي واحد، والباقي «البريد مسجل» لا خطأ خادم — وحساب واحد', async () => {
    const send = () => app.inject({
      method: 'POST', url: '/api/auth/register', remoteAddress: '10.77.0.1',
      payload: { email: 'race-signup@test.local', password: 'Pass#12345', displayName: 'ضاغط مرتين' },
    })
    const out = await Promise.all([send(), send(), send()])
    const statuses = out.map((r) => r.statusCode).sort()
    expect(statuses, 'رد خطأ خادم على تسجيل مكرر').toEqual([201, 409, 409])
    for (const r of out.filter((x) => x.statusCode === 409)) expect(r.json().error.code).toBe('email_taken')
    expect(await prisma.user.count({ where: { email: 'race-signup@test.local' } })).toBe(1)
  })
})
