/* دوراتُ قوائم الموقع — ما له شعبةٌ أُعلنت ولم تنتهِ (`listedCohortWhere`).

   قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): «أن تظهر هذه الدورات فقط في قسم الدورات، وأن تخفى من لا شعبةَ
   لها.. ويكون الأمرُ تلقائيّا»، و«تظهر حتّى تنتهي شعبتُها». فيُحرس هنا الطرفان: ما يُظهر الدورةَ —
   شعبةٌ مفتوحة، وممتلئة، وجارية أُغلق التحاقُها، ولفصلٍ أُغلقت نافذتُه ولم تنتهِ — وما لا يُظهرها:
   المسودّة، وما لم تُعتمد خطّةُ مدرّبه، وما أُغلق تسجيلُه بيد الإدارة، وفصلٌ لم يُفتح تسجيلُه بعد،
   وما انتهى أو أُلغي. ولكلّ حالٍ دورتُها وحدَها، فلا تُظهرها شعبةٌ أخرى من اختبارٍ آخر. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let catalog: PublicCatalogService
let profileId = ''

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY)
const stamp = Date.now().toString(36).toUpperCase()

/** دورةٌ لهذا الاختبار وحدَه — وشعبةٌ واحدةٌ فيها بالحال المطلوبة */
async function courseWith(tag: string, cohort: Record<string, unknown>, approved = true) {
  const id = `C-LST${tag}-${stamp}`
  await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
  const row = await prisma.cohort.create({
    data: {
      courseId: id, title: `شعبة ${tag}`, status: 'open', registrationOpen: true,
      price: 150, currency: 'USD', capacity: 20, startsAt: at(10), endsAt: at(50), ...cohort,
    },
  })
  await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId: row.id, trainerId: profileId, status: approved ? 'approved' : 'submitted',
      content: { kind: 'trainer', modules: [], resources: [] },
    },
  })
  return id
}

/* الفصلُ فريدٌ بسنته وموسمه — فسنةٌ بعيدةٌ لكلّ فصلٍ في هذا الملفّ لا تصطدم بفصلٍ حقيقيّ */
let termYear = 2190
async function term(opensInDays: number, closesInDays: number) {
  return (await prisma.term.create({
    data: {
      year: termYear++, season: 'nov_jan',
      titleAr: `فصل ${stamp}-${opensInDays}`, startsOn: at(30), endsOn: at(120), status: 'open',
      registrationOpensAt: at(opensInDays), registrationClosesAt: at(closesInDays),
    },
  })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  catalog = new PublicCatalogService(prisma)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-LST-${stamp}`, fullName: 'مدرّبُ القوائم', email: `lst-${stamp}@test.local`,
      phone: '0790000031', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })).id
}, 180_000)

describe('دوراتُ قوائم الموقع — من فتح شعبتها إلى انتهائها', () => {
  it('⚠️ تظهر بشعبةٍ مفتوحة، وتبقى ممتلئةً وجاريةً وبعد إغلاق التحاقها ونافذة فصلها', async () => {
    const open = await courseWith('O', {})
    const full = await courseWith('F', { status: 'full' })
    const running = await courseWith('A', { status: 'active', startsAt: at(-7), joinClosesAt: at(-1) })
    const closedTerm = await courseWith('T', { termId: await term(-30, -1) })
    const listed = await catalog.listedCourseIds()
    expect(listed, 'دورةٌ بشعبةٍ مفتوحةٍ لا تظهر').toContain(open)
    expect(listed, 'غابت دورةٌ امتلأت شعبتُها — في ذروة الإقبال عليها').toContain(full)
    expect(listed, 'غابت دورةٌ بدأت شعبتُها ولم تنتهِ').toContain(running)
    expect(listed, 'غابت دورةٌ أُغلقت نافذةُ فصلها وشعبتُها لم تنتهِ').toContain(closedTerm)
  })

  it('⚠️ ولا تظهر بما لم يُعلَن أو انتهى', async () => {
    const draft = await courseWith('D', { status: 'draft' })
    const unapproved = await courseWith('U', {}, false)
    const paused = await courseWith('P', { registrationOpen: false })
    const future = await courseWith('N', { termId: await term(5, 40) })
    const ended = await courseWith('E', { status: 'active', startsAt: at(-60), endsAt: at(-1) })
    const done = await courseWith('C', { status: 'completed' })
    const cancelled = await courseWith('X', { status: 'cancelled' })
    const listed = await catalog.listedCourseIds()
    for (const [id, why] of [
      [draft, 'مسودّة'], [unapproved, 'خطّةُ مدرّبها لم تُعتمد'], [paused, 'أُغلق تسجيلُها بيد الإدارة'],
      [future, 'فصلُها لم يُفتح تسجيلُه بعد'], [ended, 'انتهت'], [done, 'أُكملت'], [cancelled, 'أُلغيت'],
    ] as const) {
      expect(listed, `ظهرت دورةٌ شعبتُها ${why}`).not.toContain(id)
    }
  })

  it('والدورةُ مرّةً واحدةً وإن كثرت شعبُها', async () => {
    const id = await courseWith('M', {})
    const second = await prisma.cohort.create({
      data: { courseId: id, title: 'شعبة ثانية', status: 'open', registrationOpen: true, price: 150, currency: 'USD', startsAt: at(20) },
    })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: second.id, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const listed = await catalog.listedCourseIds()
    expect(listed.filter((x) => x === id)).toHaveLength(1)
  })
})

/* ═══ وفصولُ شعبها (٢٨ أكتوبر ٢٠٢٦) ═══
   المسارُ العامُّ يُعرض حين تكون لكلّ دوراته شعبةٌ في فصله (`listedWhole`). والفصلُ من يوم البدء بتوقيت عمّان. */
describe('فصولُ الدورات المعروضة', () => {
  it('⚠️ من يوم بدء الشعبة بتوقيت عمّان — منتصفُ ليل أوّل نوفمبر شتاءٌ وإن كان في UTC أكتوبر', async () => {
    const id = await courseWith('S', { startsAt: new Date('2030-10-31T21:00:00Z'), endsAt: new Date('2031-01-20T00:00:00Z') })
    const { courseIds, seasons } = await catalog.listedCourses()
    expect(courseIds).toContain(id)
    expect(seasons[id]).toEqual(['2030-nov_jan'])
  })

  it('وبلا يوم بدءٍ ففصلُها المسجَّل — والشعبتان في فصلين فصلان', async () => {
    const termId = await term(-30, -1)
    const t = await prisma.term.findUniqueOrThrow({ where: { id: termId } })
    const id = await courseWith('R', { startsAt: null, termId })
    const second = await prisma.cohort.create({
      data: { courseId: id, title: 'شعبة الربيع', status: 'open', registrationOpen: true, price: 150, currency: 'USD', startsAt: new Date('2031-03-01T08:00:00Z'), endsAt: new Date('2031-04-01T08:00:00Z') },
    })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: second.id, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const { seasons } = await catalog.listedCourses()
    expect([...seasons[id]].sort()).toEqual([`${t.year}-nov_jan`, '2031-feb_apr'].sort())
  })
})
