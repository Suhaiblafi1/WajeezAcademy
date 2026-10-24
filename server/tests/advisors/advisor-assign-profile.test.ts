/* لا تُسنَد حالةٌ لمن لا يفتحها، ولا يتخطّى الإسنادُ التلقائيُّ من يعمل (٢٤ أكتوبر ٢٠٢٦).

   بوّابةُ المستشار لا تُفتح إلّا بملفّ مستشار، والملفُّ يولد حين تُحفَظ عمولتُه في «المستشارون والعمولة». وكان شرطُ
   الإجازة في الإسناد التلقائيّ (١٩ أكتوبر ٢٠٢٦) سالبا — `NOT (awayFrom ≤ الآن AND awayUntil > الآن)` — وفي SQL مقارنةُ
   الفارغ لا صدقٌ ولا كذب. فمن له ملفٌّ ولم يكتب إجازةً قطّ سقط من الإسناد، وبقي فيه من لا ملفَّ له ولا يفتح ما يُسند
   إليه — ومنها حالاتُ المنحة الموعودةُ باتّصالٍ خلال ساعتين. ظهر في دراسة لوحة الإدارة.

   ① الإسنادُ التلقائيُّ يختار من له ملفٌّ بلا إجازة — ويتخطّى من لا ملفَّ له ولو كان أقلَّهم حالات.
   ② والإسنادُ باليد يردّ من لا ملفَّ له ويقول أين يُصلَح.
   ③ والدمجُ مثلُه — فمن تبقى الحالةُ عنده يفتحها.
   ④ وقائمةُ الإسناد تقول من لا ملفَّ له، فتمنع الشاشةُ اختيارَه (`src/tests/advisor/advisor-profile-picker.test.ts`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let seq = 0

/** مستشارٌ بدوره، وبملفٍّ إن حُفظت عمولتُه — وبلا إجازةٍ قطّ */
async function advisor(withProfile: boolean) {
  const { userId } = await auth.register(`assign-adv-${++seq}-${Date.now()}@test.local`, 'Advisor#12345', `مستشار ${seq}`)
  await auth.setRoles(userId, ['advisor'])
  if (withProfile) await prisma.advisorProfile.create({ data: { userId, commissionPct: 10 } })
  return userId
}
const newCase = async () => {
  const lead = await prisma.lead.create({ data: { fullName: `عميل ${++seq}` } })
  return (await prisma.advisorCase.create({ data: { leadId: lead.id } })).id
}
const othersThan = async (...keep: string[]) =>
  (await prisma.user.findMany({ where: { id: { notIn: keep }, roles: { some: { roleId: 'advisor' } } }, select: { id: true } })).map((u) => u.id)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
}, 240_000)

describe('① الإسناد التلقائي', () => {
  it('⚠️ يختار من له ملف ولم يكتب إجازة قط — كان يسقطه شرط الإجازة', async () => {
    const ready = await advisor(true)
    expect(await advisors.autoAssign(await newCase(), { exclude: await othersThan(ready) }), 'تخطى من يعمل').toBe(ready)
  })

  it('⚠️ ويتخطى من لا ملف له — ولو كان أقلهم حالات', async () => {
    const bare = await advisor(false)
    const ready = await advisor(true)
    /* من له ملف عنده حالة مفتوحة، ومن لا ملف له لا شيء عنده — فلولا الشرط لاختير */
    await advisors.assign(await newCase(), ready, null)
    const others = await othersThan(bare, ready)
    expect(await advisors.autoAssign(await newCase(), { exclude: others }), 'أسند لمن لا يفتح الحالة').toBe(ready)
    expect(await advisors.autoAssign(await newCase(), { exclude: [...others, ready] }), 'أسند لمن لا ملف له وحده').toBeNull()
  })
})

describe('② الإسناد باليد', () => {
  it('⚠️ يرد من لا ملف له ويقول أين يصلح', async () => {
    const bare = await advisor(false)
    await expect(advisors.assign(await newCase(), bare, null)).rejects.toMatchObject({ code: 'no_advisor_profile' })
  })
})

describe('③ الدمج', () => {
  it('⚠️ لا تبقى الحالة عند من لا ملف له', async () => {
    const bare = await advisor(false)
    const ready = await advisor(true)
    const [one, two] = [await newCase(), await newCase()]
    await expect(advisors.mergeCases([one, two], bare, ready)).rejects.toMatchObject({ code: 'no_advisor_profile' })
    expect(await prisma.advisorCase.count({ where: { id: { in: [one, two] }, status: 'closed' } }), 'دمج مع الرد').toBe(0)
    const { keptId } = await advisors.mergeCases([one, two], ready, ready)
    expect((await prisma.advisorAssignment.findFirst({ where: { caseId: keptId, unassignedAt: null } }))?.advisorId).toBe(ready)
  })
})

describe('④ قائمة الإسناد', () => {
  it('⚠️ تقول من لا ملف له', async () => {
    const bare = await advisor(false)
    const ready = await advisor(true)
    const list = await advisors.assignableAdvisors()
    expect(list.find((a) => a.id === bare)?.hasProfile, 'لم يقل من لا ملف له').toBe(false)
    expect(list.find((a) => a.id === ready)?.hasProfile).toBe(true)
  })
})
