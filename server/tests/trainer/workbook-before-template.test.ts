/* من رفع كرّاسةً قبل قالب وجيز — علمٌ يُكتب مرّةً في هجرة يوم القرار (٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: القالبُ «مستحسَنٌ لمن رفع كرّاسةً من قبل، وإلزاميٌّ للجدد»،
   ويُحكم **لكلّ مدرّبٍ لا لكلّ ملفّ**. والهجرةُ جرت على قاعدةٍ فارغةٍ حين هُيّئت
   قاعدةُ الاختبار، فلا يُقاس أثرُها هناك — فتُقرأ جملُها من ملفّها **نفسِه**
   وتُنفَّذ على خططٍ تُصنع هنا بكلّ شكلٍ من أشكال الكرّاسة (على حذو
   `merge-first-job-migration.test.ts`).

   ═══ وما يُفحص ═══

   ① كرّاسةُ الدورة رابطا أو ملفّا، وكرّاسةُ موعدٍ قديمة — كلٌّ يكتب العلم.
   ② والخانةُ الفارغةُ أو المسافاتُ وحدَها لا تكتبه، ولا خطّةَ بلا كرّاسة، ولا مدرّبَ بلا خطّة.
   ③ والجملُ تُعاد فلا تفسد.
   ④ والخادمُ يقرأ العلم: الورشةُ تحمله، والكرّاسةُ بلا إقرارٍ تتمّ لصاحبه وتنقص لغيره. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortPlanService } from '../../services/cohort-plan.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient
let plans: CohortPlanService
const STAMP = Date.now()
let seq = 0

const statements = readFileSync(join(root, 'prisma/migrations/20261006180000_workbook_before_template/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  plans = new CohortPlanService(prisma)
}, 240_000)

/** مدرّبٌ بحسابه — وخططُه بمحتوياتها، كلٌّ في شعبةٍ له */
async function trainer(contents: unknown[]) {
  seq += 1
  const user = await prisma.user.create({ data: { email: `wbt-${seq}-${STAMP}@wajeez.test`, displayName: `مدرّبٌ ${seq}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-WBT-${STAMP}-${seq}`, fullName: `مدرّبٌ ${seq}`, email: user.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohorts: string[] = []
  for (const content of contents) {
    const cohort = await prisma.cohort.create({
      data: { courseId: course!.id, title: `شعبةُ القالب ${seq}`, status: 'active', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman' },
    })
    await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: profile.id, role: 'lead' } })
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: cohort.id, trainerId: profile.id, status: 'draft', content: content as never } })
    cohorts.push(cohort.id)
  }
  return { userId: user.id, profileId: profile.id, cohorts }
}
const flagOf = async (profileId: string) =>
  (await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId }, select: { workbookBeforeTemplate: true } })).workbookBeforeTemplate

const base = { kind: 'trainer', summaryAr: 'شعبة', modules: [{ moduleId: 'WB-M1', titleAr: 'محور' }], resources: [] }
const slot = (workbook: unknown) => ({ startsOn: '2027-03-07', endsOn: '2027-03-13', moduleIds: ['WB-M1'], workbook })

describe('علمُ «رفع كرّاسةً قبل القالب» — هجرةُ يوم القرار', () => {
  it('①–③ على كلّ شكلٍ من أشكال الكرّاسة', { timeout: 120_000 }, async () => {
    const byLink = await trainer([{ ...base, workbook: { url: 'https://x.test/wb.pdf' } }])
    const byFile = await trainer([{ ...base, workbook: { bodyFileKey: 'wb-key', bodyFileName: 'wb.pdf' } }])
    const bySlot = await trainer([{ ...base, slots: [slot(null), slot({ url: 'https://x.test/old.pdf' })] }])
    /* وواحدةٌ من شعبتين تكفي — العلمُ للمدرّب لا للشعبة */
    const oneOfTwo = await trainer([base, { ...base, workbook: { url: 'https://x.test/wb2.pdf' } }])
    const blank = await trainer([{ ...base, workbook: { url: '   ', bodyFileKey: '', parts: [{ moduleId: 'WB-M1', whereAr: 'ص ١' }] }, slots: [slot({ url: ' ' })] }])
    const oddSlots = await trainer([{ ...base, slots: { not: 'an array' } }])
    const noPlan = await trainer([])

    await migrate()

    for (const [name, t] of Object.entries({ byLink, byFile, bySlot, oneOfTwo })) {
      expect(await flagOf(t.profileId), `${name}: لم يُكتب العلم`).toBe(true)
    }
    for (const [name, t] of Object.entries({ blank, oddSlots, noPlan })) {
      expect(await flagOf(t.profileId), `${name}: كُتب العلمُ بلا كرّاسة`).toBe(false)
    }

    /* ③ تُعاد فلا تفسد */
    await migrate()
    expect(await flagOf(byLink.profileId)).toBe(true)
    expect(await flagOf(blank.profileId)).toBe(false)
  })

  it('④ والخادمُ يقرؤه: كرّاسةٌ بلا إقرارٍ تتمّ لصاحبه وتنقص للجديد', { timeout: 120_000 }, async () => {
    const draft = { ...base, workbook: { url: 'https://x.test/wb.pdf' } }
    const veteran = await trainer([draft])
    const fresh = await trainer([draft])
    await prisma.trainerProfile.update({ where: { id: veteran.profileId }, data: { workbookBeforeTemplate: true } })

    const vw = await plans.workspace(veteran.userId, veteran.cohorts[0])
    const fw = await plans.workspace(fresh.userId, fresh.cohorts[0])
    expect(vw.workbookBeforeTemplate).toBe(true)
    expect(fw.workbookBeforeTemplate).toBe(false)
    const row = (w: typeof vw) => w.checklist.find((c) => c.key === 'workbooks')!
    expect(row(vw).done, 'نقصت كرّاسةُ من رفع قبل القالب').toBe(true)
    expect(row(fw).done, 'تمّت كرّاسةُ الجديد بلا إقرار').toBe(false)

    /* والإقرارُ يتمّها له — وعبورُه مخطّطَ الحفظ في `carried-sources-save.test.ts` */
    await prisma.cohortDeliveryPlan.updateMany({
      where: { cohortId: fresh.cohorts[0] },
      data: { content: { ...draft, workbook: { ...draft.workbook, onTemplate: true } } as never },
    })
    expect(row(await plans.workspace(fresh.userId, fresh.cohorts[0])).done).toBe(true)
  })
})
