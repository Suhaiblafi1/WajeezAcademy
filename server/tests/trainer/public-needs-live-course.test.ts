/* لا يظهر للعامّة مدرّبٌ بلا دوراتٍ منشورةٍ هذا الفصلَ أو بعده.

   ═══ القرارُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «يجب أن تكون الصور المنشورة والحسابات
   المنشورة فقط للمدربين الذين لهم دورات هذا الفصل أو بعده! لا ينشر حساب لمن لم
   نعتمد دوراته ولم تنشر».

   ═══ وما يُحرَس — في السطوح الثلاثة معا ═══

   صفحةُ الفريق، وصفحتُه باسمه (`/t/<slug>`)، وصورتُه. فبوّابةٌ تُخفي الاسمَ
   وتترك الصورةَ تُخدَم هي نصفُ قرار.

   ١) معتمَدُ النشر بلا شعبة: لا يظهر.
   ٢) وشعبةُ الإعداد (`draft`) لم تُعتمد ولم تُنشر: لا يظهر.
   ٣) والمكتملةُ في فصلٍ مضى ليست «هذا الفصلَ أو بعده»: لا يظهر.
   ٤) والمكتملةُ في الفصل الجاري من دوراته هذا الفصل: يظهر.
   ٥) والمفتوحةُ للتسجيل: يظهر.

   ═══ وكيف رُئي ساقطا ═══

   رُدّت `publicTrainerWhere` إلى شرط اعتماد النشر وحدَه (بلا `liveTrainerWhere`)،
   فظهر من لا شعبةَ له وسقط الحارسُ الأوّلُ والثاني والثالث. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { putObject } from '../../services/object-store'
import { PHOTO_KEY_PREFIX } from '../../services/storage.service'
import { currentTermStart } from '../../services/trainer-visibility'

let prisma: PrismaClient
let app: FastifyInstance
let review: TrainerReviewService
let pub: PublicCatalogService
let profileId = ''
let cohortId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const SLUG = 'live-course-gate-trainer'
const PHOTO_KEY = 'live-course-gate-photo-key-0001'
const DAY = 86_400_000

/** يظهر في السطوح الثلاثة معا — أو يغيب عنها معا */
async function shown(): Promise<{ list: boolean; page: boolean; photo: boolean }> {
  const list = (await review.listPublicTrainers()).some((t) => t.id === profileId)
  const page = await pub.trainerPublicPage(SLUG).then(() => true, () => false)
  const photo = (await app.inject({ method: 'GET', url: `/api/v1/trainer-photos/${PHOTO_KEY}` })).statusCode === 200
  return { list, page, photo }
}
const HIDDEN = { list: false, page: false, photo: false }
const VISIBLE = { list: true, page: true, photo: true }

const setCohort = (data: { status: string; endsAt?: Date | null }) =>
  prisma.cohort.update({ where: { id: cohortId }, data })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  review = new TrainerReviewService(prisma)
  pub = new PublicCatalogService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّبُ بوّابة الدورات', email: 'live-gate@test.local' })
  profileId = made.profileId
  await review.approvePublicVisibility(profileId, ACTOR)
  await putObject(PHOTO_KEY, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { mime: 'image/png', originalName: 'p.png' })
  await prisma.trainerProfile.update({
    where: { id: profileId }, data: { publicSlug: SLUG, photoUrl: `${PHOTO_KEY_PREFIX}${PHOTO_KEY}` },
  })
}, 240_000)

describe('الظهور العامّ يحتاج دورات منشورة هذا الفصل أو بعده', () => {
  it('⚠️ معتمد النشر بلا شعبة لا يظهر — لا اسم ولا صفحة ولا صورة', async () => {
    expect(await shown(), 'ظهر من لم تعتمد دوراته ولم تنشر').toEqual(HIDDEN)
  })

  it('⚠️ وشعبة الإعداد لم تنشر بعد — لا يظهر', async () => {
    const c = await prisma.cohort.create({
      data: { courseId: 'C-BIZ-101', title: 'شعبة بوّابة الدورات', status: 'draft', startsAt: new Date(Date.now() + 14 * DAY) },
    })
    cohortId = c.id
    await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })
    expect(await shown(), 'شعبة لم تعتمد بعد أظهرت مدرّبها').toEqual(HIDDEN)
  })

  it('⚠️ والمكتملة في فصل مضى ليست «هذا الفصل أو بعده» — لا يظهر', async () => {
    await setCohort({ status: 'completed', endsAt: new Date(currentTermStart(new Date()).getTime() - DAY) })
    expect(await shown(), 'دورة فصل مضى أبقت مدرّبها ظاهرا').toEqual(HIDDEN)
  })

  it('والمكتملة في الفصل الجاري من دوراته هذا الفصل — يظهر', async () => {
    await setCohort({ status: 'completed', endsAt: new Date(currentTermStart(new Date()).getTime() + DAY) })
    expect(await shown()).toEqual(VISIBLE)
  })

  it('والمفتوحة للتسجيل — يظهر', async () => {
    await setCohort({ status: 'open', endsAt: null })
    expect(await shown()).toEqual(VISIBLE)
  })
})
