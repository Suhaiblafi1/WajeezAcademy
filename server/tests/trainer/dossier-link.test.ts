/* رابطُ سجلِّ المتقدّم — يُقرأ بلا حساب، ولا يحمل ما يُتّصل به.

   ═══ ما يحرسه هذا الملفّ ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) أن يُرسَل الملفُّ رابطا بين الفريق بدل
   ورقةٍ تُطبع. وطُلب أوّلا رابطٌ **عامٌّ** يفتحه كلُّ من وصله، فعُدل عنه إلى
   رابطٍ باسمِ قارئٍ بعينه — لأنّ الملفَّ يحمل إنسانا ائتمنَنا على بياناته.

   فأخطرُ ما يمكن أن يقع هنا **تسريبٌ صامت**: حقلٌ يُضاف إلى `TrainerApplication`
   بعد سنةٍ فيخرج مع الردّ بلا أن يحمرّ شيء. ولذلك الحارسُ الأوّلُ **مسحٌ عميقٌ
   للردّ كلِّه** لا فحصُ حقلٍ حقلا: يبحث عن بريد المتقدّم وهاتفه في أيّ عمقٍ
   وتحت أيّ مفتاح. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let svc: TrainerDossierLinkService
let applicationId = ''
let adminId = ''
let adminCookie = ''

/* قيمٌ لا تتشابه مع شيءٍ آخرَ في الردّ — فظهورُها ظهورُها هي لا مصادفة */
const SECRET_EMAIL = 'redaction-probe-9f3a@secret.invalid'
const SECRET_PHONE = '790654321'
const SECRET_CC = '+962'
const SECRET_ALT = 'alt-probe-9f3a@secret.invalid'
const REFEREE_CONTACT = 'referee-probe-9f3a@secret.invalid'

/** كلُّ نصٍّ في البنية مهما عمُق — لا مفاتيحُ الجذر وحدَها */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) allStrings(x, out)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out)
  return out
}

async function newLink(overrides: { expiresAt?: Date } = {}) {
  const { url } = await svc.create(applicationId, adminId, { reviewerName: 'قارئُ الاختبار' })
  const token = url.split('/r/')[1]
  if (overrides.expiresAt) {
    await prisma.trainerDossierLink.update({
      where: { tokenHash: (await import('node:crypto')).createHash('sha256').update(token).digest('hex') },
      data: { expiresAt: overrides.expiresAt },
    })
  }
  return token
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  svc = new TrainerDossierLinkService(prisma)

  const auth = new AuthService(prisma)
  const admin = await auth.register('dossier-link-admin@test.local', 'Admin#12345', 'المديرُ الأكاديميّ')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const { token } = await auth.login('dossier-link-admin@test.local', 'Admin#12345')
  adminCookie = `${SESSION_COOKIE}=${token}`

  const created = await prisma.trainerApplication.create({
    data: {
      reference: 'WJ-TR-2026-90001', status: 'interview_scheduled',
      fullName: 'متقدّمُ اختبارِ الحجب', email: SECRET_EMAIL,
      phoneCountryCode: SECRET_CC, phone: SECRET_PHONE, contactAltEmail: SECRET_ALT,
      contactChannel: 'other_email', country: 'الأردن', jobTitle: 'محلّلُ بيانات',
      domainYears: '8-12', trainingYears: 'formal_teaching', bio: 'نبذةٌ للاختبار',
      motivation: 'دافعٌ للاختبار', emailVerifiedAt: new Date(),
      references: { create: { name: 'مُزكٍّ للاختبار', relation: 'مدير', contact: REFEREE_CONTACT, note: 'ملاحظةٌ' } },
    },
  })
  applicationId = created.id
}, 240_000)

