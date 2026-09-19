/* قمعُ توظيف المدرّبين — ما يُقاس، ولمَ لا يكفي عدُّ الحالات.

   ═══ ما يحرسه ═══

   ① **الأساسُ الطلبُ المكتمل** — لا مسوّدةٌ فُتحت وتُركت. فلو قِيس على كلّ
      صفٍّ في الجدول لانخفضت كلُّ النسب بمن لم يُقدّم أصلا، وقُرئ ذلك تسرّبا
      في قمعنا وهو ليس منه.
   ② **وأثرُ التذكير يُقاس بترتيب الزمن** — «حجز بعد التذكير» تعني حجزا وقع
      **بعد** الرسالة. ومن حجز ثمّ ذُكّر (وهو لا يقع في المنتَج: الحارسُ
      يمنعه) لا يُحسب أثرا للتذكير، وإلّا نسبنا إلى الرسالة ما ليس لها.
   ③ **و«جرى اللقاء» لا تعني نتيجةً سُجّلت وحدَها** — المُقابِلُ ينسى
      التسجيل، وموعدٌ مضى ولم يُلغَ لقاءٌ جرى.
   ⑤ **ومن لم يحضر ليس منهم** — وهو الذي كان يقع في الشقّ الثاني حرفا
      (موعدٌ مضى ولم يُلغَ) فيُعَدّ لقاءً وقع، ويُقاس تسرُّبُ الغياب صفرا.
   ④ **وكلُّ صفٍّ يقول أساسَ نسبته** — فنسبةٌ من المذكَّرين لا تُقرأ من الكلّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { ReportsService } from '../../services/reports.service'
import { recordAudit } from '../../services/audit'

let prisma: PrismaClient
let reports: ReportsService

const S = Date.now().toString(36).slice(-5)
const ago = (d: number) => new Date(Date.now() - d * 86_400_000)

/** طلبٌ في القاعدة مباشرةً — القمعُ يقرأ الأعمدة، فلا يلزمه مسارُ التقديم */
async function application(tag: string, data: {
  status: string
  completedAgo: number | null
}) {
  return prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-2026-${S}-${tag}`,
      fullName: `متقدّم ${tag}`,
      email: `funnel-${tag}-${S}@test.local`,
      status: data.status,
      phase2CompletedAt: data.completedAgo === null ? null : ago(data.completedAgo),
    },
    select: { id: true },
  })
}

const row = (rows: Record<string, unknown>[], stage: string) =>
  rows.find((r) => r.stage === stage) as { count: number; pct: number; base: string; medianDays: number | null }

let funnel: Record<string, unknown>[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  reports = new ReportsService(prisma)

  /* مسوّدةٌ لم تُكمَل — خارج الأساس */
  await application('draft', { status: 'draft', completedAgo: null })

  /* أتمّ ولم يحجز ولم يُذكَّر */
  await application('idle', { status: 'submitted', completedAgo: 9 })

  /* أتمّ وحجز بنفسه بعد يومَين، وجرى لقاؤه أمس */
  const self = await application('self', { status: 'under_review', completedAgo: 10 })
  await prisma.trainerInterview.create({
    data: { applicationId: self.id, scheduledAt: ago(1), createdAt: ago(8), mode: 'remote' },
  })

  /* أتمّ، وذُكّر، ثمّ حجز بعد التذكير بيوم — وهو ما يقيس أثرَ الرسالة */
  const nudged = await application('nudged', { status: 'interview_scheduled', completedAgo: 12 })
  await recordAudit(prisma, {
    actorId: null, action: 'trainer.interview.remind',
    entityType: 'trainer_application', entityId: nudged.id,
  })
  await prisma.auditEvent.updateMany({ where: { entityId: nudged.id }, data: { createdAt: ago(5) } })
  await prisma.trainerInterview.create({
    data: { applicationId: nudged.id, scheduledAt: ago(2), createdAt: ago(4), mode: 'remote' },
  })

  /* أتمّ وذُكّر ولم يحجز بعد — مذكَّرٌ ولا أثرَ له */
  const deaf = await application('deaf', { status: 'submitted', completedAgo: 6 })
  await recordAudit(prisma, {
    actorId: null, action: 'trainer.interview.remind',
    entityType: 'trainer_application', entityId: deaf.id,
  })

  /* حجز بنفسه ثمّ كُتب له تذكيرٌ بعده — لا يقع في المنتَج (الحارسُ يمنعه)
     ويقع في البيانات القديمة. وهو الذي يجعل «بعد التذكير» ترتيبَ زمنٍ
     مفحوصا لا لفظا: بلا الترتيب يُنسب حجزُه إلى رسالةٍ لم يكن قد رآها. */
  const early = await application('early', { status: 'under_review', completedAgo: 15 })
  await prisma.trainerInterview.create({
    data: { applicationId: early.id, scheduledAt: ago(8), createdAt: ago(12), mode: 'remote' },
  })
  await recordAudit(prisma, {
    actorId: null, action: 'trainer.interview.remind',
    entityType: 'trainer_application', entityId: early.id,
  })

  /* أتمّ وحجز واعتُمد مدرّبا */
  const hired = await application('hired', { status: 'active', completedAgo: 30 })
  await prisma.trainerInterview.create({
    data: { applicationId: hired.id, scheduledAt: ago(20), createdAt: ago(25), mode: 'remote', outcome: 'passed' },
  })
  await prisma.trainerStatusHistory.create({
    data: { applicationId: hired.id, fromStatus: 'academic_review', toStatus: 'active', createdAt: ago(18) },
  })

  /* ═══ حجز ولم يحضر — والفرقُ بين «حجز» و«جرى اللقاء» ═══

     موعدُه مضى ولم يُلغَ، فكان يقع في شقِّ «موعدٌ مضى ولم يُلغَ» حرفا
     ويُعَدّ لقاءً وقع. وهو بعينه التسرُّبُ الذي لا يُرى. */
  const ghost = await application('ghost', { status: 'under_review', completedAgo: 14 })
  await prisma.trainerInterview.create({
    data: { applicationId: ghost.id, scheduledAt: ago(3), createdAt: ago(10), mode: 'remote', outcome: 'no_show' },
  })

  funnel = (await reports.run('trainer-funnel', {})).rows
}, 240_000)

describe('قمعُ توظيف المدرّبين', () => {
  it('الأساسُ الطلبُ المكتمل — والمسوّدةُ خارجَه', () => {
    /* خمسةٌ أتمّوا، والسادسُ مسوّدة. ولو دخلت لانخفضت كلُّ نسبةٍ بعدها. */
    expect(row(funnel, 'طلبٌ مكتمل').count).toBe(7)
    expect(row(funnel, 'طلبٌ مكتمل').pct).toBe(100)
  })

  it('ويُعدّ من حجز ومن جرى لقاؤه ومن اعتُمد — كلٌّ بنسبته', () => {
    expect(row(funnel, 'حجز لقاءَ التعارف').count).toBe(5)
    expect(row(funnel, 'حجز لقاءَ التعارف').pct).toBe(71.4)
    /* أربعةٌ مواعيدُهم مضت ولم تُلغَ — فجرت وإن لم تُسجَّل نتيجةُ ثلاثة.
       والخامسُ حجز ولم يحضر، فليس منهم. */
    expect(row(funnel, 'جرى اللقاء').count).toBe(4)
    expect(row(funnel, 'اعتُمد مدرّبا').count).toBe(1)
    expect(row(funnel, 'اعتُمد مدرّبا').pct).toBe(14.3)
  })

  it('⑤ ومن لم يحضر لا يُعَدّ لقاءً جرى — وله صفُّه ونسبتُه من حجز', () => {
    expect(row(funnel, 'لم يحضر اللقاء').count).toBe(1)
    /* الأساسُ «من حجز» لا «من المكتمل»: من لم يحجز لا يُنسَب إليه غياب */
    expect(row(funnel, 'لم يحضر اللقاء').base).toBe('من حجز')
    expect(row(funnel, 'لم يحضر اللقاء').pct).toBe(20)
    /* والمجموعُ يُقرأ: خمسةٌ حجزوا، أربعةٌ جرى لقاؤهم، وواحدٌ غاب */
    expect(row(funnel, 'جرى اللقاء').count + row(funnel, 'لم يحضر اللقاء').count)
      .toBe(row(funnel, 'حجز لقاءَ التعارف').count)
  })

  it('وأثرُ التذكير: من ذُكّر، ومن حجز بعده — ونسبتُه من المذكَّرين', () => {
    expect(row(funnel, 'ذُكّر بالحجز').count).toBe(3)
    /* واحدٌ من ثلاثةٍ حجز **بعد** الرسالة: الثاني لم يحجز، والثالثُ حجز قبلها */
    expect(row(funnel, 'حجز بعد التذكير').count).toBe(1)
    expect(row(funnel, 'حجز بعد التذكير').pct).toBe(33.3)
    expect(row(funnel, 'حجز بعد التذكير').base).toBe('من المذكَّرين')
    /* ومن حجز بنفسه بلا تذكيرٍ لا يُنسب إلى الرسالة */
    expect(row(funnel, 'حجز بعد التذكير').count).toBeLessThan(row(funnel, 'حجز لقاءَ التعارف').count)
  })

  it('ووسيطُ الأيّام يُقاس بين المرحلة وسابقتها', () => {
    /* ١٠←٨ = ٢، و١٢←٤ = ٨، و٣٠←٢٥ = ٥، و١٥←١٢ = ٣ → الوسيطُ (٣+٥)/٢ = ٤ */
    expect(row(funnel, 'حجز لقاءَ التعارف').medianDays).toBe(4)
    /* ومن ذُكّر قبل ٥ وحجز قبل ٤ → يومٌ واحد */
    expect(row(funnel, 'حجز بعد التذكير').medianDays).toBe(1)
  })

  it('وبلا طلباتٍ مكتملةٍ في المدى لا تُخترع صفوفٌ بأصفار', () => {
    /* مدًى لا طلبَ فيه: جدولٌ فارغٌ أصدقُ من ستّة أصفارٍ تُقرأ قياسا */
    return reports.run('trainer-funnel', { from: ago(3650), to: ago(3600) })
      .then((out) => expect(out.rows).toEqual([]))
  })
})
