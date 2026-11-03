/* «ملفّ متقدّم لمراجعتك» للجديد وحدَه (٣ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «فقط إذا كان جديدا». فقارئٌ له رابطٌ حيٌّ بالملفّ نفسِه لا يُنشأ له
   ثانٍ ولا تصله رسالةٌ ثانية، ويُردّ رابطُه القائم. والملغى والمنتهي ليسا قائمَين.

   ونُقض الحارسُ مرّةً: أُزيل بابُ «الرابط القائم» من `create` فسقط الأوّلُ (صفٌّ ثانٍ ورسالةٌ
   ثانية)، وأُزيل شرطُ `revokedAt` منه فسقط الثاني. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'

let prisma: PrismaClient
let links: TrainerDossierLinkService
let applicationId = ''
const ACTOR = '00000000-0000-0000-0000-000000000012'

const sends = () => prisma.auditEvent.count({
  where: { action: 'trainer.dossier_link.send', entityId: applicationId },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  links = new TrainerDossierLinkService(prisma)
  const app = await prisma.trainerApplication.create({
    data: { reference: 'WJ-TR-ONCE-1', fullName: 'متقدّم اختبار الرابط', email: 'once-applicant@test.local', status: 'submitted' },
  })
  applicationId = app.id
}, 240_000)

describe('رابطُ القارئ يُرسَل مرّةً', () => {
  it('قارئٌ له رابطٌ حيٌّ يُردّ رابطُه ولا تصله رسالةٌ ثانية', async () => {
    const first = await links.create(applicationId, ACTOR, {
      reviewerName: 'قارئ', reviewerEmail: 'reader@test.local', sendEmail: true,
    })
    expect(first.reused).toBe(false)
    expect(await sends()).toBe(1)

    const again = await links.create(applicationId, ACTOR, {
      reviewerName: 'قارئ', reviewerEmail: 'Reader@Test.local', sendEmail: true,
    })
    expect(again.reused, 'أُنشئ رابطٌ ثانٍ لقارئٍ له رابطٌ حيّ').toBe(true)
    expect(again.link.id).toBe(first.link.id)
    expect(again.url, 'لم يُردّ الرابطُ القائمُ بحرفه').toBe(first.url)
    expect(await sends(), 'وصلت القارئَ رسالةٌ ثانيةٌ بالملفّ نفسِه').toBe(1)
    expect(await prisma.trainerDossierLink.count({ where: { applicationId } })).toBe(1)
  })

  it('والملغى ليس قائما — يُنشأ له جديدٌ وتصله رسالتُه', async () => {
    const live = await prisma.trainerDossierLink.findFirstOrThrow({ where: { applicationId } })
    await links.revoke(applicationId, live.id, ACTOR)
    const made = await links.create(applicationId, ACTOR, {
      reviewerName: 'قارئ', reviewerEmail: 'reader@test.local', sendEmail: true,
    })
    expect(made.reused, 'رُدّ رابطٌ ملغى على أنّه قائم').toBe(false)
    expect(await sends()).toBe(2)
  })

  it('وقارئٌ آخرُ جديد', async () => {
    const other = await links.create(applicationId, ACTOR, {
      reviewerName: 'قارئ ثان', reviewerEmail: 'other@test.local', sendEmail: true,
    })
    expect(other.reused).toBe(false)
    expect(await sends()).toBe(3)
  })
})
