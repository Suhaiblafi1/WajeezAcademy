/* توقيعُ المدرّب عقدَه بنفسه — ما يُفتح له، وما لا يمرّ.

   ═══ ولمَ يُقاس المردودُ أكثرَ ممّا يُقاس الناجح ═══

   المسارُ السعيدُ يُكتشف عطبُه في أوّل استعمال: من وقّع ولم يُسجَّل توقيعُه
   يتّصل في اليوم نفسِه. أمّا ما يُقاس هنا فأعطابٌ **لا يشتكي منها أحد** —
   لأنّ المستفيدَ منها لا يبلّغ:

   · من وُقّع عقدُه مرّتين فأُغلقت مهمّتُه مرّتين.
   · ومن بُدّل النصُّ تحته بين فتحِه وتوقيعه.
   · ومن وقّع بلا أن يرفع هويّتَه، فبقي الإقرارُ بلا ما يقابله.
   · ومن فُتح له رابطٌ لعقدٍ سُحب من تحته.
   · **ومدرّبٌ يعمل، أُرسل له عقدٌ فطُرد من بوّابته** — وهو أخطرُها، لأنّه
     يقع لمن يُدرّس في منتصف فصلٍ ويقرأ «حسابك التدريبي موقوف».

   وكلُّها تمرّ صامتةً على من يفحص المسارَ السعيدَ وحدَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONTRACT_ACKS } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const ALL_ACKS = CONTRACT_ACKS.map((a) => a.key)
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'
const DOCS = [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  process.env.FILE_UPLOADS = 'on'

  const admin = await auth.register('csign-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0
/** مرشّحٌ بملفٍّ وعقدٍ مسودّةٍ له متنٌ مجمَّد — ويُبنى بلا `composeContract`
    كي لا يتوقّف الحارسُ على اكتمال هويّة الأكاديميّة، وهي ناقصةٌ عمدا. */
async function mkContract(status = 'conditionally_approved', docs = DOCS) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CS-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `csign-${seq}-${Date.now()}@test.local`,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: docs, signerEmail: app.email,
      gatesActivation: status !== 'active',
    },
  })
  await prisma.trainerOnboardingTask.create({
    data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' },
  })
  return { app, profile, contract }
}

/** يرسل ويعيد الرمزَ من الرابط — فالرمزُ لا يُخزَّن، ولا يُقرأ من القاعدة */
async function sendAndToken(contractId: string) {
  const r = await review.sendContract(contractId, adminId)
  const token = r.signingUrl.split('/c/')[1]
  return decodeURIComponent(token)
}

describe('الإرسالُ يفتح البابَ ويحرّك ما ينبغي وحدَه', () => {
  it('المسودّةُ تصير مرسَلةً، والطلبُ ينتقل إلى contract_pending', async () => {
    const { app, contract } = await mkContract()
    await sendAndToken(contract.id)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('sent')
    expect(after.tokenHash, 'أُرسل بلا رمزٍ — فبأيّ رابطٍ يوقّع؟').toBeTruthy()
    expect(after.sentAt).toBeTruthy()
    const appAfter = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
    expect(appAfter.status).toBe('contract_pending')
  })

  it('ومدرّبٌ نشطٌ لا تُمسُّ حالتُه — فلا يُطرَد من بوّابته بعقدٍ يوثّقه', async () => {
    const { app, contract } = await mkContract('active')
    await sendAndToken(contract.id)
    const appAfter = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
    expect(appAfter.status, 'نُقل مدرّبٌ يعمل فصار حسابُه «موقوفا»').toBe('active')
    const history = await prisma.trainerStatusHistory.count({ where: { applicationId: app.id } })
    expect(history, 'كُتب صفُّ حالةٍ لمدرّبٍ لم تتغيّر حالتُه').toBe(0)
  })

  it('ولا يُرسَل إلّا مسودّة — والمرسَلُ مرّتين يُردّ', async () => {
    const { contract } = await mkContract()
    await sendAndToken(contract.id)
    await expect(review.sendContract(contract.id, adminId)).rejects.toMatchObject({ code: 'bad_state' })
  })
})

