/* من كان في مهلته يومَ تبدّل المسار — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * نُقل طورُ الموادّ من التوقيع إلى الاعتماد (٢٧ سبتمبر ٢٠٢٦)، فصار العرضُ
 * فيه `countersigned` بعد أن كان `signed`. وقُصر عاملا المهلة على الحال
 * الجديدة وحدَها.
 *
 * **فسقط من كان في مهلته تلك اللحظة.** صفٌّ وُقِّع أمسِ يحمل:
 *
 *   · العقد  `signed`      — لأنّ الاعتمادَ لم يقع بعد
 *   · الطلب  `onboarding`  — لأنّ التوقيعَ كان ينقله
 *   · ومهلةٌ مكتوبةٌ تجري  — لأنّ التوقيعَ كان يكتبها
 *
 * فلا يجده عاملٌ. وقِيس ذلك قبل الإصلاح بصفٍّ من هذه الهيئة: **صفرٌ في
 * التذكير وصفرٌ في الانقضاء**. أي أنّ مهلتَه تنقضي في صمتٍ تامّ — وهو بعينه
 * العطبُ الذي بُني العاملان لدفعه، عاد لمن كان في الطريق.
 *
 * ── ولمَ لا يُخلط بالجديد ──
 *
 * صفٌّ `signed` بعد اليوم **لا مهلةَ له**: لا يكتبها إلّا الاعتماد. والعاملُ
 * يشترط مهلةً قائمة. فاجتماعُ `signed` ومهلةٍ لا يقع إلّا في صفٍّ من العالم
 * القديم — ويخلو الجدولُ منه بانقضاء آخرِ مهلةٍ فيه.
 *
 * ── وما يُقاس ──
 *
 * الطرفان معا: أنّ القديمَ يُوجَد، وأنّ الجديدَ الموقَّعَ بلا مهلةٍ **لا**
 * يُوجَد. فحارسٌ يقيس الأوّلَ وحدَه يخضرّ على شرطٍ يلتقط كلَّ موقَّع.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let review: TrainerReviewService
let seq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
}, 240_000)

const DAY = 86_400_000

/** صفٌّ بالهيئة المطلوبة — الحالُ والمهلةُ يُعطَيان */
async function row(opts: {
  contractStatus: string
  deadlineAt: Date | null
  appStatus?: string
}) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CUT-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`,
      email: `cut-${seq}-${Date.now()}@test.local`,
      status: opts.appStatus ?? 'onboarding', motivation: 'اختبار',
      privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عرضٌ ${seq}`,
      status: opts.contractStatus, signedAt: new Date(Date.now() - 3 * DAY),
      ...(opts.contractStatus === 'countersigned' ? { countersignedAt: new Date(Date.now() - 2 * DAY) } : {}),
      gatesActivation: true,
      conditionDeadlineAt: opts.deadlineAt,
    },
  })
  return { app, contract }
}

const remindersFor = (id: string) => prisma.auditEvent.count({
  where: { action: 'trainer.condition.remind', entityId: id },
})
const noticesFor = (id: string) => prisma.auditEvent.count({
  where: { action: 'trainer.condition.lapsed', entityId: id },
})

describe('صفوفُ ما قبل تبدّل المسار', () => {
  it('يُذكَّر من وقّع قبل التبدّل ومهلتُه تجري — وكان لا يُذكَّر', async () => {
    const { contract } = await row({
      contractStatus: 'signed', deadlineAt: new Date(Date.now() + DAY),
    })
    await review.remindConditionDeadlines(new Date())
    expect(await remindersFor(contract.id),
      'صفٌّ من العالم القديم لا يجده عاملُ التذكير — تنقضي مهلتُه في صمت').toBe(1)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.conditionRemindedAt, 'ذُكِّر ولم يُؤشَّر').not.toBeNull()
  })

  it('ويُنذَر بانقضائها — وكان لا يُنذَر', async () => {
    const { contract } = await row({
      contractStatus: 'signed', deadlineAt: new Date(Date.now() - DAY),
    })
    await review.noticeLapsedConditions(new Date())
    expect(await noticesFor(contract.id),
      'انقضت مهلتُه ولم يُبلَّغ — وهو لا يعلم أنّها انقضت').toBe(1)
  })

  /* ═══ والطرفُ الآخر: الجديدُ لا يُلتقَط ═══

     من وقّع بعد التبدّل حالُه `signed` كذلك — **ولا مهلةَ له**، فمهلتُه
     تُكتب باعتمادنا. فلو التقطه العاملُ لَذُكِّر بمهلةٍ لم تبدأ، وطُرق بابٌ
     لم نفتحه بعد. */
  it('ولا يُذكَّر من وقّع بعد التبدّل ولم يُعتمَد — فلا مهلةَ له بعد', async () => {
    const { contract } = await row({ contractStatus: 'signed', deadlineAt: null })
    await review.remindConditionDeadlines(new Date())
    expect(await remindersFor(contract.id), 'ذُكِّر بمهلةٍ لم تبدأ').toBe(0)
    await review.noticeLapsedConditions(new Date())
    expect(await noticesFor(contract.id), 'أُنذر بانقضاء مهلةٍ لم تبدأ').toBe(0)
  })

  it('والمعتمَدُ يُذكَّر كما كان — فالتوسيعُ لم يُسقط الحالَ الجديدة', async () => {
    const { contract } = await row({
      contractStatus: 'countersigned', deadlineAt: new Date(Date.now() + DAY),
    })
    await review.remindConditionDeadlines(new Date())
    expect(await remindersFor(contract.id), 'سقطت الحالُ الجديدةُ بتوسيع الشرط').toBe(1)
  })

  /* ولا يُطرَق بابُ من لم يبلغ الطورَ أصلا: حالةُ طلبه تُسأل كما كانت */
  it('ولا يُذكَّر من لم يدخل طورَ الموادّ — ولو كان لصفّه مهلة', async () => {
    const { contract } = await row({
      contractStatus: 'signed', deadlineAt: new Date(Date.now() + DAY),
      appStatus: 'contract_pending',
    })
    await review.remindConditionDeadlines(new Date())
    expect(await remindersFor(contract.id), 'ذُكِّر من لم تُفتح بوّابتُه').toBe(0)
  })
})
