/* «عقدي» في بوّابة المدرّب — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * اثنا عشرَ عمودا هي دليلُ توقيعِ المدرّب تُكتب لحظةَ توقيعه، **ولا واحدٌ
 * منها كان يُعرَض له**. فتصله نسختُه «نصّا طويلا غير موقَّع» ويسأل: أين نضع
 * توقيعنا؟ (بلاغُ صاحب المنصّة، ٢٥ سبتمبر ٢٠٢٦).
 *
 * وحارسُ `src/tests` يقيس أنّ المكوّنَ يعرض ما يُعطى. ولا يُثبت أنّ المسارَ
 * **يُعطيه** — و`select` مقلَّمةٌ تُعيد العطبَ بعينه: شاشةٌ تعرض عناوينَ فوق
 * فراغ. فالقياسُ هنا على ما يخرج من الشبكة فعلا، على قاعدةٍ حقيقيّة، بعد
 * توقيعٍ وقع بالمسار الحقيقيّ لا بصفٍّ مكتوبٍ بيدٍ.
 *
 * ── والطرفُ الآخرُ من القياس ──
 *
 * وما لا يُقرأ لا يُعاد: عنوانُ شبكته ومتصفّحُه، وملحوظةُ من اعتمده. وتُكتب
 * في الصفّ **فعلا** قبل القياس — فلو قيس غيابُها عن صفٍّ لا تحملها أصلا كان
 * الفحصُ خضرةً على لا شيء.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { contractAcks } from '../../../src/application/trainer/contract-body'
import { SEAL_FIELDS } from '../../../src/application/trainer/contract-execution'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده، وله سطرٌ ثانٍ.'
/* وعقدٌ بلا شرطٍ على مدرّبٍ نشط: بندٌ يُوثَّق على ملفٍّ حيّ، ولا مهلةَ فيه */
const ACKS = contractAcks(false).map((a) => a.key)

