/* عقدُ نموذج الانضمام — ما تشترطه الواجهةُ هو ما يشترطه الخادم.

   ── العطبُ الذي فُتح له هذا الحارس ──

   `availability.seasons` كان **اختياريّا في الواجهة إجباريّا في الخادم**:
   `min(1)` في المخطَّط، ولا ذكرَ له في `missing[]`. فزرُّ «أرسل طلب الانضمام»
   يُفعَّل، والنقرُ يردّ ٤٢٢، والطلبُ يبقى `draft` أبدا — بينما حسابُ المتقدّم
   يُنشأ بدور `trainer_applicant`. فيملك حسابا يدخل به ولا يملك طلبا يُنظر فيه،
   ولا شيءَ يقول له ذلك.

   **ولم يمسكه اختبارٌ واحد** لأنّ اختبارات الخادم كلَّها تُثبّت
   `availability: { seasons: [...] }` بيدها — فهي تغذّي بنفسها الحقلَ الذي
   تُسقطه الواجهة. كلُّ طرفٍ يعمل وحدَه بامتياز، والعطبُ في الفراغ بينهما.

   فهذا الحارسُ يقف في ذلك الفراغ: يرسل ما ترسله **الواجهةُ حين يترك المتقدّمُ
   الحقلَ فارغا** — أي `availability` بلا `seasons` — ويشترط أن يُقبل أو
   يُردّ، لا أن يفترق الطرفان في الجواب. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import type { FastifyInstance } from 'fastify'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

let prisma: PrismaClient
let apps: TrainerApplicationService
let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  /* عبر المسار لا الخدمة: الشرطُ `min(1)` في مخطَّط المسار
     (`trainer-applications.routes.ts`)، والخدمةُ تقبل ما يصلها.
     فمن اختبر الخدمةَ وحدَها ظنّ الحقلَ اختياريّا — وهو ما وقع. */
  app = await buildApp(prisma)
}, 240_000)

const phase1 = (email: string) => apps.submitPhase1({
  fullName: 'مرشّحُ عقدِ النموذج', email,
  specialties: ['إدارة المشاريع والعمليات'],
  domainYears: '8-12', trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'remote',
  motivation: 'أريد الانضمام إلى وجيز لأنّني درّبت فرقا حقيقيّة في بيئات عمل عربيّة، وأعرف الفرق بين من يعرف المادّة ومن يستطيع تعليمها. سأقدّم للمتعلّمين مهمّة تطبيقيّة من واقع عملهم في كلّ وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكلّ واحد ما ينقصه تحديدا لا تقييما عامّا.',
  privacyConsent: true, password: 'Contract#12345',
})

