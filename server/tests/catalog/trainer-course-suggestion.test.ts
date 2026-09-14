/* «دوراتٌ ليست في كتالوجنا» — من نصٍّ يموت في ملفٍّ إلى بندٍ في طابور.

   ═══ العطبُ الذي كُتب له ═══

   نموذجُ الانضمام يسأل المتقدّمَ عن دوراتٍ يقدر عليها وليست عندنا، ويحفظ
   جوابَه في `teachableOther` نصّا حرّا. ويُعرض في ملفّه، ثمّ **يموت هناك**:
   لا زرَّ يمسّه ولا طابورَ يصل إليه.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «لا يجب أن تكون فقط ملاحظات، وإنّما
   خانةٌ تُعامل وكأنّها نسخةٌ جديدةٌ من دورةٍ تُربط بها، أو دورةٌ جديدةٌ تُربط
   بمهاراتٍ معيّنة».

   ═══ وما يُحرَس ═══

   ١) لا جدولَ ثانيا: المقترحُ `ContentChangeRequest` في الطابور القائم، فلا
      طابورانِ يُنسى أحدُهما.
   ٢) والنسخةُ تُعلَّق على **معرّف الدورة القائمة** — فيقرؤها مؤلّفُها حيث
      يعمل عليها أصلا، لا في ركنٍ آخر.
   ٣) والجديدةُ لا يُخترع لها معرّفٌ كاذبٌ يوهم أنّها في الكتالوج: بادئتُه
      تقول ما هو.
   ٤) وكلامُ المدرّب **بنصّه** في الحمولة مع مرجعِ طلبه — فمن فتحه بعد شهرٍ
      عرف من أين جاء.
   ٥) ولا بريدَ ولا هاتفَ في الحمولة: الطابورُ يُقرأ بعينٍ أوسعَ من عين
      مراجع الطلبات. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'

let prisma: PrismaClient
let admin: CatalogAdminService
let applicationId = ''
let courseId = ''
const ACTOR = '00000000-0000-0000-0000-00000000000a'
const WORDS = 'أستطيع تدريس «تحليل البيانات بـPython» وليست عندكم.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)

  /* صفٌّ مباشرٌ لا نموذجٌ كامل: المقيسُ هنا ما يُقرأ من الطلب لا كيف يُنشأ */
  const app = await prisma.trainerApplication.create({
    data: {
      reference: 'WA-TR-SUG-1', fullName: 'مقترِحُ الدورات', email: 'suggester@test.local',
      status: 'submitted', teachableOther: WORDS,
      teachableProposals: [
        { titleAr: 'تحليلُ البيانات بـPython', audienceAr: 'خرّيجو الهندسة' },
        { titleAr: 'إدارةُ المنتجات للمبتدئين', audienceAr: 'موظّفو التسويق' },
      ],
    },
  })
  applicationId = app.id
  const course = await prisma.course.findFirst({ select: { id: true } })
  courseId = course!.id
}, 240_000)

describe('المقترحُ يصير طلبَ تغييرٍ في الطابور القائم', () => {
  it('«نسخةٌ من دورةٍ قريبة» تُعلَّق على معرّف تلك الدورة', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId }, ACTOR)
    expect(cr.entityType).toBe('course')
    expect(cr.entityId, 'لا تُقرأ مع الدورة التي تخصّها').toBe(courseId)
    expect(cr.status).toBe('in_review')
    const payload = cr.payload as Record<string, unknown>
    expect(payload.kind).toBe('trainer_course_variant')
  })

  it('ودورةٌ لا وجودَ لها لا تُقبل نسخةً منها', async () => {
    await expect(
      admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId: 'C-LA-YUJAD' }, ACTOR),
    ).rejects.toThrow(/الكتالوج/)
  })

  it('و«دورةٌ جديدة» لا يُخترع لها معرّفٌ يوهم أنّها في الكتالوج', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, {
      kind: 'new_course', titleAr: 'تحليلُ البيانات بـPython', skillIds: [],
    }, ACTOR)
    expect(cr.entityId, 'معرّفٌ لا يقول إنّه مقترح').toMatch(/^C-PROPOSED-/)
    const known = await prisma.course.findUnique({ where: { id: cr.entityId } })
    expect(known, 'المعرّفُ يصطدم بدورةٍ قائمة').toBeNull()
    const payload = cr.payload as Record<string, unknown>
    expect(payload.kind).toBe('trainer_new_course')
    expect(payload.titleAr).toBe('تحليلُ البيانات بـPython')
  })

  it('ومهارةٌ لا وجودَ لها تُردّ قبل أن تُكتب — لا تُقرأ بعد شهرٍ ولا تُفهم', async () => {
    await expect(
      admin.submitCourseSuggestion(applicationId, {
        kind: 'new_course', titleAr: 'دورةٌ بمهارةٍ وهميّة', skillIds: ['SK-LA-YUJAD'],
      }, ACTOR),
    ).rejects.toThrow(/SK-LA-YUJAD/)
  })

  it('وعنوانٌ أقصرُ من ثلاثةٍ يُردّ', async () => {
    await expect(
      admin.submitCourseSuggestion(applicationId, { kind: 'new_course', titleAr: 'أب', skillIds: [] }, ACTOR),
    ).rejects.toThrow(/ثلاثة/)
  })
})

