/* ═══ حالةُ الفصل صارت تُكتب — وقد كانت تُقرأ فارغةً وحدَها ═══

   العلّةُ كاملةً في `src/application/terms/lifecycle`: عمودٌ بخمس قيمٍ
   يقرؤه خمسةُ مواضعَ ولا يكتبه سطرٌ واحد، فكلُّ فصلٍ `planned` أبدا. ومنه
   حارسٌ في `openForTrainer` يردّ `term_closed` ولا يقع في الإنتاج قطّ —
   وخضرتُه في الاختبار جاءت من صفٍّ كُتبت حالتُه بـ`prisma.term.create`
   مباشرةً، لا من بابٍ قائم. وهو بعينه «الحارسُ الأخضرُ لسببٍ خاطئ».

   ═══ وما يُقاس هنا ═══

   ① البابُ الإداريُّ يكتب فعلا: الحالةُ تتبدّل، ويُسجَّل الفاعلُ في الأثر،
     و`openedAt`/`openedBy` — عمودان لم يُكتبا قطّ — يُكتبان عند الفتح.
   ② وما لا يجوز يُردّ: نقلةٌ خارجَ القاعدة، وإلغاءُ فصلٍ فيه شعب.
   ③ والتقويمُ يفعل ما ليس قرارا: يُنهي ما مضت أشهرُه، ويُجري ما بلغ أوّلَه،
     ولا يفتح ما لم تفتحه الإدارة.
   ④ وأثرُ ذلك يصل الشعب: فصلٌ أُنهي **من الباب** لا تُفتح فيه شعبةٌ ولا
     يُسمَّى فصلا لشعبةٍ قائمة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TermService } from '../../services/term.service'
import { CohortService } from '../../services/cohort.service'
import { syncTermStatuses } from '../../worker/jobs'

let prisma: PrismaClient
let terms: TermService
let cohorts: CohortService
let adminId = ''
const COURSE = 'C-BIZ-101'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/* ═══ فصلٌ بحدودٍ مكتوبةٍ بيد — والحدودُ مُدخَلُ الاختبار لا محلُّ الفحص ═══

   ⚠️ و`(year, season)` هنا **مفتاحُ تعريفٍ** لا وصفٌ للحدود: هجرةُ
   `term_system` تبذر فصولَ السنة الجارية والتي تليها بمواسمها الأربعة،
   وقاعدةُ الاختبار واحدةٌ لكلّ الملفّات — فصفٌّ بسنةٍ قريبةٍ يصطدم
   بـ`@@unique([year, season])` ويُسقط الملفَّ في `beforeAll`. فالسنةُ
   تُشتقّ من بداية المدى والموسمُ يُمرَّر، ولا يُقرأ منهما حكم. */
