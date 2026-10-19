/* اعتمادُ كلِّ الصور المعلَّقة بضغطةٍ واحدة.

   ═══ القرارُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «اضف زر اعتماد كل الصور المعلقة».

   ═══ وما يُحرَس ═══

   ١) كلُّ معلَّقةٍ تصير عامّةً ويخلو عمودُها — كالاعتماد الفرديّ تماما.
   ٢) ولكلٍّ أثرُها باسم صاحبها: الجماعيُّ تكرارٌ للفرديّ لا تحديثٌ يتخطّاه.
   ٣) ومن لا معلَّقةَ له لا يُمَسّ، ونداءٌ ثانٍ لا يجد شيئا.

   ═══ وكيف رُئي ساقطا ═══

   أُبدلت الحلقةُ بـ`updateMany` يكتب `photoUrl` من غير `approvePendingPhoto`،
   فخلت سجلّاتُ الأثر وسقط الحارسُ الثاني. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { putObject } from '../../services/object-store'
import { PHOTO_KEY_PREFIX } from '../../services/storage.service'

let prisma: PrismaClient
let app: FastifyInstance
let review: TrainerReviewService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])

/** مدرّبٌ منشورٌ — ومعه صورةٌ معلَّقةٌ إن أُعطي مفتاحا */
async function trainer(email: string, pendingKey: string | null): Promise<string> {
  const { profileId } = await review.createTrainerDirectly(ACTOR, { fullName: `مدرّب ${email}`, email })
  await review.approvePublicVisibility(profileId, ACTOR)
  if (pendingKey) {
    await putObject(pendingKey, PNG_HEAD, { mime: 'image/png', originalName: 'p.png' })
    await prisma.trainerProfile.update({ where: { id: profileId }, data: { photoPendingKey: pendingKey } })
  }
  return profileId
}

const KEYS = ['bulk-pending-photo-key-number-one', 'bulk-pending-photo-key-number-two'] as const
let withPhoto: string[] = []
let without = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  review = new TrainerReviewService(prisma)
  withPhoto = [await trainer('bulk-a@test.local', KEYS[0]), await trainer('bulk-b@test.local', KEYS[1])]
  without = await trainer('bulk-c@test.local', null)
}, 240_000)

describe('اعتماد كلّ الصور المعلّقة', () => {
  it('كلّ معلّقة تصير عامّة ويخلو عمودها — وتخدم للعامّة', async () => {
    const r = await review.approveAllPendingPhotos(ACTOR)
    expect(r).toEqual({ approved: 2, failed: 0 })
    for (const [i, id] of withPhoto.entries()) {
      const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id }, select: { photoUrl: true, photoPendingKey: true } })
      expect(p.photoUrl).toBe(`${PHOTO_KEY_PREFIX}${KEYS[i]}`)
      expect(p.photoPendingKey).toBeNull()
      expect((await app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${KEYS[i]}` })).statusCode).toBe(200)
    }
  })

  it('⚠️ ولكلّ صورة أثرها باسم صاحبها — الجماعيّ لا يتخطّى الفرديّ', async () => {
    const audits = await prisma.auditEvent.findMany({
      where: { action: 'trainer.photo.approve', entityId: { in: withPhoto } }, select: { entityId: true },
    })
    expect(
      audits.map((a) => a.entityId).sort(),
      'اعتمدت الصور بلا أثر: من يسأل بعد شهر من اعتمد صورة فلان لا يجد جوابا.',
    ).toEqual([...withPhoto].sort())
  })

  it('ومن لا معلّقة له لا يمسّ — ونداء ثان لا يجد شيئا', async () => {
    const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: without }, select: { photoUrl: true } })
    expect(p.photoUrl).toBeNull()
    expect(await review.approveAllPendingPhotos(ACTOR)).toEqual({ approved: 0, failed: 0 })
  })
})
