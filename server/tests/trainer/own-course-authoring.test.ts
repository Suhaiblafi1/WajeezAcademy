/* «خمسةُ أيّامٍ لوضع محاور دوراتك ومصادرها» — وعدٌ في عقدٍ موقَّعٍ لم يكن له باب.

   ═══ العطبُ، وكيف اختفى ═══

   `TrainerChangeService` تامٌّ في جانب المدرّب: `submit` يفحص التأهيلَ
   والحقولَ المحظورةَ وسياسةَ الساعات، و`listMine`، و`withdraw`. **ولم يكن
   لواحدٍ منها مسلكُ HTTP.** وجانبُ الإدارة موصولٌ كاملا — طابورُ مراجعةٍ
   يراجع اقتراحاتٍ لا سبيلَ لمدرّبٍ أن يرسلها.

   وعلّةُ ذلك مكتوبةٌ في `trainer-portal.routes.ts` بتاريخها: «حُذفت هنا
   أربعةُ مساراتٍ بلا شاشة (٨ سبتمبر ٢٠٢٦)… وإرسالُ اقتراحِ تعديلٍ وقائمتُه
   وسحبُه». وكان الحذفُ صحيحا يومَه — «بابٌ بلا شاشةٍ» هو ما تحرسه هذه
   المنصّةُ منذ «المساراتُ الميّتة». ثمّ وعد العقدُ (٢٧ سبتمبر) بما كان
   بابُه مغلقا، ولم يُوصَل.

   ولم يمسكه حارسٌ لأنّ `change-workflow.test.ts` ينادي الخدمةَ مباشرةً ولا
   يمرّ بمسلك — فالخدمةُ خضراءُ والبابُ مغلق. **فهذا الحارسُ يطرق البابَ**:
   `app.inject` لا نداءُ دالّة.

   ═══ والبوّابةُ صارت عن الدورة لا عن المدرّب ═══

   مؤهَّلٌ لدورةٍ لا يستخدمها مسارٌ ولا قالبٌ ولا شعبةٌ ← يُفتح (وذاك ما
   يَعِد به العقد). ومؤهَّلٌ لدورةٍ يتّكئ عليها غيرُه ← تبقى البوّابة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerChangeService } from '../../services/trainer-change.service'
import { CHANGE_TYPES } from '../../services/trainer-change.service'
import { courseBlastRadius } from '../../services/catalog-impact.service'
import {
  CHANGE_TYPE_LABELS_AR, NEEDS_MODULE, TEXT_TYPES, afterValueFor, emptyChangeDraft,
} from '../../../src/application/catalog/change-types'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let changes: TrainerChangeService
let app: FastifyInstance

const STAMP = Date.now()
/** دورةٌ تُخلَق لهذا الملفّ ولا يستخدمها شيء — هي حالُ دورةٍ أُدخلت لمدرّب */
const FRESH = `C-FRESH-${STAMP}`
/** ودورةٌ مبذورةٌ يتّكئ عليها غيرُه — تُتحقَّق حالُها لا تُفترَض */
const USED = 'C-BIZ-101'
/* ودورةٌ **شعبتُها وحدَها** تستخدمها: لا مسارَ ولا قالب. وهي التي تحرس
   النصفَ الثانيَ من الخلوّ — فمن قصر الفحصَ على `entityCount` وحدَه ظنّها
   خاليةً، وفيها متعلّمون. ولا تُلتمَس في البذر: تُخلَق هنا فتكون الحالُ
   مضمونةً لا محظوظة. */
const COHORT_ONLY = `C-COHORT-${STAMP}`

let trainerCookie = ''
let trainerProfileId = ''
let otherCookie = ''

/** مدرّبٌ في طور الموادّ: حسابٌ بدوره، وطلبٌ `onboarding`، وملفٌّ موصول */
async function makeMaterialsPhaseTrainer(slug: string) {
  const email = `${slug}-${STAMP}@test.local`
  const password = 'Author#12345'
  const u = await auth.register(email, password, 'trainer')
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `REF-${slug}-${STAMP}`, email, fullName: `مدرّبُ ${slug}`,
      status: 'onboarding', updatedAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: u.userId },
  })
  const { token } = await auth.login(email, password)
  return { cookie: `${SESSION_COOKIE}=${token}`, profileId: profile.id, userId: u.userId }
}

async function qualify(profileId: string, courseId: string) {
  await prisma.trainerCourseQualification.upsert({
    where: { profileId_courseId: { profileId, courseId } },
    update: { status: 'qualified' },
    create: { profileId, courseId, status: 'qualified' },
  })
}