let seq = 0
async function makeTerm(startsOn: string, endsOn: string, status = 'planned', season = 'feb_apr') {
  seq += 1
  return prisma.term.create({
    data: {
      titleAr: `فصلُ حالةٍ ${seq}`, season, year: Number(startsOn.slice(0, 4)),
      startsOn: day(startsOn), endsOn: day(endsOn), status,
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  terms = new TermService(prisma)
  cohorts = new CohortService(prisma)

  const admin = await prisma.user.create({
    data: { email: `term-status-${Date.now()}@wajeez.test`, displayName: 'مديرُ الأكاديميّة', passwordHash: 'x' },
  })
  adminId = admin.id
}, 180_000)

describe('① بابُ الإدارة يكتب الحالةَ فعلا', () => {
  it('⚠️ الفتحُ يبدّل الحالةَ ويكتب `openedAt`/`openedBy` — وهما عمودان لم يُكتبا قطّ', async () => {
    const t = await makeTerm('2041-02-01', '2041-04-30')
    expect(t.status, 'الافتراضيّةُ تبدّلت — يُراجَع المخطَّط').toBe('planned')
    expect(t.openedAt, 'كُتب `openedAt` قبل الفتح').toBeNull()

    const opened = await terms.setStatus(adminId, t.id, 'open')
    expect(opened.status).toBe('open')
    expect(opened.openedAt, 'فُتح الفصلُ ولم يُكتب متى').not.toBeNull()
    expect(opened.openedBy, 'فُتح الفصلُ ولم يُعرف من فتحه').toBe(adminId)
  })

  it('ويُسجَّل في الأثر بمن فعله ومن أين إلى أين', async () => {
    const t = await makeTerm('2042-02-01', '2042-04-30')
    await terms.setStatus(adminId, t.id, 'open')
    const log = await prisma.auditEvent.findFirst({
      where: { action: 'term.status', entityId: t.id }, orderBy: { createdAt: 'desc' },
    })
    expect(log, 'نُقلت الحالةُ بلا أثر').toBeTruthy()
    expect(log!.actorId, 'أثرٌ بلا فاعل').toBe(adminId)
    expect(log!.meta).toMatchObject({ from: 'planned', to: 'open' })
  })

  it('ومن فتحه أوّلَ مرّةٍ يبقى هو من فتحه — لا يُمحى بنقلةٍ بعده', async () => {
    const t = await makeTerm('2043-02-01', '2043-04-30')
    const opened = await terms.setStatus(adminId, t.id, 'open')
    const closed = await terms.setStatus(adminId, t.id, 'closed')
    expect(closed.openedAt?.toISOString()).toBe(opened.openedAt?.toISOString())
    expect(closed.openedBy).toBe(adminId)
  })
})

describe('② وما لا يجوز يُردّ', () => {
  it('⚠️ لا يُبعَث فصلٌ أُنهي', async () => {
    const t = await makeTerm('2044-02-01', '2044-04-30', 'closed')
    await expect(terms.setStatus(adminId, t.id, 'open')).rejects.toMatchObject({ code: 'bad_transition' })
  })

  it('⚠️ ولا يُلغى فصلٌ فيه شعبٌ — فتفقد حدودَها بصمت', async () => {
    const t = await makeTerm('2045-02-01', '2045-04-30')
    await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ في فصلٍ يُراد إلغاؤه', termId: t.id })
    await expect(terms.setStatus(adminId, t.id, 'cancelled')).rejects.toMatchObject({ code: 'term_has_cohorts' })
    const still = await prisma.term.findUniqueOrThrow({ where: { id: t.id } })
    expect(still.status, 'أُلغي الفصلُ رغم الردّ').toBe('planned')
  })

  it('والخالي يُلغى', async () => {
    const t = await makeTerm('2046-02-01', '2046-04-30')
    const out = await terms.setStatus(adminId, t.id, 'cancelled')
    expect(out.status).toBe('cancelled')
  })
})

/* ═══ ③ والتقويمُ يفعل ما ليس قرارا ═══

   ⚠️ والقاعدةُ مشتركةٌ بين ملفّات الاختبار كلِّها، و`syncStatusesByDate`
   تمسّ **كلَّ** فصلٍ حيٍّ بلغه التاريخ. فلحظاتُ المزامنة هنا مختارةٌ لتكون
   أضيقَ أثرٍ ممكن: `2026-01-01` لا يسبقه انتهاءُ فصلٍ لغير هذا الملفّ (ولا
   فصلٍ مبذور)، و`2019-12-01` أقدمُ من كلّ ما في القاعدة. ولحظةٌ بعيدةٌ
   (٢٠٤٧ مثلا) كانت تُنهي فصولَ ملفّاتٍ أخرى بصمت. */
describe('③ والتقويمُ يفعل ما ليس قرارا', () => {
  it('⚠️ ما مضت أشهرُه يُنهى — ولو لم يُفتح قطّ', async () => {
    const t = await makeTerm('2020-02-01', '2020-04-30')
    const out = await terms.syncStatusesByDate(null, { apply: true, now: day('2026-01-01') })
    expect(out.changes.map((c) => c.termId), 'فصلٌ مضت سنواتٌ عليه ما زال «مخطَّطا»').toContain(t.id)
    const row = await prisma.term.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.status).toBe('closed')
  })

  it('⚠️ والمفتوحُ يجري ببلوغ أوّلِ أشهره — والمخطَّطُ لا يُفتح بالتقويم', async () => {
    const open = await makeTerm('2019-11-01', '2020-01-31', 'open', 'nov_jan')
    const planned = await makeTerm('2019-11-01', '2020-01-31', 'planned', 'may_jul')
    await terms.syncStatusesByDate(null, { apply: true, now: day('2019-12-01') })
    expect((await prisma.term.findUniqueOrThrow({ where: { id: open.id } })).status).toBe('active')
    expect(
      (await prisma.term.findUniqueOrThrow({ where: { id: planned.id } })).status,
      'فتح التقويمُ فصلا لم تفتحه الإدارة — والفتحُ إعلانٌ للناس',
    ).toBe('planned')
  })

  it('والقراءةُ الجافّةُ لا تكتب شيئا — تُرى قبل أن تقع', async () => {
    const t = await makeTerm('2021-02-01', '2021-04-30')
    const dry = await terms.syncStatusesByDate(null, { now: day('2026-01-01') })
    expect(dry.applied).toBe(false)
    expect(dry.changes.map((c) => c.termId)).toContain(t.id)
    expect((await prisma.term.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('planned')
  })

  it('⚠️ والوظيفةُ المجدولةُ موصولةٌ بها فعلا — لا قاعدةٌ بلا مشغِّل', async () => {
    const t = await makeTerm('2022-02-01', '2022-04-30')
    const out = await syncTermStatuses(prisma, day('2026-01-01'))
    expect(out.job).toBe('term_status_sync')
    expect((await prisma.term.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('closed')
  })
})

describe('④ وأثرُه يصل الشعب', () => {
  /* وكان هذا يُختبَر بصفٍّ كُتبت حالتُه بيد: حارسٌ أخضرُ على حالةٍ لا يصنعها
     شيءٌ في الإنتاج. وهنا يُنهى الفصلُ بالفعل الذي تفعله الإدارة. */
  /* وأخوه — أنّ فصلا أُنهي لا تُفتح فيه شعبةٌ لمدرّب — يسكن مع بابِ الإدارة
     في `learning/cohort-term-ownership`، ولا يُكرَّر هنا. */
  it('⚠️ فصلٌ أُنهي **من الباب** لا يُسمَّى فصلا لشعبةٍ قائمة', async () => {
    const t = await makeTerm('2049-02-01', '2049-04-30')
    const c = await cohorts.create(adminId, { courseId: COURSE, title: 'شعبةٌ تنتظر فصلا' })
    await terms.setStatus(adminId, t.id, 'open')
    await terms.setStatus(adminId, t.id, 'closed')
    await expect(cohorts.setTerm(adminId, c.id, t.id)).rejects.toMatchObject({ code: 'term_closed' })
  })
})