/* ═══ والطابورُ كان ينتهي عند البابِ الذي يُفتح ═══

   حرست الاختباراتُ فوق **الإرسال** كلَّه: المعرّفُ والحمولةُ والمهاراتُ
   والعنوان. ولم يحرس أحدٌ **الاعتماد** — وهو الزرُّ الوحيدُ الذي يُضغط
   في هذا الطابور.

   و`decide('approve')` تنادي `promoteEntity(… 'course', entityId …)`،
   وهي تكتب `course.update({ where: { id } })`. ومعرّفُ المقترح
   `C-PROPOSED-…` **لا صفَّ له في `Course` بقصد** — وهو ما يثبته الاختبارُ
   أعلاه بنفسه (`expect(known).toBeNull()`). فالكتابةُ ترمي `P2025`،
   والمعاملةُ تُلغى، والمراجعُ يرى ٥٠٠ بلا سبب.

   وهذا عطبٌ لا يُرى بقراءة الإرسال: الاختبارُ الذي أثبت أنّ الصفَّ معدومٌ
   هو نفسُه الذي كان يجب أن يسأل «وماذا يحدث حين يُعتمد؟». */
describe('اعتمادُ مقترحٍ ليس في الكتالوج', () => {
  const CHECKER = '00000000-0000-0000-0000-00000000000b'

  /* ═══ والصنفُ الثاني: مهارةٌ تُطلَب ولم تُخلَق ═══

     شاشةُ الكتالوج تفتح بابا واحدا لطلب مهارةٍ جديدة، فتكتب طلبَ تغييرٍ
     صنفُه `skill` ومعرّفُه «مَزلَقُ» اسمٍ لا صفَّ له في `Skill`. فكان
     الاعتمادُ يسقط سقوطَ الدورة بعينه — من `tx.skill.update`.

     ولذلك لم يكن الإصلاحُ بادئةَ `C-PROPOSED-`: البادئةُ تحرس صنفا واحدا،
     والصنفان اثنان من أوّل يوم. */
  it('ومهارةٌ طُلب ميلادُها تُعتمد ولا تصطدم بصفٍّ معدوم', async () => {
    const cr = await admin.submitChangeRequest(
      'skill', 'mahara-la-tujad',
      { kind: 'skill_request', slug: 'mahara-la-tujad', nameAr: 'مهارةٌ مطلوبة', reasonAr: 'يحتاجها مقترحٌ' },
      ACTOR,
    )
    const done = await admin.decide(cr.id, 'approve', 'مهارةٌ وجيهة', CHECKER)
    expect(done.status).toBe('approved')
    expect(
      await prisma.skill.findUnique({ where: { id: 'mahara-la-tujad' } }),
      'وُلدت مهارةٌ من باب القرار — والمهارةُ تُخلق حيث تُربط بالكتالوج',
    ).toBeNull()
  })

  it('يمضي ولا يصطدم بصفٍّ لا وجودَ له', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, {
      kind: 'new_course', titleAr: 'تحليلُ الأثر الاجتماعيّ', skillIds: [],
    }, ACTOR)
    expect(cr.entityId).toMatch(/^C-PROPOSED-/)

    const done = await admin.decide(cr.id, 'approve', 'مقترحٌ وجيه', CHECKER)
    expect(done.status).toBe('approved')

    /* ولا يُخلَق له صفٌّ في الكتالوج بابا خلفيّا: الاعتمادُ قرارٌ على
       المقترح، وميلادُ الدورة يمرّ بمعالجها حيث تُكتب محاورُها. */
    expect(
      await prisma.course.findUnique({ where: { id: cr.entityId } }),
      'وُلدت دورةٌ في الكتالوج من باب القرار لا من باب التأليف',
    ).toBeNull()
  })

  it('و«نسخةٌ من دورةٍ قائمة» تُعتمد وترفع دورتَها كما كانت', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId }, ACTOR)
    const done = await admin.decide(cr.id, 'approve', 'نسخةٌ مقبولة', CHECKER)
    expect(done.status).toBe('approved')
    const row = await prisma.course.findUnique({ where: { id: courseId } })
    expect(row?.status, 'الدورةُ القائمةُ لم تُرفع').toBe('approved')
  })
})