const SIGNER = {
  addressAr: 'عمّان — الدوّار السابع، بناية ١٢',
  phone: '+962790000000',
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0 (اختبار)',
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register('mc-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** مدرّبٌ له حسابٌ وملفٌّ وعقدٌ يمرّ بالمسار الحقيقيّ: يُركَّب ثمّ يُرسَل
    ثمّ يوقّعه هو من رمزه ثمّ يُختَم — فتُكتب أعمدةُ الخَتم بشيفرة الإنتاج. */
async function mkTrainer(opts: { sign?: boolean; countersign?: boolean } = {}) {
  seq += 1
  const email = `mc-${seq}-${Date.now()}@test.local`
  const pass = 'Trainer#12345'
  const user = await auth.register(email, pass, `مدرّبٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MC-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: false,
    },
  })
  const legalName = `الاسمُ القانونيُّ للمدرّب ${seq}`
  if (opts.sign !== false) {
    const r = await review.sendContract(contract.id, adminId)
    const token = decodeURIComponent(r.signingUrl.split('/c/')[1])
    await review.signContractByToken(token, {
      legalName, addressAr: SIGNER.addressAr, phone: SIGNER.phone,
      bodyHash: sha256(BODY), acks: [...ACKS],
      ip: SIGNER.ip, userAgent: SIGNER.userAgent,
    })
    if (opts.countersign) {
      await review.countersignContract(contract.id, adminId, { noteAr: 'طابقتُ الاسمَ بجواز السفر' })
    }
  }
  const cookie = (await auth.login(email, pass)).token
  return { contract, profile, cookie, legalName, email }
}

const get = (cookie?: string) => app.inject({
  method: 'GET', url: '/api/trainer/me/contract',
  ...(cookie ? { cookies: { [SESSION_COOKIE]: cookie } } : {}),
})

describe('ما حُفظ عن توقيعه يُعاد إليه', () => {
  it('كلُّ عمودٍ من أعمدة الخَتم يخرج في الجواب — لا عنوانٌ فوق فراغ', async () => {
    const t = await mkTrainer({ countersign: true })
    const res = await get(t.cookie)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    /* ولا `toHaveProperty` وحدَها: حقلٌ موجودٌ بقيمة `null` هو العطبُ نفسُه —
       عمودٌ محفوظٌ في القاعدة لا يصل الشاشة. فيُقاس أنّه **غيرُ فارغ**. */
    for (const f of SEAL_FIELDS) {
      expect(body, `لا يُعاد العمود: ${f}`).toHaveProperty(f)
      expect(body[f], `يُعاد فارغا وقد حُفظ: ${f}`).not.toBeNull()
    }
    expect(body.signerLegalName).toBe(t.legalName)
    expect(body.signerAddressAr).toBe(SIGNER.addressAr)
    expect(body.signerPhone).toBe(SIGNER.phone)
    /* والجملُ التي أقرّ بها نصّا لا عددا — وهي ما سُئل عنه: بأيّ الجمل أقرّ؟ */
    expect(Array.isArray(body.consentAcksAr)).toBe(true)
    expect(body.consentAcksAr).toHaveLength(ACKS.length)
    expect(body.consentAcksAr[0]).toHaveProperty('textAr')
  })

  it('والمتنُ يُعاد مجمَّدا كما وُقّع — وبصمتاه متطابقتان', async () => {
    const t = await mkTrainer({ countersign: true })
    const body = (await get(t.cookie)).json()
    expect(body.bodyAr).toBe(BODY)
    expect(body.bodyHash).toBe(sha256(BODY))
    expect(body.signedBodyHash, 'البصمتان تفترقان — فلا يُقال إنّه نصُّه').toBe(body.bodyHash)
  })

  it('واسمُ الطرف الأوّل يُعاد من المصدر الواحد لا يُكتب في الشاشة', async () => {
    const t = await mkTrainer({ countersign: true })
    const body = (await get(t.cookie)).json()
    expect(typeof body.academyLegalNameAr).toBe('string')
    expect(body.academyLegalNameAr.length).toBeGreaterThan(3)
  })
})

describe('وما لا يُقرأ لا يُعاد', () => {
  /* والأعمدةُ مكتوبةٌ في الصفّ فعلا قبل القياس: `signerIp` و`signerUserAgent`
     مرَّا في التوقيع، و`countersignNoteAr` في الختم. فغيابُها عن الجواب
     انتقاءٌ مقصودٌ لا صفٌّ خاوٍ. */
  it('عنوانُ شبكته ومتصفّحُه وملحوظةُ من اعتمده — محفوظةٌ ولا تخرج', async () => {
    const t = await mkTrainer({ countersign: true })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contract.id } })
    expect(row.signerIp, 'العمودُ لم يُكتب — فالقياسُ على لا شيء').toBe(SIGNER.ip)
    expect(row.signerUserAgent, 'العمودُ لم يُكتب — فالقياسُ على لا شيء').toBe(SIGNER.userAgent)
    expect(row.countersignNoteAr, 'العمودُ لم يُكتب — فالقياسُ على لا شيء').toBeTruthy()

    const body = (await get(t.cookie)).json()
    for (const leaked of [
      'signerIp', 'signerUserAgent', 'countersignNoteAr', 'countersignedBy',
      'signerEmail', 'tokenHash', 'tokenExpiresAt', 'terms', 'revokeReasonAr',
    ]) {
      expect(body, `سُرِّب إلى بوّابته: ${leaked}`).not.toHaveProperty(leaked)
    }
  })
})

describe('ولا يُقرأ من هذا الباب عقدُ غيره', () => {
  it('كلُّ مدرّبٍ يقرأ عقدَه هو — والملفُّ من جلسته لا من طلبه', async () => {
    const a = await mkTrainer({ countersign: true })
    const b = await mkTrainer({ countersign: true })
    const forA = (await get(a.cookie)).json()
    const forB = (await get(b.cookie)).json()
    expect(forA.id).toBe(a.contract.id)
    expect(forB.id).toBe(b.contract.id)
    expect(forA.signerLegalName).toBe(a.legalName)
    expect(forB.signerLegalName).toBe(b.legalName)
    expect(forA.id, 'قرأ أحدُهما عقدَ الآخر').not.toBe(forB.id)
  })

  it('والبابُ محروسٌ بصلاحيّة بوّابته — بلا جلسةٍ لا يُفتح', async () => {
    await mkTrainer({ countersign: true })
    expect((await get()).statusCode).toBeGreaterThanOrEqual(401)
    expect((await get()).statusCode).toBeLessThan(404)
  })
})

describe('وما لم يُوقَّع لا سجلَّ تنفيذٍ له', () => {
  /* مسوّدةٌ لم تُرسَل، وعقدٌ أُرسل ولم يُوقَّع: الأوّلُ ليس وثيقةً بعد،
     والثاني يُوقَّع من رابط بريده لا من هنا. */
  it('من لم يوقّع بعدُ يُردّ بصدقٍ لا بصفحةٍ فارغة', async () => {
    const t = await mkTrainer({ sign: false })
    const res = await get(t.cookie)
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code, 'الردُّ لا يسمّي علّتَه').toBe('no_contract')
  })

  it('والموقَّعُ الأحدثُ هو نسختُه — لا الأقدم', async () => {
    const t = await mkTrainer({ countersign: true })
    /* عقدٌ ثانٍ يُوقَّع بعده — ملحقٌ أو بديل، وهو ما يقرؤه اليوم */
    const later = await prisma.trainerContract.create({
      data: {
        profileId: t.profile.id, title: 'ملحقٌ لاحق', status: 'signed', kind: 'annex',
        bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY), signedBodyHash: sha256(BODY),
        signerLegalName: t.legalName, signedAt: new Date(Date.now() + 60_000),
        gatesActivation: false,
      },
    })
    const body = (await get(t.cookie)).json()
    expect(body.id, 'أُعيد الأقدمُ وقد وُقّع بعده غيرُه').toBe(later.id)
    expect(body.kind).toBe('annex')
  })
})