const MODULE_ITEM = {
  changeType: 'module_add',
  targetKey: `${FRESH}-M1`,
  afterValue: { titleAr: 'المحورُ الأوّل — تأسيسٌ عمليّ', sequence: 1 },
}
const REASON = 'أضع محاورَ دورتي في طور الموادّ كما يقتضي العقد'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  changes = new TrainerChangeService(prisma)
  app = await buildApp(prisma)
  await app.ready()

  /* دورةٌ خالية: تُخلَق هنا فلا مسارَ ولا قالبَ ولا شعبةَ تصلها */
  await prisma.course.create({
    data: {
      id: FRESH, currentVersion: 1,
      versions: { create: { version: 1, titleAr: 'دورةٌ أُدخلت لمدرّبها', status: 'published', totalHours: 12 } },
    },
  })

  await prisma.course.create({
    data: {
      id: COHORT_ONLY, currentVersion: 1,
      versions: { create: { version: 1, titleAr: 'دورةٌ تستخدمها شعبتُها', status: 'published', totalHours: 8 } },
      cohorts: { create: { title: 'شعبةٌ قائمة' } },
    },
  })

  const t = await makeMaterialsPhaseTrainer('author')
  trainerCookie = t.cookie
  trainerProfileId = t.profileId
  await qualify(trainerProfileId, FRESH)

  const o = await makeMaterialsPhaseTrainer('other')
  otherCookie = o.cookie
}, 240_000)