describe('الحجب: الردُّ لا يحمل ما يُتّصل به', () => {
  it('⚠ لا بريدَ ولا هاتفَ في أيّ عمقٍ من الردّ — مسحٌ للبنية كلِّها', async () => {
    const token = await newLink()
    const res = await app.inject({ method: 'GET', url: `/api/r/${token}` })
    expect(res.statusCode).toBe(200)

    const texts = allStrings(res.json())
    /* لا يُفحص حقلٌ بعينه: حقلٌ يُضاف غدا يجب أن يسقط الحارسُ عليه وحدَه */
    for (const secret of [SECRET_EMAIL, SECRET_PHONE, SECRET_ALT, REFEREE_CONTACT]) {
      const leaked = texts.filter((t) => t.includes(secret))
      expect(leaked, `تسرّب «${secret}» إلى الصفحة المشتركة: ${leaked.join(' | ')}`).toEqual([])
    }
  })

  it('ومع ذلك يصل القارئَ ما يُقيَّم به', async () => {
    const token = await newLink()
    const body = (await app.inject({ method: 'GET', url: `/api/r/${token}` })).json()
    expect(body.application.fullName).toBe('متقدّمُ اختبارِ الحجب')
    expect(body.application.reference).toBe('WJ-TR-2026-90001')
    expect(body.application.motivation).toBe('دافعٌ للاختبار')
    /* «تحقّق من بريده» يُقال بلا أن يُقال ما هو */
    expect(body.application.emailVerifiedAt).toBeTruthy()
    expect(body.reviewer.name).toBe('قارئُ الاختبار')
    /* واسمُ المُزكّي يصل وملاحظتُه — وهاتفُه لا */
    expect(body.application.references[0].name).toBe('مُزكٍّ للاختبار')
  })

  it('ولا بايتاتِ وثيقةٍ في الردّ — الوثيقةُ تُقرأ برابطها الموقَّع', async () => {
    await prisma.trainerApplicationDocument.create({
      data: {
        applicationId, kind: 'cv', storageKey: 'probe/cv-9f3a.pdf', originalName: 'سيرة.pdf',
        mime: 'application/pdf', sizeBytes: 4, content: Buffer.from('ANNE'),
      },
    })
    const token = await newLink()
    const body = (await app.inject({ method: 'GET', url: `/api/r/${token}` })).json()
    expect(body.application.documents).toHaveLength(1)
    expect(body.application.documents[0]).not.toHaveProperty('content')
    expect(JSON.stringify(body)).not.toContain('ANNE')
    /* ويصل الرابطُ الموقَّع بدله */
    expect(body.documentUrls['probe/cv-9f3a.pdf']).toContain('sig=')
  })
})