describe('ما تشترطه الواجهةُ هو ما يشترطه الخادم', () => {
  /* الواجهةُ ترسل `seasons: seasons.length ? seasons : undefined` — فحين
     يتركه المتقدّمُ فارغا يصل الحقلُ **غائبا** لا فارغا. وهذه هي الحال
     التي كانت تُردّ ٤٢٢ والزرُّ مفعَّل. */
  it('المواسمُ مذكورةٌ في نواقص الواجهة — وإلّا فُعِّل زرٌّ يردّه الخادم', () => {
    const ui = read('src/pages/JoinTrainer.tsx')
    const block = ui.slice(ui.indexOf('const missing = useMemo'), ui.indexOf('const stepValid'))
    expect(
      /seasons\.length\s*===\s*0/.test(block),
      'الخادمُ يشترط `availability.seasons.min(1)`، فإن لم تذكره `missing[]` '
      + 'فُعِّل زرُّ الإرسال على طلبٍ يُردّ ٤٢٢ ويبقى `draft` أبدا.',
    ).toBe(true)
  })

  it('والمجموعةُ موسومةٌ بالنجمة — فلا يُشترط ما لا يُرى أنّه مشروط', () => {
    const ui = read('src/pages/JoinTrainer.tsx')
    const i = ui.indexOf('وفي أي مواسم السنة؟')
    expect(i, 'لم تُوجد مجموعةُ المواسم').toBeGreaterThan(0)
    /* رأسُ الوسم يسبق العنوان: `<FieldSet legend="…" required` */
    const tag = ui.slice(ui.lastIndexOf('<FieldSet', i), ui.indexOf('>', i))
    expect(tag, 'المجموعةُ إجباريّةٌ عند الخادم وبلا نجمةٍ في الشاشة').toContain('required')
  })

  /** القسمُ الثاني كما يرسله المتصفّح — بموسمٍ أو بلا موسم */
  const postPhase2 = (reference: string, candidateToken: string, availability: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/trainer-applications/${encodeURIComponent(reference)}/phase-2`,
      payload: {
        candidateToken, previousCourses: [], teachableCourseIds: [],
        teachableOther: 'دورةٌ يكتبها بقلمه',
        availability, demoConsent: true, contact: { channel: 'email' },
      },
    })

  it('والخادمُ يقبل ما تبنيه الواجهةُ حين يختار المتقدّمُ موسما', async () => {
    const p1 = await phase1(`contract-ok-${Date.now()}@wajeez.test`)
    const res = await postPhase2(p1.reference, p1.candidateToken, { seasons: ['nov_jan'] })
    expect(res.statusCode, res.body).toBeLessThan(300)
    const row = await prisma.trainerApplication.findUnique({ where: { reference: p1.reference } })
    expect(row?.status, 'الطلبُ المكتملُ يجب أن يغادر `draft`').not.toBe('draft')
  })

  it('وبلا موسمٍ يُردّ ٤٢٢ بعربيّةٍ — والطلبُ يبقى `draft` فلا يُظنّ مقدَّما', async () => {
    const p1 = await phase1(`contract-bare-${Date.now()}@wajeez.test`)
    /* `availability` بلا `seasons` — وهو ما كانت ترسله الواجهةُ عند تركِه فارغا */
    const res = await postPhase2(p1.reference, p1.candidateToken, {})
    expect(res.statusCode).toBe(422)
    const msg = res.json().error.message_ar as string
    expect(msg, 'رسالةُ الردّ يجب أن تكون عربيّةً لا نصَّ Zod').not.toContain('Invalid input')
    expect(msg).not.toContain('expected')
    const row = await prisma.trainerApplication.findUnique({ where: { reference: p1.reference } })
    expect(row?.status).toBe('draft')
  })
})

describe('ولا نصَّ إنجليزيٌّ يخرج من مُحقِّق المدخلات', () => {
  it('الغائبُ يُقال «حقلٌ مطلوبٌ لم يصل» لا «expected array, received undefined»', async () => {
    const { errorHandler } = await import('../../http/errors')
    const { z } = await import('zod')
    const schema = z.object({ availability: z.object({ seasons: z.array(z.string()).min(1) }) })
    const err = schema.safeParse({ availability: {} }).error!

    let body: unknown = null
    const reply = { status: () => reply, send: (b: unknown) => { body = b; return reply } }
    errorHandler(err, {} as never, reply as never)

    const msg = (body as { error: { message_ar: string } }).error.message_ar
    expect(msg).toContain('حقلٌ مطلوبٌ لم يصل')
    /* لا حرفَ لاتينيٍّ إلّا في مسار الحقل بين قوسَين — وما عداه عربيّ */
    expect(msg).not.toContain('expected')
    expect(msg).not.toContain('Invalid input')
  })

  it('والرسالةُ العربيّةُ المكتوبةُ في المخطَّط تُقدَّم كما هي', async () => {
    const { errorHandler } = await import('../../http/errors')
    const { z } = await import('zod')
    const schema = z.object({ seasons: z.array(z.string()).min(1, 'اختر فصلا واحدا على الأقلّ تستطيع التدريس فيه') })
    const err = schema.safeParse({ seasons: [] }).error!

    let body: unknown = null
    const reply = { status: () => reply, send: (b: unknown) => { body = b; return reply } }
    errorHandler(err, {} as never, reply as never)
    expect((body as { error: { message_ar: string } }).error.message_ar)
      .toContain('اختر فصلا واحدا على الأقلّ')
  })
})