describe('بابُ اقتراحِ التعديل موجودٌ ويُطرَق', () => {
  it('مقدّمةٌ تُتحقَّق لا تُفترَض: الخاليةُ خاليةٌ والمستخدَمةُ مستخدَمة', async () => {
    const r = await courseBlastRadius(prisma, [FRESH, USED])
    const fresh = r.get(FRESH)!
    expect(fresh.entityCount, 'الدورةُ الخاليةُ صار يستخدمها شيء').toBe(0)
    expect(fresh.cohorts.total).toBe(0)
    const used = r.get(USED)!
    expect(
      used.entityCount + used.cohorts.total,
      'الدورةُ المبذورةُ لم يبقَ يستخدمها شيء — فالحارسُ يقيس حالا أخرى',
    ).toBeGreaterThan(0)
  })

  it('POST /api/trainer/changes موجود — ولا يردّ 404', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/changes', headers: { cookie: trainerCookie },
      payload: { courseId: FRESH, scope: 'catalog', reason: REASON, items: [MODULE_ITEM] },
    })
    expect(
      res.statusCode,
      `البابُ لم يُفتح: ${res.statusCode} — ${res.body.slice(0, 200)}`,
    ).toBeLessThan(300)
    const body = res.json()
    expect(body.scope).toBe('catalog')
    expect(body.courseId).toBe(FRESH)
    expect(body.status).toBe('submitted')
  })

  it('والصفُّ كُتب فعلا بعنصره — لا ردٌّ بلا أثر', async () => {
    const row = await prisma.trainerChangeRequest.findFirst({
      where: { profileId: trainerProfileId, courseId: FRESH },
      include: { items: true },
    })
    expect(row, 'لا صفَّ في القاعدة وقد ردّ المسلكُ نجاحا').not.toBeNull()
    expect(row!.items).toHaveLength(1)
    expect(row!.items[0]!.changeType).toBe('module_add')
  })

  it('GET /api/trainer/changes يسرد اقتراحاتي', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/trainer/changes', headers: { cookie: trainerCookie },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json()
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.some((r: { courseId: string }) => r.courseId === FRESH)).toBe(true)
  })

  it('والسحبُ بابُه مفتوحٌ لصاحبه وحدَه', async () => {
    const mine = await prisma.trainerChangeRequest.findFirstOrThrow({
      where: { profileId: trainerProfileId, courseId: FRESH },
    })
    const byOther = await app.inject({
      method: 'POST', url: `/api/trainer/changes/${mine.id}/withdraw`,
      headers: { cookie: otherCookie },
    })
    expect(byOther.statusCode, 'سحب غيرُ صاحبه اقتراحَه').toBe(404)

    const res = await app.inject({
      method: 'POST', url: `/api/trainer/changes/${mine.id}/withdraw`,
      headers: { cookie: trainerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('withdrawn')
  })
})

describe('والبوّابةُ عن الدورة لا عن المدرّب', () => {
  it('دورةٌ يتّكئ عليها غيرُه: تبقى مردودةً بسببها', async () => {
    await qualify(trainerProfileId, USED)
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/changes', headers: { cookie: trainerCookie },
      payload: {
        courseId: USED, scope: 'catalog', reason: REASON,
        items: [{ changeType: 'module_add', targetKey: `${USED}-MX`, afterValue: { titleAr: 'محور', sequence: 9 } }],
      },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatch(/سجل مثبت|منح صريح/)
  })

  it('ودورةٌ لا يستخدمها إلّا شعبةٌ: تُردّ — فالخلوُّ ليس عدَّ كياناتٍ وحدَه', async () => {
    const r = await courseBlastRadius(prisma, [COHORT_ONLY])
    const row = r.get(COHORT_ONLY)!
    expect(row.entityCount, 'صار لها مسارٌ أو قالب، فالحارسُ يقيس حالا أخرى').toBe(0)
    expect(row.cohorts.total, 'ذهبت شعبتُها').toBeGreaterThan(0)

    await qualify(trainerProfileId, COHORT_ONLY)
    expect((await changes.catalogScopeForCourse(trainerProfileId, COHORT_ONLY)).allowed).toBe(false)

    const res = await app.inject({
      method: 'POST', url: '/api/trainer/changes', headers: { cookie: trainerCookie },
      payload: {
        courseId: COHORT_ONLY, scope: 'catalog', reason: REASON,
        items: [{ changeType: 'module_add', afterValue: { titleAr: 'محورٌ في دورةٍ لها شعبة' } }],
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('وغيرُ المؤهَّلِ لدورةٍ خاليةٍ يُردّ — الخلوُّ وحدَه ليس إذنا', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/changes', headers: { cookie: otherCookie },
      payload: { courseId: FRESH, scope: 'catalog', reason: REASON, items: [MODULE_ITEM] },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatch(/مؤهل|مسندة/)
  })

  it('والحكمُ نفسُه من الخدمة مباشرةً — فلا يفترقُ المسلكُ عنها', async () => {
    expect((await changes.catalogScopeForCourse(trainerProfileId, FRESH)).basis).toBe('qualified_unused')
    expect((await changes.catalogScopeForCourse(trainerProfileId, USED)).allowed).toBe(false)
  })
})

/* ولمَ حارسٌ للاتّفاق لا ثقةٌ في الانتباه: القائمةُ في الخادم والمعجمُ في
   الطبقة المشتركة، ولا مُصرِّفٌ يربطهما — فالفجوةُ تظهر للمدرّبِ وحدَه:
   رمزٌ لاتينيٌّ في شاشته، أو بابٌ يُعرَض عليه ويردُّه الخادم. */
describe('معجمُ أنواعِ التغيير والقائمةُ لا يفترقان', () => {
  it('لكلّ نوعٍ في الخادم اسمٌ عربيٌّ — فلا رمزَ لاتينيٌّ يُعرَض للمدرّب', () => {
    const unnamed = CHANGE_TYPES.filter((t) => CHANGE_TYPE_LABELS_AR[t] == null)
    expect(unnamed, `أنواعٌ بلا اسمٍ عربيّ: ${unnamed.join(' · ')}`).toEqual([])
  })

  it('ولا اسمَ لنوعٍ لا تقبله الخدمة — فلا بابٌ يُعرَض ثمّ يُردّ', () => {
    const known = new Set<string>(CHANGE_TYPES)
    const stray = Object.keys(CHANGE_TYPE_LABELS_AR).filter((k) => !known.has(k))
    expect(stray, `أسماءٌ لأنواعٍ لا وجودَ لها: ${stray.join(' · ')}`).toEqual([])
  })
})

/* ══════════ وأنّ ما يُرسَل يُطبَّق فعلا ══════════

   أخطرُ ما في هذا الباب ليس ردّا صريحا بل **صمتا**: نموذجٌ يبني `afterValue`
   بمفاتيحَ لا يقرؤها `publishToCatalog`، فيمرّ الاقتراحُ بالمراجعة ويُعتمَد
   ويُنشَر — **ولا يتغيّر في الدورة حرف**. والمدرّبُ يرى «نُشر في الدورة» ثمّ
   لا يجد محورَه. والردُّ يُقرأ، والصمتُ لا.

   فلا يكفي أن تُقابَل المفاتيحُ بقائمةٍ مكتوبةٍ بيدي — القائمةُ قد تكذب مثلَ
   النموذج. والسلسلةُ كلُّها تُشتغَل: نموذجُ الشاشة ← المسلك ← قرارُ المراجع ←
   النشر ← ثمّ **تُقرأ الدورةُ من القاعدة** ويُسأل: أوجدتَ ما وضعه؟ */
describe('وما بناه النموذجُ يصل إلى الدورة نفسِها', () => {
  const STAMP2 = `${STAMP}-e2e`
  const COURSE = `C-E2E-${STAMP2}`
  let checkerId = ''
  let profileId = ''
  let cookie = ''

  beforeAll(async () => {
    await prisma.course.create({
      data: {
        id: COURSE, currentVersion: 1,
        versions: { create: { version: 1, titleAr: 'دورةُ الطرَف إلى الطرَف', status: 'published', totalHours: 10 } },
      },
    })
    const t = await makeMaterialsPhaseTrainer('e2e')
    profileId = t.profileId
    cookie = t.cookie
    await qualify(profileId, COURSE)
    const c = await auth.register(`checker-${STAMP2}@test.local`, 'Checker#12345', 'مدير أكاديمي')
    await auth.setRoles(c.userId, ['academic_manager'])
    checkerId = c.userId
  }, 120_000)

  /** يمرّ باقتراحٍ من إرساله إلى نشره، ويردّ معرّفَه */
  async function throughTheWholeChain(items: unknown[], reason: string) {
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/changes', headers: { cookie },
      payload: { courseId: COURSE, scope: 'catalog', reason, items },
    })
    expect(res.statusCode, `الإرسالُ سقط: ${res.body.slice(0, 250)}`).toBe(201)
    const id = res.json().id as string
    await changes.decide(id, checkerId, 'approve_for_catalog', 'معتمَد')
    /* بوّابةُ ب-٢ تشترط فحصَ أثرٍ بعد الاعتماد — تُستوفى لا تُلتفّ عليها */
    await prisma.impactAnalysisRun.create({
      data: { changeRef: TrainerChangeService.impactRef(id), summary: { note: 'فحصٌ في الاختبار' } },
    })
    await changes.publish(id, checkerId)
    return id
  }

  it('«إضافةُ محور» تصير محورا في الدورة بعنوانه — وهو وعدُ العقد بحرفه', async () => {
    const d = { ...emptyChangeDraft(), changeType: 'module_add', titleAr: 'المحورُ الأوّلُ الذي وضعتُه', hours: '3' }
    await throughTheWholeChain(
      [{ changeType: d.changeType, afterValue: afterValueFor(d) }],
      'أضعُ أوّلَ محاورِ دورتي في طور الموادّ',
    )
    const mods = await prisma.courseModule.findMany({
      where: { courseId: COURSE },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    const titles = mods.map((m) => m.versions[0]?.titleAr)
    expect(titles, 'المحورُ لم يصل الدورةَ وقد نُشر الاقتراح').toContain('المحورُ الأوّلُ الذي وضعتُه')
  })

  it('و«إضافةُ مصدر» تصل نصَّها إلى المحور — وهي «ومصادرها» في العقد', async () => {
    const target = (await prisma.courseModule.findFirstOrThrow({ where: { courseId: COURSE } })).id
    const d = { ...emptyChangeDraft(), changeType: 'material_add', targetKey: target, text: 'مصدرٌ وضعتُه بنفسي' }
    await throughTheWholeChain(
      [{ changeType: d.changeType, targetKey: target, afterValue: afterValueFor(d) }],
      'أضيفُ مصدرا إلى محوري كما يقتضي العقد',
    )
    const m = await prisma.courseModule.findUniqueOrThrow({
      where: { id: target },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    expect(m.versions[0]?.activityAr ?? '', 'نصُّ المصدرِ لم يصل المحورَ').toContain('مصدرٌ وضعتُه بنفسي')
  })

  it('و«اقتراحُ مدّة» يبدّل مجموعَ ساعاتِ الدورة', async () => {
    const d = { ...emptyChangeDraft(), changeType: 'duration_propose', hours: '18' }
    await throughTheWholeChain(
      [{ changeType: d.changeType, afterValue: afterValueFor(d) }],
      'أقترحُ مدّةً تناسب ما وضعتُه من محاور',
    )
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: COURSE },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    expect(course.versions[0]?.totalHours, 'المدّةُ لم تتبدّل وقد نُشر الاقتراح').toBe(18)
  })

  it('ومفاتيحُ كلِّ نوعٍ ليست فارغةً — فلا نوعٌ يُرسَل بحمولةٍ خالية', () => {
    for (const t of CHANGE_TYPES) {
      const d = { ...emptyChangeDraft(), changeType: t, titleAr: 'عنوان', text: 'نصّ', hours: '4', order: ['a', 'b'] }
      const keys = Object.keys(afterValueFor(d))
      expect(keys.length, `النوعُ ${t} يُبنى بحمولةٍ خالية`).toBeGreaterThan(0)
    }
  })

  it('وكلُّ نوعٍ يحتاج محورا هو من الثمانية النصّيّة أو تعديلُ عنوان — فلا ثالثَ يُنسى', () => {
    for (const t of NEEDS_MODULE) {
      expect(
        TEXT_TYPES.has(t) || t === 'module_title_edit',
        `النوعُ ${t} يحتاج محورا ولا يُعرَف شكلُه في النموذج`,
      ).toBe(true)
    }
  })
})
