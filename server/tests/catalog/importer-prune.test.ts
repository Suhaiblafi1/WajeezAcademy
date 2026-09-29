/* التقليص يصل — المستورد يحذف ما لم يعد في المستودع.

   كان المستورد يُنشئ ويحدّث ولا يحذف. فكل قائمةٍ تقصُر في ملفات المستودع تترك
   خلفها صفوفا يتيمة في القاعدة، ولا شيء يشتكي: الاستيراد ينجح، والنشر ينجح،
   واللقطة تُبنى من صفوف القاعدة لا من الملفات — فتحمل الزائد إلى الواجهة.

   وقع هذا في الإنتاج بسؤال القطاع: قُلِّص من ثمانية خيارات إلى أربعة في
   المستودع، فرأى المستخدم ثمانية — الجديدة ثم القديمة تحتها.

   الحارس هنا سلوكي وعام: يزرع صفّا دخيلا تحت كل أبٍ يشتقّ أبناءه من
   المستودع، ثم يعيد الاستيراد، فيتوقّع اختفاء الدخيل وبقاء الأصل كاملا. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'
import { CatalogAdminService } from '../../services/catalog-admin.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const j = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('المستورد يحذف ما زال من المستودع', () => {
  it('الصفوف الدخيلة تختفي والأصلية تبقى', { timeout: 180_000 }, async () => {
    const questions = j('src/data/catalog/questions.v1.ar.json').questions as Array<{
      question_id: string; options_ar: string[]
    }>
    const core = j('src/data/catalog/core-catalog.v2.json')

    const q = questions.find((x) => x.options_ar.length > 0)!
    const course = await prisma.course.findFirstOrThrow({ orderBy: { id: 'asc' } })
    const cv = await prisma.courseVersion.findFirstOrThrow({ where: { courseId: course.id } })
    const pathway = await prisma.pathway.findFirstOrThrow({ orderBy: { id: 'asc' } })
    const template = await prisma.compositeTemplate.findFirstOrThrow({ orderBy: { id: 'asc' } })
    const skill = await prisma.skill.findFirstOrThrow({ orderBy: { id: 'asc' } })
    /* دورة ليست في هذا المسار — كي يكون الرابط الدخيل دخيلا فعلا */
    const strayCourse = await prisma.course.findFirstOrThrow({
      where: { id: { notIn: (core.launch_pathways as Array<{ id: string; course_ids: string[] }>)
        .find((p) => p.id === pathway.id)!.course_ids } },
    })

    const before = {
      options: await prisma.questionOption.count({ where: { questionId: q.question_id } }),
      objectives: await prisma.learningObjective.count({ where: { courseVersionId: cv.id } }),
      courseSkills: await prisma.courseSkillLink.count({ where: { courseId: course.id } }),
      pathwayCourses: await prisma.pathwayCourse.count({ where: { pathwayId: pathway.id } }),
      templateCourses: await prisma.templateCourse.count({ where: { templateId: template.id } }),
      questionSkills: await prisma.questionSkillLink.count({ where: { questionId: q.question_id } }),
    }
    expect(before.options).toBe(q.options_ar.length)

    /* زرع الدخلاء — كلٌّ منها ما كان يبقى قبل الإصلاح */
    await prisma.questionOption.create({
      data: { questionId: q.question_id, optionId: 'o99', orderIndex: 98, textAr: 'خيار مهجور' },
    })
    await prisma.learningObjective.create({
      data: { courseVersionId: cv.id, sequence: 99, textAr: 'هدف مهجور' },
    })
    await prisma.courseSkillLink.create({
      data: { courseId: course.id, skillId: skill.id, targetLevel: 3, weight: 1 },
    }).catch(() => undefined) // قد يكون الرابط قائما أصلا
    await prisma.pathwayCourse.create({
      data: { pathwayId: pathway.id, courseId: strayCourse.id, sequence: 99, kind: 'required' },
    })
    await prisma.templateCourse.create({
      data: { templateId: template.id, courseId: strayCourse.id, listType: 'required', sequence: 99 },
    }).catch(() => undefined)
    await prisma.questionSkillLink.create({
      data: { questionId: q.question_id, skillId: skill.id, weight: 1 },
    }).catch(() => undefined)

    await importCatalog(prisma)

    expect(await prisma.questionOption.findUnique({
      where: { questionId_optionId: { questionId: q.question_id, optionId: 'o99' } },
    })).toBeNull()
    expect(await prisma.pathwayCourse.findUnique({
      where: { pathwayId_courseId: { pathwayId: pathway.id, courseId: strayCourse.id } },
    })).toBeNull()

    const after = {
      options: await prisma.questionOption.count({ where: { questionId: q.question_id } }),
      objectives: await prisma.learningObjective.count({ where: { courseVersionId: cv.id } }),
      courseSkills: await prisma.courseSkillLink.count({ where: { courseId: course.id } }),
      pathwayCourses: await prisma.pathwayCourse.count({ where: { pathwayId: pathway.id } }),
      templateCourses: await prisma.templateCourse.count({ where: { templateId: template.id } }),
      questionSkills: await prisma.questionSkillLink.count({ where: { questionId: q.question_id } }),
    }
    /* الأصل كما كان — لا الدخيل باق ولا الحذف تجاوزه */
    expect(after).toEqual(before)
  })

  /* الفجوة التي وقعت في الإنتاج فعلا: التقليم كان يصل إلى الأبناء ولا يصل
     إلى كيانٍ أعلى زال من المصدر. فبقيت العشرون النصفية (C-*-102) منشورةً بعد
     الدمج، فعرض الكتالوج ١٠١ دورة لا ٨١ — عشرون منها تكرّر ما صار داخل الدورة
     المدمجة. ولم يمسكه أيّ اختبار لأن هذا الملفّ كان يزرع أبناء دخلاء فقط. */
  it('دورة زالت من المصدر تُؤرشف — ولا تُحذف فتأخذ سجلّاتها معها', { timeout: 180_000 }, async () => {
    const core = j('src/data/catalog/core-catalog.v2.json') as { courses: { course_id: string }[] }
    const sourceIds = new Set(core.courses.map((c) => c.course_id))

    /* دورة ليست في المصدر أصلا — كما صارت C-*-102 بعد الدمج */
    const stray = await prisma.course.create({
      data: { id: 'C-ZZZ-999', status: 'published', currentVersion: 1 },
    })
    /* وسجلّ يعتمد عليها: لو حُذفت الدورة لأخذته معها بالتتابع */
    const version = await prisma.courseVersion.create({
      data: { courseId: stray.id, version: 1, titleAr: 'دورة زالت من المستودع', totalHours: 8, status: 'published' },
    })

    await importCatalog(prisma)

    const after = await prisma.course.findUnique({ where: { id: stray.id } })
    expect(after, 'الدورة حُذفت — وحذفُها يأخذ الشعب والتسجيلات وطلبات الدفع معها').not.toBeNull()
    expect(after!.status, 'الدورة الزائلة ما زالت منشورة — ستظهر في الكتالوج بلا مسار').toBe('archived')
    /* السجلّ المعتمد عليها باقٍ — هذا هو الفرق بين الأرشفة والحذف */
    expect(await prisma.courseVersion.findUnique({ where: { id: version.id } })).not.toBeNull()

    /* ولا تُؤرشف دورةٌ ما زالت في المصدر — التقليم يقطع الزائد لا الأصل.
       ويُعدّ ما في المصدر وحدَه: دوراتُ اللوحة تبقى منشورةً بقصد (أدناه)،
       وملفٌّ سبق في العامل نفسِه قد نشر واحدةً منها. */
    const stillPublished = await prisma.course.count({ where: { status: 'published', id: { in: [...sourceIds] } } })
    expect(stillPublished).toBe(sourceIds.size)

    await prisma.course.delete({ where: { id: stray.id } })
  })

  it('سؤال القطاع أربعة خيارات لا ثمانية', async () => {
    const questions = j('src/data/catalog/questions.v1.ar.json').questions as Array<{
      question_id: string; options_ar: string[]
    }>
    const source = questions.find((x) => x.question_id === 'QB-M3B-001')!
    const rows = await prisma.questionOption.findMany({
      where: { questionId: 'QB-M3B-001' }, orderBy: { orderIndex: 'asc' },
    })
    expect(rows.map((r) => r.textAr)).toEqual(source.options_ar)
  })
})

