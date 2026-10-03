/* ردُّنا على من اعتذر عن عقده — وخيارُه في بياناته بكبسة زرّ (٣ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «نعطيه خيارَ حذف بياناته أو إبقائها للفصول القادمة،
   وهو يقرّر بكبسة زرّ، ونحن نحذف مباشرة».

   ═══ وما يُحرَس ═══
   ١) لا ردَّ إلّا على عقدٍ معتذَرٍ عنه — ومرّةً واحدة.
   ٢) فتحُ الصفحة لا يفعل شيئا — القراءةُ قراءة.
   ٣) «أبقِ» يُكتب ويبقى كلُّ شيء.
   ٤) «احذف» يمحو طلبَه وملفَّه بعقوده في الحال.
   ٥) وما لا يُحذف بقرار طرفٍ واحد (عقدٌ نافذٌ آخر) لا يُقال عنه «حُذف»، وتعود
      حالُ طلبه كما كانت.

   ═══ وكيف رُئي ساقطا ═══ في رسالة الالتزام. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerDeclineReplyService } from '../../services/trainer-decline-reply.service'

let prisma: PrismaClient
let svc: TrainerDeclineReplyService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const BODY = 'نشكرك جزيلَ الشكر على وقتك معنا حتّى اليوم، ويسعدنا أن نراك في المواسم القادمة.'
let seq = 0

async function declined(opts: { liveToo?: boolean } = {}) {
  seq += 1
  const email = `decl-${seq}-${Date.now()}@test.local`
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-DECL-${Date.now()}-${seq}`, fullName: `محمد المعتذر ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'declined', declinedAt: new Date(),
      declineReasonAr: 'الأتعابُ لا تناسب الجهد', requiredDocuments: [], signerEmail: email,
    },
  })
  if (opts.liveToo) {
    await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'عقدٌ نافذٌ سابق', status: 'countersigned', requiredDocuments: [], signerEmail: email },
    })
  }
  return { applicationId: application.id, reference: application.reference, profileId: profile.id, contractId: contract.id }
}

/** الرمزُ كما يصل في البريد — يُستخرَج من رابط الخيار في جواب الإرسال */
async function replied(contractId: string) {
  const r = await svc.reply(contractId, ACTOR, { subjectAr: 'شكرا لك', bodyAr: BODY })
  return decodeURIComponent(r.choiceUrl.split('/data-choice/')[1])
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new TrainerDeclineReplyService(prisma)
}, 240_000)

describe('ردُّنا على المعتذِر', () => {
  it('① لا ردَّ إلّا على معتذَرٍ عنه — ومرّةً واحدة', async () => {
    const t = await declined()
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { status: 'sent' } })
    await expect(svc.reply(t.contractId, ACTOR, { subjectAr: 'شكرا', bodyAr: BODY })).rejects.toMatchObject({ code: 'bad_state' })
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { status: 'declined' } })
    const token = await replied(t.contractId)
    expect(token.length).toBeGreaterThan(20)
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(row.declineReplyAr).toBe(BODY)
    expect(row.dataChoiceTokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    await expect(svc.reply(t.contractId, ACTOR, { subjectAr: 'شكرا', bodyAr: BODY })).rejects.toMatchObject({ code: 'already_replied' })
  })

  it('② فتحُ الصفحة لا يفعل شيئا', async () => {
    const t = await declined()
    const token = await replied(t.contractId)
    const page = await svc.choiceByToken(token)
    expect(page.choice).toBeNull()
    expect(page.fullName).toContain('محمد')
    expect(await prisma.trainerApplication.count({ where: { id: t.applicationId } })).toBe(1)
  })

  it('③ «أبقِ» يُكتب ويبقى كلُّ شيء', async () => {
    const t = await declined()
    const token = await replied(t.contractId)
    const r = await svc.chooseByToken(token, 'keep')
    expect(r.done).toBe(true)
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(row.dataChoice).toBe('keep')
    expect(await prisma.trainerProfile.count({ where: { id: t.profileId } })).toBe(1)
  })

  it('⚠️ ④ «احذف» يمحو طلبَه وملفَّه بعقوده في الحال', async () => {
    const t = await declined()
    const token = await replied(t.contractId)
    const r = await svc.chooseByToken(token, 'delete')
    expect(r.done).toBe(true)
    expect(await prisma.trainerApplication.count({ where: { id: t.applicationId } })).toBe(0)
    expect(await prisma.trainerProfile.count({ where: { id: t.profileId } })).toBe(0)
    expect(await prisma.trainerContract.count({ where: { id: t.contractId } })).toBe(0)
    /* والرابطُ بعدها لا يقرأ شيئا — لا بقيّةَ تُعرض */
    await expect(svc.choiceByToken(token)).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('⚠️ ⑤ وعقدٌ نافذٌ آخر لا يُمحى بقرار طرفٍ واحد — ولا يُقال «حُذف»، وتعود حالُه', async () => {
    const t = await declined({ liveToo: true })
    const token = await replied(t.contractId)
    const r = await svc.chooseByToken(token, 'delete')
    expect(r.done).toBe(false)
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.status).toBe('contract_pending')
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })).dataChoice).toBe('delete')
  })

  it('والرابطُ المنتهي لا يحذف', async () => {
    const t = await declined()
    const token = await replied(t.contractId)
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { dataChoiceExpiresAt: new Date(Date.now() - 1000) } })
    await expect(svc.chooseByToken(token, 'delete')).rejects.toMatchObject({ code: 'expired' })
    expect(await prisma.trainerApplication.count({ where: { id: t.applicationId } })).toBe(1)
  })
})