describe('كلُّ اقتراحٍ يُربط وحدَه — والطلبُ يحمل عشرين', () => {
  it('الحمولةُ تحمل السجلَّ المقصودَ وحدَه لا الطلبَ كلَّه', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, {
      kind: 'variant', courseId, proposalIndex: 1,
    }, ACTOR)
    const p = cr.payload as Record<string, unknown>
    expect(p.trainerWordsAr, 'رُبط اقتراحٌ فجاء غيرُه').toBe('إدارةُ المنتجات للمبتدئين — موظّفو التسويق')
  })

  it('وترتيبٌ لا اقتراحَ فيه يُردّ — فلا يُربط فراغ', async () => {
    await expect(
      admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId, proposalIndex: 9 }, ACTOR),
    ).rejects.toThrow(/اقتراح/)
  })

  it('وبلا ترتيبٍ تُقرأ الفقرةُ القديمة — فطلباتُ ما قبل السجلّات تُربط كذلك', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId }, ACTOR)
    expect((cr.payload as Record<string, unknown>).trainerWordsAr).toBe(WORDS)
  })
})

describe('ما تحمله الحمولةُ وما لا تحمله', () => {
  it('كلامُه بنصّه ومرجعُ طلبه واسمُه — فمن فتحه بعد شهرٍ عرف من أين جاء', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId, noteAr: 'قريبةٌ جدّا' }, ACTOR)
    const p = cr.payload as Record<string, unknown>
    expect(p.trainerWordsAr, 'كلامُه مُلخَّصٌ أو ضائع').toBe(WORDS)
    expect(p.noteAr).toBe('قريبةٌ جدّا')
    const from = p.fromApplication as Record<string, unknown>
    expect(from.reference).toMatch(/\S/)
    expect(from.fullName).toBe('مقترِحُ الدورات')
  })

  it('ولا بريدَ ولا هاتفَ — الطابورُ يُقرأ بعينٍ أوسعَ من عين مراجع الطلبات', async () => {
    const cr = await admin.submitCourseSuggestion(applicationId, { kind: 'variant', courseId }, ACTOR)
    const json = JSON.stringify(cr.payload)
    expect(json).not.toContain('suggester@test.local')
    expect(json).not.toContain('phone')
  })

  it('وطلبٌ لا وجودَ له يُردّ', async () => {
    await expect(
      admin.submitCourseSuggestion('00000000-0000-0000-0000-0000000000ff', { kind: 'variant', courseId }, ACTOR),
    ).rejects.toThrow(/الطلب/)
  })
})

describe('ويصل الطابورَ القائمَ لا طابورا ثانيا', () => {
  it('يُقرأ مع سائر طلبات التغيير', async () => {
    const rows = await admin.listChangeRequests('in_review')
    const mine = rows.filter((r) => {
      const p = r.payload as Record<string, unknown> | null
      return typeof p?.kind === 'string' && p.kind.startsWith('trainer_')
    })
    expect(mine.length).toBeGreaterThan(0)
  })
})
