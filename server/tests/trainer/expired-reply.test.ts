/* اعتذارٌ نهائيٌّ لمن انقضى رابطُ توقيعه — ويُؤجَّل طلبُه (٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة («B»): على صفّ «انقضى رابطُه» رسالةٌ قصيرةٌ تقول إنّ المهلةَ
   انقضت فأُغلقت، وإنّا نتواصل معه في الفصول القادمة، ومعها خيارُه في بياناته —
   ويصير طلبُه «مؤجَّلا» فيُسأل عن اهتمامه بعد شهرين. والقرارُ وعلّتُه عند
   `expiredReplyBlockAr` في `src/application/trainer/decline-reply.ts`.

   ═══ وما يُحرَس ═══
   ١) لا يُرسَل على رابطٍ حيّ، ولا لمدرّبٍ نشط — ولا مرّتين.
   ٢) والإرسالُ يقع كلُّه أو لا يقع: العقدُ مُغلَق، والطلبُ مؤجَّلٌ بموعده،
      والرابطُ يقرأ صفحةَ الخيار.
   ٣) «أبقِ» يُبقيه مؤجَّلا بموعده.
   ٤) «احذف» يمحوه بالطريق نفسِه الذي يمحو المعتذِر.
   ٥) وقراءةٌ قديمةٌ لا تُغلق رابطا جُدّد بينها وبين الكتابة: الشرطُ يُعاد في الكتابة،
      والمعاملةُ تُرجع الطلبَ كما كان. ويُرى بقراءةٍ مزوّرةٍ تقول «انقضى» والقاعدةُ
      تقول «حيّ» — فالسباقُ يُصنع لا يُنتظر.

   ═══ وكيف رُئي ساقطا ═══ في رسالة الالتزام. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerDeclineReplyService } from '../../services/trainer-decline-reply.service'
import { defaultExpiredReplyAr, EXPIRED_REPLY_SUBJECT_AR } from '../../../src/application/trainer/decline-reply'
import { deferredFollowUpAt } from '../../../src/application/trainer/deferral'

let prisma: PrismaClient
let svc: TrainerDeclineReplyService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const MAIL = { subjectAr: EXPIRED_REPLY_SUBJECT_AR, bodyAr: defaultExpiredReplyAr() }
const DAY = 86_400_000
let seq = 0

async function sentContract(opts: { expiresInMs?: number; appStatus?: string } = {}) {
  seq += 1
  const email = `exp-${seq}-${Date.now()}@test.local`
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-EXP-${Date.now()}-${seq}`, fullName: `سلمى المؤجَّلة ${seq}`, email,
      status: opts.appStatus ?? 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'sent', sentAt: new Date(Date.now() - 10 * DAY),
      tokenHash: createHash('sha256').update(`tok-${seq}-${Date.now()}`).digest('hex'),
      tokenExpiresAt: new Date(Date.now() + (opts.expiresInMs ?? -DAY)),
      requiredDocuments: [], signerEmail: email,
    },
  })
  return { applicationId: application.id, profileId: profile.id, contractId: contract.id }
}

const tokenOf = (choiceUrl: string) => decodeURIComponent(choiceUrl.split('/data-choice/')[1])

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new TrainerDeclineReplyService(prisma)
}, 240_000)

describe('اعتذارٌ نهائيٌّ لمن انقضى رابطُه', () => {
  it('① لا على رابطٍ حيّ، ولا لمدرّبٍ نشط — والعقدُ والطلبُ كما كانا', async () => {
    const live = await sentContract({ expiresInMs: 2 * DAY })
    await expect(svc.expiredReply(live.contractId, ACTOR, MAIL)).rejects.toMatchObject({ code: 'bad_state' })
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: live.contractId } })).status).toBe('sent')

    const active = await sentContract({ appStatus: 'active' })
    await expect(svc.expiredReply(active.contractId, ACTOR, MAIL)).rejects.toMatchObject({ code: 'bad_state' })
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: active.applicationId } })).status).toBe('active')
  })

  it('⚠️ ② الإرسالُ يُغلق العقدَ ويؤجّل الطلبَ بموعده — مرّةً واحدة', async () => {
    const t = await sentContract()
    const before = new Date()
    const r = await svc.expiredReply(t.contractId, ACTOR, MAIL)

    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status).toBe('revoked')
    expect(c.revokeReasonAr).toMatch(/انقضت مهلةُ التوقيع/)
    expect(c.declineReplyAr).toBe(MAIL.bodyAr)
    expect(c.dataChoiceTokenHash).toBe(createHash('sha256').update(tokenOf(r.choiceUrl)).digest('hex'))

    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.status).toBe('deferred')
    /* الموعدُ موعدُ التأجيل نفسُه — شهران من اليوم (`deferral.ts`) */
    expect(app.deferredFollowUpAt?.toISOString().slice(0, 10)).toBe(deferredFollowUpAt(before).toISOString().slice(0, 10))
    expect(r.followUpAt?.getTime()).toBe(app.deferredFollowUpAt?.getTime())
    const history = await prisma.trainerStatusHistory.findFirst({ where: { applicationId: t.applicationId, toStatus: 'deferred' } })
    expect(history?.fromStatus).toBe('contract_pending')

    /* وصفحةُ الخيار تقرأ — وفتحُها لا يفعل شيئا */
    const page = await svc.choiceByToken(tokenOf(r.choiceUrl))
    expect(page.choice).toBeNull()

    await expect(svc.expiredReply(t.contractId, ACTOR, MAIL)).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('③ «أبقِ» يُبقيه مؤجَّلا بموعده', async () => {
    const t = await sentContract()
    const r = await svc.expiredReply(t.contractId, ACTOR, MAIL)
    const done = await svc.chooseByToken(tokenOf(r.choiceUrl), 'keep')
    expect(done.done).toBe(true)
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.status).toBe('deferred')
    expect(app.deferredFollowUpAt).not.toBeNull()
  })

  it('⚠️ ④ «احذف» يمحو طلبَه وملفَّه بعقده في الحال', async () => {
    const t = await sentContract()
    const r = await svc.expiredReply(t.contractId, ACTOR, MAIL)
    const done = await svc.chooseByToken(tokenOf(r.choiceUrl), 'delete')
    expect(done.done).toBe(true)
    expect(await prisma.trainerApplication.count({ where: { id: t.applicationId } })).toBe(0)
    expect(await prisma.trainerProfile.count({ where: { id: t.profileId } })).toBe(0)
    expect(await prisma.trainerContract.count({ where: { id: t.contractId } })).toBe(0)
  })

  it('⚠️ ⑤ وقراءةٌ قديمةٌ لا تُغلق رابطا جُدّد بينها وبين الكتابة', async () => {
    const t = await sentContract({ expiresInMs: 2 * DAY })
    /* القاعدةُ تقول «حيّ» (جُدّد)، والقراءةُ التي سبقته تقول «انقضى» */
    const stale = new Proxy(prisma, {
      get(target, prop) {
        if (prop === 'trainerContract') {
          const tc = target.trainerContract
          return new Proxy(tc, {
            get(model, p) {
              if (p === 'findUnique') {
                return async (args: Parameters<typeof tc.findUnique>[0]) => {
                  const row = await tc.findUnique(args)
                  return row && { ...row, tokenExpiresAt: new Date(Date.now() - DAY) }
                }
              }
              const v = Reflect.get(model, p)
              return typeof v === 'function' ? v.bind(model) : v
            },
          })
        }
        const v = Reflect.get(target, prop)
        return typeof v === 'function' ? v.bind(target) : v
      },
    }) as PrismaClient
    await expect(new TrainerDeclineReplyService(stale).expiredReply(t.contractId, ACTOR, MAIL))
      .rejects.toMatchObject({ code: 'bad_state' })
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })).status).toBe('sent')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })).status).toBe('contract_pending')
  })
})