/* ═══ دوراتُ اللوحة لا يملكها الملفّ ═══

   للدورات بابان: ملفُّ المستودع، ومعالجُ الإضافة في اللوحة. وكان المستوردُ
   يعامل الملفَّ بابا وحيدا، فيطفئ عند كلِّ نشرٍ للموقع ما نشرته اللوحة، ويحذف
   رابطَ مسارها. ووقع ذلك في الإنتاج لـC-COMX-107: صارت إليها فكرةُ مدرّب،
   ونُشرت، ثمّ خرجت من الكتالوج بلا سجلّ — والكتالوجُ الحيُّ مئةٌ وسبعَ عشرةَ
   دورةً كلُّها من الملفّ. */
describe('دوراتُ اللوحة لا يطفئها نشرُ الموقع', () => {
  it('دورةٌ وُلدت في المعالج ونُشرت تبقى منشورةً ويبقى رابطُ مسارها', { timeout: 180_000 }, async () => {
    const core = j('src/data/catalog/core-catalog.v2.json') as { launch_pathways: { id: string }[] }
    const pathwayId = core.launch_pathways[0].id
    const skill = await prisma.skill.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })
    const admin = new CatalogAdminService(prisma)

    /* من البابِ الحقيقيّ لا بصفٍّ يُكتب باليد: فلو وُلدت الدورةُ من المعالج بلا
       علامةِ ميلادها لحسبها المستوردُ من دوراته — ويسقط هذا */
    const { id } = await admin.createCourse({
      pathwayId, sequence: 9, titleAr: 'دورةٌ وُلدت في اللوحة', totalHours: 4, skillIds: [skill.id],
      modules: [{ sequence: 1, titleAr: 'وحدتُها الأولى', hours: 4 }],
    }, randomUUID())
    /* والنشرُ بالدالّة التي يرقّي بها النشرُ نفسُه */
    await prisma.$transaction((tx) => admin.promoteEntity(tx, 'course', id, 'draft', 'published'))
    const link = { pathwayId_courseId: { pathwayId, courseId: id } }
    expect((await prisma.course.findUniqueOrThrow({ where: { id } })).status).toBe('published')
    expect(await prisma.pathwayCourse.findUnique({ where: link })).not.toBeNull()

    try {
      await importCatalog(prisma)

      const after = await prisma.course.findUniqueOrThrow({ where: { id } })
      expect(after.status, 'نشرُ الموقع أطفأ دورةً نشرتها اللوحة').toBe('published')
      expect(
        await prisma.pathwayCourse.findUnique({ where: link }),
        'نشرُ الموقع حذف رابطَ مسارِ دورةِ اللوحة — فتخرج إلى الكتالوج بلا مسار',
      ).not.toBeNull()
    } finally {
      await prisma.course.delete({ where: { id } })
    }
  })

  it('معرّفٌ في الملفّ سبقت إليه اللوحةُ يوقف الاستيرادَ ولا يُكتب فوق دورتها', { timeout: 300_000 }, async () => {
    const core = j('src/data/catalog/core-catalog.v2.json') as { courses: { course_id: string; title_ar: string }[] }
    const target = core.courses[core.courses.length - 1]
    const version = { courseId_version: { courseId: target.course_id, version: 1 } }

    /* كأنّ المعالجَ ولّد هذا الرقمَ وكتب دورتَه قبل أن يكتبه المستودع */
    await prisma.course.update({ where: { id: target.course_id }, data: { createdBy: randomUUID() } })
    await prisma.courseVersion.update({ where: version, data: { titleAr: 'عنوانٌ كتبته اللوحة' } })
    try {
      await expect(importCatalog(prisma), 'الاستيرادُ مرّ على معرّفٍ وُلدت دورتُه في اللوحة')
        .rejects.toThrow(target.course_id)
      expect(
        (await prisma.courseVersion.findUniqueOrThrow({ where: version })).titleAr,
        'الاستيرادُ كتب عنوانَ دورةِ الملفّ فوق دورةٍ راجعها إنسانٌ في اللوحة',
      ).toBe('عنوانٌ كتبته اللوحة')
    } finally {
      /* ويُردّ الصفُّ إلى ما كان، لمن يلي في العامل نفسِه */
      await prisma.course.update({ where: { id: target.course_id }, data: { createdBy: null } })
      await importCatalog(prisma)
    }
    expect((await prisma.courseVersion.findUniqueOrThrow({ where: version })).titleAr).toBe(target.title_ar)
  })
})