describe('القراءةُ من الرابط', () => {
  it('يُقرأ المتنُ وهاشُه والوثائقُ المطلوبة، ويُسجَّل أنّه فُتح', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    const view = await review.contractByToken(token)
    expect(view.state).toBe('open')
    if (view.state !== 'open') return
    expect(view.bodyAr).toBe(BODY)
    expect(view.bodyHash).toBe(sha256(BODY))
    expect(view.requiredDocuments.map((d) => d.kind)).toEqual(['national_id'])
    expect(view.acks.length, 'لا إقراراتِ — فبمَ يُقرّ؟').toBeGreaterThan(3)
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.firstOpenedAt, 'فُتح ولم يُسجَّل').toBeTruthy()
  })

  it('ورمزٌ مختلَقٌ لا يفتح شيئا', async () => {
    await expect(review.contractByToken('x'.repeat(43))).rejects.toMatchObject({ code: 'invalid_token' })
  })
})

describe('ما لا يمرّ عند التوقيع', () => {
  it('هاشٌ لا يطابق المحفوظ يُردّ — فمن بُدّل النصُّ تحته لا يوقّع على ما لم يره', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await expect(review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256('نصٌّ آخر'), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'body_changed' })
  })

  it('ووثيقةٌ إلزاميّةٌ لم تُرفَع تمنع — فالإقرارُ بالاسم بلا ما يقابله', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await expect(review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'documents_missing' })
  })

  it('وإقرارٌ ناقصٌ يمنع — والخمسةُ بنودٌ يُنازَع فيها', async () => {
    const { contract } = await mkContract('conditionally_approved', [])
    const token = await sendAndToken(contract.id)
    await expect(review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: ALL_ACKS.slice(1),
    })).rejects.toMatchObject({ code: 'acks_missing' })
  })

  it('واسمٌ أقصرُ من أن يكون اسما قانونيّا يُردّ', async () => {
    const { contract } = await mkContract('conditionally_approved', [])
    const token = await sendAndToken(contract.id)
    await expect(review.signContractByToken(token, {
      legalName: 'سا', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'bad_name' })
  })
})

describe('التوقيعُ يقع مرّةً واحدة', () => {
  it('يُسجَّل بدليله، وتُغلَق مهمّتُه، ويموت رمزُه', async () => {
    const { profile, contract } = await mkContract('conditionally_approved', [])
    const token = await sendAndToken(contract.id)
    await review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
      ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (اختبار)',
    })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.status).toBe('signed')
    expect(row.signerLegalName).toBe('سارة عبد الله الحربي')
    expect(row.signerIp).toBe('203.0.113.9')
    expect(row.signedBodyHash).toBe(sha256(BODY))
    expect(row.consentTextAr, 'وُقّع بلا حفظِ نصّ الإقرار الذي عُرض').toBeTruthy()

    /* ═══ والجملُ التي أقرّ بها تُحفَظ نصّا — لا مفاتيحَ ولا رقمَ إصدار ═══

       كان رأسُ `contract-body.ts` يقول إنّها تُحفَظ ولم تكن تُحفَظ: يُكتب
       `consentTextAr` (جملةُ التوقيع وحدَها) و`consentVersion` في الأثر. ولم
       يظهر ما دام الإصدارُ واحدا — فمن قرأ `v1` وجد في الشيفرة خمسا لا سادسَ
       لها. وقد صار اثنين بإضافة الإقرار السادس (البند 4-10)، فمن سُئل «بأيّ
       الجمل أقرّ؟» عن عقدٍ وُقّع أمس لا يُجاب إلّا بالنبش في تاريخ Git.

       والمقيسُ **النصُّ لا العدد**: عمودٌ يحمل ستّةَ مفاتيحَ بلا جملها لا
       يجيب السؤالَ الذي وُضع له. */
    const stored = row.consentAcksAr as { key: string; textAr: string }[] | null
    expect(stored, 'وُقّع بلا حفظِ الجمل التي أقرّ بها').toBeTruthy()
    expect(stored!.map((a) => a.key).sort(), 'المحفوظُ ليس ما عُرض عليه').toEqual([...ALL_ACKS].sort())
    for (const a of stored!) {
      const shown = CONTRACT_ACKS.find((x) => x.key === a.key)!
      expect(a.textAr, `حُفظ مفتاحُ «${a.key}» بلا جملته`).toBe(shown.textAr)
    }
    /* والسادسُ منها بعينه: هو علّةُ العمود، فسقوطُه يُسقط الحارس */
    const issued = stored!.find((a) => a.key === 'issued_discount')
    expect(issued, 'الإقرارُ بخصمه هو لم يُحفَظ').toBeTruthy()
    expect(issued!.textAr, 'الجملةُ المحفوظةُ لا تحيل إلى 4-10').toContain('4-10')

    expect(row.tokenHash, 'الرمزُ بقي حيّا بعد التوقيع — بابٌ يُفتح مرّتين').toBeNull()

    const task = await prisma.trainerOnboardingTask.findFirstOrThrow({
      where: { profileId: profile.id, key: 'sign_contract' },
    })
    expect(task.doneAt, 'وُقّع ولم تُغلَق مهمّةُ التوقيع').toBeTruthy()
  })

  it('والتوقيعُ الثاني بالرمز نفسِه لا يمرّ', async () => {
    const { contract } = await mkContract('conditionally_approved', [])
    const token = await sendAndToken(contract.id)
    const once = () => review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    })
    await once()
    await expect(once()).rejects.toMatchObject({ code: 'invalid_token' })
    const audits = await prisma.auditEvent.count({
      where: { action: 'trainer.contract.sign_by_trainer', entityId: contract.id },
    })
    expect(audits, 'أثرانِ لتوقيعٍ واحد').toBe(1)
  })
})

