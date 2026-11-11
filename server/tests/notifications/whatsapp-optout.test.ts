/* من ردّ «توقف» على واتساب (١١ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `whatsapp-optout.service.ts`.

   ① **المديرُ يسجّله من قائمة من عبّأ** — فيُقرأ في صفّه، وبذيل الرقم: الرقمُ نفسُه بصيغةٍ أخرى في نموذجٍ آخر يُقرأ مثله.
      ويُرجَع عنه، وكلاهما في الأثر باسم من فعل.
   ② **ومستشارُ الحالة يراه بجانب رقمه ويسجّله** — وغيرُ مستشارها لا يسجّل فيها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { registrantsFull, setRegistrantWhatsapp } from '../../services/grant-registrants.service'
import { OPEN_GRANT_SLUG, MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let advisors: AdvisorService
let ownerId = ''
let advisorId = ''
let otherAdvisor = ''
const STAMP = Date.now()

const lead = (campaign: string, phone: string) => prisma.lead.create({
  data: { fullName: `عميل ${phone}`, phone, email: `wa-${phone.replace(/\D/g, '')}-${STAMP}@test.local`, source: 'campaign', campaign },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  ownerId = (await auth.register(`wa-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  advisorId = (await auth.register(`wa-adv-${STAMP}@test.local`, 'Advisor#12345', 'مستشار')).userId
  otherAdvisor = (await auth.register(`wa-adv2-${STAMP}@test.local`, 'Advisor#12345', 'مستشار آخر')).userId
  await makeAdvisor(prisma, auth, advisorId)
  await makeAdvisor(prisma, auth, otherAdvisor)
}, 240_000)

describe('① المدير يسجله من قائمة من عبأ', () => {
  it('⚠️ يقرأ في صفه وفي نموذجه الآخر برقم بصيغة أخرى — ويرجع عنه، وكلاهما في الأثر', async () => {
    const a = await lead(OPEN_GRANT_SLUG, `0797${String(STAMP).slice(-6)}`)
    const b = await lead(MEMBER_GRANT_SLUG, `+962 797 ${String(STAMP).slice(-6, -3)} ${String(STAMP).slice(-3)}`)
    const other = await lead(OPEN_GRANT_SLUG, `0798${String(STAMP).slice(-6)}`)
    const row = async (id: string) => (await registrantsFull(prisma)).rows.find((r) => r.id === id)!

    expect((await row(a.id)).waStopped).toBe(false)
    await setRegistrantWhatsapp(prisma, a.id, true, ownerId)
    expect((await row(a.id)).waStopped).toBe(true)
    expect((await row(b.id)).waStopped, 'الرقم نفسه بصيغة أخرى لم يقرأ').toBe(true)
    expect((await row(other.id)).waStopped, 'سجل رقما آخر').toBe(false)

    await setRegistrantWhatsapp(prisma, a.id, false, ownerId)
    expect((await row(a.id)).waStopped).toBe(false)
    const actions = (await prisma.auditEvent.findMany({ where: { entityId: a.id, actorId: ownerId }, orderBy: { createdAt: 'asc' } })).map((e) => e.action)
    expect(actions).toEqual(['contact.whatsapp_stop', 'contact.whatsapp_resume'])
  })
})

describe('② مستشار الحالة يراه ويسجله', () => {
  it('⚠️ يرى العلامة بجانب رقمه ويسجلها — وغير مستشارها لا يسجل فيها', async () => {
    const l = await lead(OPEN_GRANT_SLUG, `0799${String(STAMP).slice(-6)}`)
    const kase = await prisma.advisorCase.create({ data: { leadId: l.id } })
    await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedBy: ownerId } })

    expect((await advisors.caseDetail(advisorId, kase.id)).whatsappStopped).toBe(false)
    await expect(advisors.setWhatsappStop(otherAdvisor, kase.id, true)).rejects.toBeTruthy()
    expect((await advisors.caseDetail(advisorId, kase.id)).whatsappStopped, 'سجل غير مستشارها').toBe(false)

    await advisors.setWhatsappStop(advisorId, kase.id, true)
    expect((await advisors.caseDetail(advisorId, kase.id)).whatsappStopped).toBe(true)
    expect(await prisma.auditEvent.count({ where: { action: 'contact.whatsapp_stop', entityId: kase.id, actorId: advisorId } })).toBe(1)
  })
})
