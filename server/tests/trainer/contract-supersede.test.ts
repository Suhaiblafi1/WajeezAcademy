/* عقدٌ جديدٌ يُعتمَد لمن له عقدٌ نافذ — فيُزاح القديم. بقاعدةٍ حقيقيّة.

   ═══ العطبُ الذي يحرسه ═══

   لم يكن شيءٌ يكتب `superseded` على عقد مدرّب. فمن اعتُمد له عقدٌ جديدٌ وله
   عقدٌ نافذٌ بقي له **عقدان نافذان بشرطَين**، والقرّاءُ يسألون «عقدَه النافذ»
   بصيغة المفرد فيأخذ كلٌّ منهم ما يقع له. والقيدُ في القاعدة كان يردّ الحالةَ
   أصلا — فلا أحدَ يستطيع كتابتَها لو أراد.

   وما يُقاس:
   ① القديمُ يصير `superseded` بوقته ومن أزاحه، والجديدُ وحدَه نافذ.
   ② ودليلُ توقيع القديم وختمِه لا يُمَسّ.
   ③ ولا يُمَسّ عقدُ مدرّبٍ آخر، ولا يُزاح شيءٌ لمن لا عقدَ نافذا له.
   ④ والأثرُ يُكتب. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('sup-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** مدرّبٌ نشطٌ بملفّ — وعقودُه تُضاف بـ`signedFor` */
async function trainer() {
  seq += 1
  const email = `sup-${seq}-${Date.now()}@test.local`
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SUP-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  return { app, profile }
}

/** عقدٌ وقّعه صاحبُه ولم يُعتمَد — بندٌ يُوثَّق على مدرّبٍ نشط */
async function signedFor(profileId: string, title: string) {
  return prisma.trainerContract.create({
    data: {
      profileId, title, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
      signerLegalName: 'الاسمُ القانونيّ', signedAt: new Date(), gatesActivation: false,
    },
  })
}

describe('عقدٌ جديدٌ يُعتمَد لمن له عقدٌ نافذ', () => {
  it('① القديمُ يُزاح بوقته ومن أزاحه — والجديدُ وحدَه نافذ', async () => {
    const { profile } = await trainer()
    const a = await signedFor(profile.id, 'العقدُ الأوّل')
    await review.approveSignature(a.id, adminId, {})
    const b = await signedFor(profile.id, 'العقدُ الثاني')
    await review.approveSignature(b.id, adminId, {})

    const oldRow = await prisma.trainerContract.findUniqueOrThrow({ where: { id: a.id } })
    const newRow = await prisma.trainerContract.findUniqueOrThrow({ where: { id: b.id } })
    expect(newRow.status).toBe('countersigned')
    expect(oldRow.status, 'بقي للمدرّب عقدان نافذان').toBe('superseded')
    expect(oldRow.supersededByContractId, 'لا يقول القديمُ من أزاحه').toBe(b.id)
    expect(oldRow.supersededAt?.getTime(), 'وقتُ الإزاحة غيرُ وقت الاعتماد').toBe(newRow.countersignedAt?.getTime())
    const live = await prisma.trainerContract.count({ where: { profileId: profile.id, status: 'countersigned' } })
    expect(live, 'أكثرُ من عقدٍ نافذٍ لإنسانٍ واحد').toBe(1)
  })

  it('② ودليلُ توقيع القديم وختمِه لا يُمَسّ', async () => {
    const { profile } = await trainer()
    const a = await signedFor(profile.id, 'العقدُ الأوّل')
    await review.approveSignature(a.id, adminId, {})
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: a.id } })
    const b = await signedFor(profile.id, 'العقدُ الثاني')
    await review.approveSignature(b.id, adminId, {})
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: a.id } })
    for (const col of [
      'signedAt', 'signerLegalName', 'signedBodyHash', 'bodyHash', 'bodyAr',
      'countersignedAt', 'countersignedBy', 'academySignatoryName', 'academySignatoryTitle',
    ] as const) {
      expect(JSON.stringify(after[col] ?? null), `مُسّ ${col}`).toBe(JSON.stringify(before[col] ?? null))
    }
    expect(after.countersignedAt, 'لا ختمَ أصلا — فالفحصُ يقيس الفراغ').not.toBeNull()
  })

  it('③ ولا يُمَسّ عقدُ مدرّبٍ آخر — ولا يُزاح شيءٌ لمن لا نافذَ له', async () => {
    const other = await trainer()
    const theirs = await signedFor(other.profile.id, 'عقدُ غيره')
    await review.approveSignature(theirs.id, adminId, {})

    const { profile } = await trainer()
    const first = await signedFor(profile.id, 'أوّلُ عقوده')
    await review.approveSignature(first.id, adminId, {})
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('countersigned')

    const second = await signedFor(profile.id, 'ثانيها')
    await review.approveSignature(second.id, adminId, {})
    const untouched = await prisma.trainerContract.findUniqueOrThrow({ where: { id: theirs.id } })
    expect(untouched.status, 'أُزيح عقدُ مدرّبٍ آخر').toBe('countersigned')
  })

  it('④ والأثرُ يُكتب على القديم بمن أزاحه', async () => {
    const { profile } = await trainer()
    const a = await signedFor(profile.id, 'العقدُ الأوّل')
    await review.approveSignature(a.id, adminId, {})
    const b = await signedFor(profile.id, 'العقدُ الثاني')
    await review.approveSignature(b.id, adminId, {})
    const row = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.superseded', entityId: a.id },
    })
    expect(row, 'لا أثرَ للإزاحة').not.toBeNull()
    expect((row!.meta as { byContractId?: string }).byContractId).toBe(b.id)
  })
})