describe('الاعتذارُ والإلغاءُ يغلقان البابَ كلاهما', () => {
  it('الاعتذارُ يُسجَّل بسببه ويموت رمزُه', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await review.declineContractByToken(token, 'الأتعابُ لا تناسبني في هذا الوقت')
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.status).toBe('declined')
    expect(row.declineReasonAr).toContain('الأتعاب')
    expect(row.tokenHash).toBeNull()
  })

  it('وعقدٌ أُلغي لا يبقى رابطُه حيّا — فلا يُوقَّع ما سُحب', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await review.revokeContract(contract.id, adminId, 'أُرسل إلى الشخص الخطأ')
    await expect(review.contractByToken(token)).rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('وسببٌ فارغٌ لا يُقبل اعتذارا — فالسجلُّ يُقرأ بعد شهر', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await expect(review.declineContractByToken(token, 'لا')).rejects.toMatchObject({ code: 'no_reason' })
  })
})

describe('رفعُ الوثائق من الرابط', () => {
  it('صيغةٌ خارج المسموح تُردّ — ولا يُخدَم من أصلِنا ما يعلنه الرافعُ نوعا', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await expect(review.requestContractDocumentUpload(token, {
      kind: 'national_id', originalName: 'x.html', mime: 'text/html', sizeBytes: 100,
    })).rejects.toMatchObject({ code: 'bad_mime' })
  })

  it('ونوعٌ لم يُطلب في هذا العقد يُردّ', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    await expect(review.requestContractDocumentUpload(token, {
      kind: 'passport', originalName: 'p.pdf', mime: 'application/pdf', sizeBytes: 100,
    })).rejects.toMatchObject({ code: 'bad_kind' })
  })

  it('والمقبولُ يُسجَّل ويعرفه المخزنُ بمفتاحه', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    const { storageKey } = await review.requestContractDocumentUpload(token, {
      kind: 'national_id', originalName: 'id.jpg', mime: 'image/jpeg', sizeBytes: 2048,
    })
    const { resolveStorageOwner } = await import('../../services/storage.service')
    const owner = await resolveStorageOwner(prisma, storageKey)
    expect(owner?.kind, 'مفتاحٌ لا يعرفه المخزن — فرفعُه يقود إلى ٤٠٤').toBe('contract_document')
  })

  it('ورفعُ النوع نفسِه ثانيةً يحلّ محلَّ الأوّل — لا صفّان لوثيقةٍ واحدة', async () => {
    const { contract } = await mkContract()
    const token = await sendAndToken(contract.id)
    const first = await review.requestContractDocumentUpload(token, {
      kind: 'national_id', originalName: 'مقلوبة.jpg', mime: 'image/jpeg', sizeBytes: 2048,
    })
    await review.requestContractDocumentUpload(token, {
      kind: 'national_id', originalName: 'صحيحة.jpg', mime: 'image/jpeg', sizeBytes: 2048,
    })
    const rows = await prisma.trainerContractDocument.findMany({ where: { contractId: contract.id } })
    expect(rows.length).toBe(1)
    expect(rows[0].originalName).toBe('صحيحة.jpg')
    expect(rows[0].storageKey).not.toBe(first.storageKey)
  })
})
