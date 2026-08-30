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
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'

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

    /* ولا تُؤرشف دورةٌ ما زالت في المصدر — التقليم يقطع الزائد لا الأصل */
    const stillPublished = await prisma.course.count({ where: { status: 'published' } })
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
