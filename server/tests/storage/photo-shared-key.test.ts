/* صورةُ المدرّب العامّةُ لا تُكسَر حين يغيّر صورةَ حسابه.

   ═══ العطبُ الذي كُتب له ═══

   صورةُ الحساب يرفعها المدرّبُ فتسكن `avatarUrl` و`photoPendingKey` بالمفتاح
   نفسِه، فإذا اعتمدتها الإدارةُ انتقل المفتاحُ إلى `photoUrl` وبقي في
   `avatarUrl`: كائنٌ واحدٌ يحمله عمودان.

   وكان رفعُ صورةِ حسابٍ جديدةٍ يمحو القديمةَ من القرص بلا سؤال — وهي ما زالت
   الصورةَ العامّةَ المعتمَدة. فتطلبها صفحةُ الفريق فتأخذ ٤٠٤ وتظهر مكسورةً
   حتّى تعتمد الإدارةُ الجديدة. ورفعُ الإدارة صورةً عامّةً كان يمحو صورةَ حسابه
   بالطريق نفسِه.

   ═══ وما يُحرَس ═══

   ١) بعد صورةِ حسابٍ جديدة تبقى العامّةُ المعتمَدةُ تُخدَم.
   ٢) ولا يصير الإصلاحُ تسرّبا: إذا اعتُمدت الجديدةُ ولم يبقَ عمودٌ يشير إلى
      القديمة مُحيت من القرص.
   ٣) واستبدالُ الإدارة الصورةَ العامّةَ لا يمحو صورةَ حسابه.

   ═══ وكيف رُئي ساقطا ═══

   أُعيد نداءُ `deleteObject(oldKey)` المباشرُ في `startAvatarUpload` مكانَ
   `releasePhotoObject`، فردّ المسارُ العامُّ ٤٠٤ وسقط الحارسُ الثاني. وأُعيد
   في `savePublicProfile` فمُحيت صورةُ الحساب وسقط الرابع. ثمّ أُعيدا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { buildApp } from '../../http/app'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { ProfileService } from '../../services/profile.service'
import { getObject, putObject } from '../../services/object-store'

let prisma: PrismaClient
let app: FastifyInstance
let review: TrainerReviewService
let profiles: ProfileService
let profileId = ''
let userId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'

/* رأسُ PNG الحقيقيُّ — المسارُ العامُّ لا يسأل البايتات، لكنّ الرفعَ يسألها */
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])

/** يرفع صورةَ حسابٍ كما يرفعها صاحبُها: يُصدَر المفتاحُ ثمّ تصل البايتات */
async function uploadAvatar(): Promise<string> {
  const { storageKey } = await profiles.startAvatarUpload(userId, 'image/png')
  await putObject(storageKey, PNG_HEAD, { mime: 'image/png', originalName: 'me.png' })
  return storageKey
}

const servePublic = (key: string) => app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${key}` })

/* والرفعُ مشتعلٌ في إعداد اختبارات الخادم (`vitest.server.config.ts`) */
beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  review = new TrainerReviewService(prisma)
  profiles = new ProfileService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, {
    fullName: 'مدرّبُ الصورة المشتركة', email: 'shared-photo@test.local',
  })
  profileId = made.profileId
  userId = made.userId
  await review.approvePublicVisibility(profileId, ACTOR)
  await giveLiveCourse(prisma, profileId)
}, 240_000)

describe('صورة الحساب الجديدة لا تكسر الصورة العامّة', () => {
  let first = ''
  let second = ''

  it('الأولى تعتمد فتخدم للعامّة — وهي نفسها صورة حسابه', async () => {
    first = await uploadAvatar()
    await review.approvePendingPhoto(profileId, ACTOR)
    expect((await servePublic(first)).statusCode).toBe(200)
  })

  it('⚠️ وبعد صورة حساب جديدة تبقى المعتمدة تخدم — لا ٤٠٤ حتّى تعتمد الثانية', async () => {
    second = await uploadAvatar()
    expect(
      (await servePublic(first)).statusCode,
      'محيت الصورة العامّة المعتمدة من القرص وعمودها ما زال يشير إليها: صفحة الفريق تعرضها مكسورة.',
    ).toBe(200)
    expect(await getObject(first)).not.toBeNull()
  })

  it('وإذا اعتمدت الثانية محيت الأولى — لم يبق عمود يشير إليها', async () => {
    await review.approvePendingPhoto(profileId, ACTOR)
    expect((await servePublic(second)).statusCode).toBe(200)
    expect(await getObject(first), 'بقيت بايتات لا يشير إليها سجلّ').toBeNull()
  })

  it('واستبدال الإدارة الصورة العامّة لا يمحو صورة حسابه', async () => {
    /* `second` الآن صورةُ حسابه وصورتُه العامّةُ معا */
    await review.savePublicProfile(profileId, ACTOR, { photoUrl: 'https://example.com/p.png' })
    expect(await getObject(second), 'محيت صورة حسابه حين استبدلت الإدارة الصورة العامّة').not.toBeNull()
  })
})