/* ═══ والترحيلُ يعيد ما أطفأه المستوردُ قبلُ — بالبيّنة وحدَها ═══

   جرى الترحيلُ على قاعدةٍ فارغةٍ حين هُيّئت قاعدةُ الاختبار، فلا يُقاس أثرُه
   هناك. فيُقرأ استعلاماه من ملفّه **نفسِه** ويُنفَّذان على صفوفٍ تُصنع هنا
   بكلّ حالٍ من أحواله — فلو تبدّل شرطٌ في الملفّ سقط هذا لا نسخةٌ عنه. */
describe('ترحيلُ إعادةِ دوراتِ اللوحة', () => {
  it('يعيد المؤرشفةَ التي نُشرت حقّا، ورابطَها من آخر لقطة — ولا يمسّ غيرها', { timeout: 120_000 }, async () => {
    const sql = readFileSync(join(root, 'prisma/migrations/20260929120000_restore_admin_courses/migration.sql'), 'utf8')
    const statements = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
      .split(';').map((x) => x.trim()).filter(Boolean)
    expect(statements, 'الترحيلُ استعلامان: الحالةُ ثمّ الرابط').toHaveLength(2)

    const core = j('src/data/catalog/core-catalog.v2.json') as { launch_pathways: { id: string }[] }
    const [P, P2, Q] = core.launch_pathways.map((p) => p.id)
    const S = Date.now().toString(36).toUpperCase()
    const ids = {
      restored: `C-ZR${S}-901`, // وُلدت في اللوحة، ونُشرت، ثمّ أطفأها المستورد
      neverPublished: `C-ZR${S}-902`, // وُلدت في اللوحة ولا نشرَ في سجلّها
      fromRepo: `C-ZR${S}-903`, // من الملفّ وزالت منه — أرشفتُها مقصودة
      linked: `C-ZR${S}-904`, // منشورةٌ ولها رابطٌ اليوم
      standalone: `C-ZR${S}-905`, // نُشرت قائمةً بنفسها
    }
    const maker = randomUUID()
    const born = new Date('2026-09-01T00:00:00Z')
    const course = (id: string, status: string, createdBy: string | null) =>
      prisma.course.create({ data: { id, status, createdBy, currentVersion: 1, createdAt: born } })
    await course(ids.restored, 'archived', maker)
    await course(ids.neverPublished, 'archived', maker)
    await course(ids.fromRepo, 'archived', null)
    await course(ids.linked, 'published', maker)
    await course(ids.standalone, 'archived', maker)
    await prisma.pathwayCourse.create({ data: { pathwayId: Q, courseId: ids.linked, sequence: 3 } })

    /* سجلُّ النشر ولقطتاه — في إصدارٍ «مستبدَل» كي لا يصير اللقطةَ الفعّالة
       لمن يلي في العامل نفسِه */
    const version = await prisma.catalogVersion.create({ data: { label: `restore-test-${S}`, status: 'superseded' } })
    await prisma.catalogPublishEvent.create({
      data: {
        catalogVersionId: version.id, action: 'publish',
        details: { promoted: { courses: [ids.restored, ids.fromRepo, ids.linked, ids.standalone], pathways: [] } },
      },
    })
    const snapshot = (at: string, courses: object[]) => prisma.catalogSnapshot.create({
      data: { catalogVersionId: version.id, payloadHash: 'x', createdAt: new Date(at), payload: { coreCatalog: { courses } } },
    })
    await snapshot('2026-09-05T00:00:00Z', [{ course_id: ids.restored, pathway_id: P2, sequence: 2 }])
    await snapshot('2026-09-10T00:00:00Z', [
      { course_id: ids.restored, pathway_id: P, sequence: 4 },
      { course_id: ids.linked, pathway_id: P, sequence: 6 },
      { course_id: ids.standalone, pathway_id: '', sequence: 1 },
    ])

    /* ويُحصر في صفوف هذا الاختبار — والحصرُ **شرطٌ يُضاف** لا نسخةٌ تُكتب */
    const scope = Object.values(ids).map((id) => `'${id}'`).join(', ')
    const anchor = 'WHERE c."createdBy" IS NOT NULL'
    const run = async () => {
      for (const st of statements) {
        expect(st.split(anchor).length - 1, 'تبدّل شرطُ الميلاد في الترحيل — فلا يُحصر').toBe(1)
        await prisma.$executeRawUnsafe(st.replace(anchor, `WHERE c."id" IN (${scope}) AND c."createdBy" IS NOT NULL`))
      }
    }

    try {
      await run()
      const status = async (id: string) => (await prisma.course.findUniqueOrThrow({ where: { id } })).status
      const links = (id: string) => prisma.pathwayCourse.findMany({
        where: { courseId: id }, select: { pathwayId: true, sequence: true, kind: true },
      })

      expect(await status(ids.restored), 'دورةُ لوحةٍ نُشرت ثمّ أُطفئت لم تعُد').toBe('published')
      expect(await links(ids.restored), 'رابطُها لم يُؤخذ من آخر لقطةٍ حملتها')
        .toEqual([{ pathwayId: P, sequence: 4, kind: 'required' }])
      expect(await status(ids.neverPublished), 'نُشرت دورةٌ لم يعتمد نشرَها أحد').toBe('archived')
      expect(await links(ids.neverPublished)).toEqual([])
      expect(await status(ids.fromRepo), 'عادت دورةٌ أزالها المستودعُ بقصد').toBe('archived')
      expect(await links(ids.linked), 'أُضيف رابطٌ ثانٍ إلى دورةٍ لها رابط')
        .toEqual([{ pathwayId: Q, sequence: 3, kind: 'required' }])
      expect(await status(ids.standalone)).toBe('published')
      expect(await links(ids.standalone), 'اختُرع مسارٌ لدورةٍ نُشرت بلا مسار').toEqual([])

      /* ومرّةً ثانيةً لا يتغيّر شيء — فالنشرُ الذي يعيده لا يكسره */
      await run()
      expect(await links(ids.restored)).toHaveLength(1)
    } finally {
      await prisma.catalogVersion.delete({ where: { id: version.id } })
      await prisma.course.deleteMany({ where: { id: { in: Object.values(ids) } } })
    }
  })
})