describe('دورةُ حياةِ الرابط', () => {
  it('يُفتح فيُسجَّل أوّلُ فتحٍ وآخرُه', async () => {
    const token = await newLink()
    await app.inject({ method: 'GET', url: `/api/r/${token}` })
    const row = await prisma.trainerDossierLink.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
    expect(row!.firstOpenedAt).toBeTruthy()
    expect(row!.lastOpenedAt).toBeTruthy()
  })

  it('يُحفَظ فيه التقييمُ ويعود في الفتحة التالية', async () => {
    const token = await newLink()
    const save = await app.inject({
      method: 'PUT', url: `/api/r/${token}/review`,
      payload: { scores: { domain_expertise: 4, values_fit: 5 }, overallNote: 'مرشّحٌ واعد', verdict: 'passed', coursesNote: 'يراجع دوراته' },
    })
    expect(save.statusCode).toBe(200)

    const body = (await app.inject({ method: 'GET', url: `/api/r/${token}` })).json()
    expect(body.myReview.scores).toEqual({ domain_expertise: 4, values_fit: 5 })
    expect(body.myReview.verdict).toBe('passed')
    expect(body.myReview.coursesNote).toBe('يراجع دوراته')
  })

  it('⚠ والحفظُ الثاني يعدّل ولا يُنشئ صفّا ثانيا — تقييمٌ واحدٌ لكلّ قارئ', async () => {
    const token = await newLink()
    const link = await prisma.trainerDossierLink.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
    for (const v of [3, 5]) {
      const r = await app.inject({ method: 'PUT', url: `/api/r/${token}/review`, payload: { scores: { domain_expertise: v } } })
      expect(r.statusCode).toBe(200)
    }
    const rows = await prisma.trainerApplicationReview.findMany({ where: { linkId: link!.id } })
    expect(rows).toHaveLength(1)
    expect((rows[0].scores as Record<string, number>).domain_expertise).toBe(5)
  })

  it('والقارئُ لا يرى تقييمَ زميله — وإلّا لم يعد رأيُه رأيَه', async () => {
    const mine = await newLink()
    const other = await newLink()
    await app.inject({ method: 'PUT', url: `/api/r/${other}/review`, payload: { scores: { values_fit: 1 }, overallNote: 'رأيُ زميلٍ آخر' } })

    const body = (await app.inject({ method: 'GET', url: `/api/r/${mine}` })).json()
    expect(body.myReview).toBeNull()
    expect(JSON.stringify(body)).not.toContain('رأيُ زميلٍ آخر')
  })

  it('الملغى لا يُفتح ولا يكتب', async () => {
    const token = await newLink()
    const link = await prisma.trainerDossierLink.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
    await svc.revoke(applicationId, link!.id, adminId)

    expect((await app.inject({ method: 'GET', url: `/api/r/${token}` })).statusCode).toBe(401)
    const w = await app.inject({ method: 'PUT', url: `/api/r/${token}/review`, payload: { scores: { values_fit: 3 } } })
    expect(w.statusCode).toBe(401)
  })

  it('والمنتهي أجلُه كذلك', async () => {
    const token = await newLink({ expiresAt: new Date(Date.now() - 1000) })
    expect((await app.inject({ method: 'GET', url: `/api/r/${token}` })).statusCode).toBe(401)
  })

  it('⚠ ورسالةُ الردّ واحدةٌ للمنتهي والملغى والمجهول — فرقٌ فيها يخبر الفضوليَّ أنّ رمزَه كان صحيحا', async () => {
    const expired = await newLink({ expiresAt: new Date(Date.now() - 1000) })

    const revokedToken = await newLink()
    const link = await prisma.trainerDossierLink.findFirst({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
    await svc.revoke(applicationId, link!.id, adminId)

    const bodies = await Promise.all(
      [expired, revokedToken, 'ZZZZ-lا-وجودَ-له-abcdefghijklmnop'].map(async (t) =>
        (await app.inject({ method: 'GET', url: `/api/r/${encodeURIComponent(t)}` })).body),
    )
    expect(new Set(bodies).size, `اختلفت الردود: ${bodies.join(' ‖ ')}`).toBe(1)
  })
})

describe('الروبرك في الصفحة المشتركة', () => {
  it('الناقصُ يُقبل — ومن حفظ نصفَ الورقة لا يُردّ حفظُه', async () => {
    const token = await newLink()
    const r = await app.inject({ method: 'PUT', url: `/api/r/${token}/review`, payload: { scores: { domain_expertise: 4 } } })
    expect(r.statusCode).toBe(200)
  })

  it('وملاحظةٌ بلا درجاتٍ تُقبل — والتقييمُ يُبدأ بالكتابة أحيانا', async () => {
    const token = await newLink()
    const r = await app.inject({ method: 'PUT', url: `/api/r/${token}/review`, payload: { overallNote: 'انطباعٌ أوّليّ' } })
    expect(r.statusCode).toBe(200)
  })

  it('⚠ والخارجُ عن المدى والمفتاحُ المجهولُ يُرَدّان', async () => {
    const token = await newLink()
    for (const scores of [{ domain_expertise: 9 }, { domain_expertise: 0 }, { domain_expertize: 4 }]) {
      const r = await app.inject({ method: 'PUT', url: `/api/r/${token}/review`, payload: { scores } })
      /* ٤٢٢ من حاجز zod، و٤٠٠ لو ردّته الخدمةُ — والمقصودُ أنّه رُدّ، لا أيُّهما */
      expect([400, 422], `قُبل ما لا يصحّ: ${JSON.stringify(scores)} (${r.statusCode})`).toContain(r.statusCode)
    }
  })
})

/* ═══ بابُ الإدارة: يُنشئ ويسرد ويُلغي ═══

   والرمزُ يُردّ **مرّةً واحدةً عند الإنشاء**: لا يُحفظ منه إلّا هاشُه، فلا
   سبيلَ إلى إظهاره في السرد ولو أردنا. وحارسُه أنّ السردَ لا يحمله. */
describe('روابطُ القُرّاء من شاشة الإدارة', () => {
  it('تُنشأ فتُردّ مرّةً، وتُسرد بحالها، وتُلغى', async () => {
    const made = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${applicationId}/dossier-links`,
      headers: { cookie: adminCookie }, payload: { reviewerName: 'قارئٌ من الشاشة' },
    })
    expect(made.statusCode).toBe(201)
    const { url, link } = made.json() as { url: string; link: { id: string } }
    expect(url).toContain('/r/')

    const listed = await app.inject({
      method: 'GET', url: `/api/admin/trainer-applications/${applicationId}/dossier-links`,
      headers: { cookie: adminCookie },
    })
    expect(listed.statusCode).toBe(200)
    const rows = listed.json() as { id: string; reviewerName: string }[]
    expect(rows.some((r) => r.id === link.id)).toBe(true)

    /* ⚠ ولا رمزَ ولا هاشَ في السرد — من فتح الشاشةَ لا يحوز روابطَ غيره */
    const body = listed.body
    expect(body, 'تسرّب الرمزُ إلى السرد').not.toContain(url.split('/r/')[1])
    expect(body, 'تسرّب الهاشُ إلى السرد').not.toContain('tokenHash')

    const gone = await app.inject({
      method: 'DELETE', url: `/api/admin/trainer-applications/${applicationId}/dossier-links/${link.id}`,
      headers: { cookie: adminCookie },
    })
    expect(gone.statusCode).toBe(200)

    /* وبعد الإلغاء لا يُفتح */
    const token = url.split('/r/')[1]
    expect((await app.inject({ method: 'GET', url: `/api/r/${token}` })).statusCode).toBe(401)
  })

  it('ولا يُنشئها من لا جلسةَ له', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/trainer-applications/${applicationId}/dossier-links`,
      payload: { reviewerName: 'دخيل' },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(401)
    expect(res.statusCode).toBeLessThan(404)
  })
})

/* ═══ المرحلةُ الثالثة: الرابطُ يُرسَل، ولا يصل صاحبَ الملفّ ═══

   بريدُ القارئ يحمل رابطَه بدل مرفَق PDF. والإرسالُ **في لحظة الإنشاء أو
   لا يقع أبدا**: الرمزُ لا يُحفظ — هاشُه وحدَه — فليس في الخادم ما يُرسَل
   بعدها. ومن ظنّ خلافَ ذلك بنى زرَّ «أعِد الإرسال» على لا شيء.

   ولا يصل الرابطُ المتقدّمَ: فيه تقييمُنا له، ورسالةٌ واحدةٌ تُوجَّه خطأً
   تُسلّمه أسبابَ رفضه بخطّ أيدينا (مسجَّلةٌ مخاطرةً في التصميم). */
describe('إرسالُ الرابط بالبريد', () => {
  it('⚠️ بريدُ المتقدّم نفسِه يُردّ — ولا يُنشأ رابطٌ أصلا', async () => {
    const before = await svc.list(applicationId)
    await expect(
      svc.create(applicationId, adminId, { reviewerName: 'خطأٌ في اللصق', reviewerEmail: SECRET_EMAIL }),
    ).rejects.toThrow(/المتقدّم/)
    /* ولا يُترك رابطٌ معلَّقٌ من محاولةٍ مردودة */
    expect((await svc.list(applicationId)).length).toBe(before.length)
  })

  it('وبحرفٍ كبيرٍ أو بمسافاتٍ كذلك — المطابقةُ على البريد لا على صورته', async () => {
    await expect(
      svc.create(applicationId, adminId, { reviewerName: 'خطأٌ آخر', reviewerEmail: `  ${SECRET_EMAIL.toUpperCase()} ` }),
    ).rejects.toThrow(/المتقدّم/)
  })

  it('وبلا طلبِ إرسالٍ لا يُرسَل شيءٌ — واللصقُ بيدِ الأدمن يبقى الأصل', async () => {
    const made = await svc.create(applicationId, adminId, {
      reviewerName: 'قارئٌ بلا إرسال', reviewerEmail: 'reader-quiet@test.local',
    })
    expect(made.emailDelivery, 'أُرسل بريدٌ لم يُطلَب').toBeNull()
    expect(made.url).toContain('/r/')
  })

  it('وحين يُطلب يُقال ما جرى — ولا يُفترض النجاح', async () => {
    const made = await svc.create(applicationId, adminId, {
      reviewerName: 'قارئٌ يُرسَل إليه', reviewerEmail: 'reader-sent@test.local', sendEmail: true,
    })
    /* البريدُ غيرُ مهيّأ في الاختبار، فالحالةُ `not_configured` لا `sent` —
       والمقيسُ أنّ الحالةَ **تُقال**، فمن بنى «أُرسل» على مجرّد الإنشاء كذب. */
    expect(made.emailDelivery, 'لا تُقال حالةُ الإرسال').not.toBeNull()
    expect(made.url).toContain('/r/')
  })

  it('ولا يُرسَل بلا بريدٍ ولو طُلب', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ بلا بريد', sendEmail: true })
    expect(made.emailDelivery).toBeNull()
  })
})

/* ═══ تجديدُ الرابط: رمزٌ جديدٌ على الصفّ نفسِه (١٤ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أريد أن أتمكّن من إعادة نسخِ الرابط للمفعَّلين بدلا من
   إنشاء جديد». ونسخُ القديمِ مستحيلٌ بنيةً: `sha256` طريقٌ واحد.

   فالذي يزعجه ليس الحرفَ القديم بل **الصفَّ الثاني**: قارئٌ واحدٌ بسطرَين
   وتقييمُه ينقسم بينهما. والتجديدُ يُبدّل الرمزَ على الصفّ نفسِه.

   ═══ وأثمنُ ما يُحرَس هنا ═══

   **أنّ التقييمَ يبقى.** فهو معلَّقٌ بـ`linkId` — بمعرّف الصفّ لا بالرمز. ولو
   أُنشئ صفٌّ جديدٌ بدل التجديد لبدأ القارئُ من بياضٍ وبقي تقييمُه الأوّلُ
   معلَّقا بصفٍّ لا يفتحه أحد. وهذا هو الفرقُ كلُّه بين الحلَّين، ولا يظهر
   إلّا بقارئٍ كتب ثمّ جُدِّد رابطُه. */
describe('تجديدُ رابط القارئ', () => {
  it('⚠️ القديمُ يموت والجديدُ يعمل — وهما على صفٍّ واحد', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ يُجدَّد' })
    const oldToken = made.url.split('/r/')[1]
    expect((await app.inject({ method: 'GET', url: `/api/r/${oldToken}` })).statusCode).toBe(200)

    const again = await svc.rotate(applicationId, made.link.id, adminId)
    const newToken = again.url.split('/r/')[1]

    expect(newToken, 'الرمزُ لم يتغيّر').not.toBe(oldToken)
    expect(again.link.id, 'أُنشئ صفٌّ ثانٍ بدل التجديد').toBe(made.link.id)
    expect((await app.inject({ method: 'GET', url: `/api/r/${oldToken}` })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: `/api/r/${newToken}` })).statusCode).toBe(200)
  })

  it('⚠️ وتقييمُه المكتوبُ يبقى — وهو العلّةُ التي لأجلها جُدِّد ولم يُنشأ جديد', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ كتب ثمّ جُدِّد' })
    const first = made.url.split('/r/')[1]
    await svc.saveReview(first, {
      scores: { domain_expertise: 5 }, overallNote: 'ملاحظةٌ كُتبت قبل التجديد',
    })

    const again = await svc.rotate(applicationId, made.link.id, adminId)
    const view = await svc.view(again.url.split('/r/')[1])

    expect(view.myReview, 'ضاع تقييمُه بالتجديد').not.toBeNull()
    expect(view.myReview?.overallNote).toBe('ملاحظةٌ كُتبت قبل التجديد')
    expect(view.reviewer.name).toBe('قارئٌ كتب ثمّ جُدِّد')
  })

  it('وسجلُّ فتحه يبقى — تاريخُه لا يُمحى لأنّ رابطَه بُدِّل', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ فتح ثمّ جُدِّد' })
    await svc.view(made.url.split('/r/')[1])
    const opened = await prisma.trainerDossierLink.findUnique({ where: { id: made.link.id } })
    expect(opened!.firstOpenedAt).not.toBeNull()

    await svc.rotate(applicationId, made.link.id, adminId)
    const after = await prisma.trainerDossierLink.findUnique({ where: { id: made.link.id } })
    expect(after!.firstOpenedAt, 'مُحي سجلُّ فتحه').toEqual(opened!.firstOpenedAt)
  })

  it('⚠️ والمنتهي أجلُه يُجدَّد فيعود صالحا — وهو أكثرُ ما يُجدَّد له', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ انتهى أجلُه' })
    await prisma.trainerDossierLink.update({
      where: { id: made.link.id }, data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect((await app.inject({ method: 'GET', url: `/api/r/${made.url.split('/r/')[1]}` })).statusCode).toBe(401)

    const again = await svc.rotate(applicationId, made.link.id, adminId)
    expect(again.link.expiresAt.getTime(), 'لم يُجدَّد الأجل').toBeGreaterThan(Date.now())
    expect((await app.inject({ method: 'GET', url: `/api/r/${again.url.split('/r/')[1]}` })).statusCode).toBe(200)
  })

  it('⚠️ والملغى لا يُجدَّد — الإلغاءُ قرارٌ لا يُلتفّ حوله بزرّ', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئٌ أُلغي' })
    await svc.revoke(applicationId, made.link.id, adminId)
    await expect(svc.rotate(applicationId, made.link.id, adminId)).rejects.toThrow(/ملغى/)
    /* ولا يُبعث الرابطُ القديمُ بمحاولةٍ مردودة */
    expect((await app.inject({ method: 'GET', url: `/api/r/${made.url.split('/r/')[1]}` })).statusCode).toBe(401)
  })

  it('ورابطٌ من طلبٍ آخرَ لا يُجدَّد من هنا', async () => {
    const other = await prisma.trainerApplication.create({
      data: { reference: `WJ-TR-OTHER-${Date.now()}`, fullName: 'طلبٌ آخر', email: `other-${Date.now()}@test.local`, status: 'submitted' },
    })
    const made = await svc.create(other.id, adminId, { reviewerName: 'قارئُ طلبٍ آخر' })
    await expect(svc.rotate(applicationId, made.link.id, adminId)).rejects.toThrow(/غير موجود/)
  })

  /* ⚠ ونُقض هذا الحارسُ بحقنِ الرمزِ تحت مفتاحٍ اسمُه `token` فمرّ أخضرَ —
     لأنّ `recordAudit` تمسح كلَّ مفتاحٍ فيه «token» أصلا. فالدفاعُ الأوّلُ
     كان يحجب النقضَ لا الحارسَ. وأُعيد النقضُ تحت مفتاحٍ لا يمسحه المُعقِّم
     (`openAt: '/r/…'`) فسقط — وهو الشكلُ الذي يقع به التسريبُ فعلا: لا
     أحدَ يسمّي المتغيّرَ «token» حين يُسرّبه. */
  it('والأثرُ يُسجَّل ولا يحمل رمزا — لا القديمَ ولا الجديد', async () => {
    const made = await svc.create(applicationId, adminId, { reviewerName: 'قارئُ الأثر' })
    const again = await svc.rotate(applicationId, made.link.id, adminId)
    const trail = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.dossier_link.rotate', entityId: applicationId },
      orderBy: { createdAt: 'desc' },
    })
    expect(trail, 'لا أثرَ للتجديد').not.toBeNull()
    const whole = JSON.stringify(trail!.meta)
    expect(whole).toContain('قارئُ الأثر')
    expect(whole, 'تسرّب الرمزُ الجديدُ إلى الأثر').not.toContain(again.url.split('/r/')[1])
    expect(whole, 'تسرّب الرمزُ القديمُ إلى الأثر').not.toContain(made.url.split('/r/')[1])
  })
})
