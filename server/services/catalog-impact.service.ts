/* دائرة أثر الدورة (البند ب-١) — من يصله التعديل قبل أن يُعتمد.

   المشكلة: المراجع يعتمد تعديلا على دورة تستخدمها سبعة كيانات وهو لا يعلم.
   شاشة المراجعة لا تذكر مسارا ولا قالبا ولا عدد متعلم — فالقرار يُتخذ على
   عنوان الدورة وحده، والأثر يظهر بعد النشر في ترشيحات لا يعرف أحد لماذا تغيّرت.

   المصدر جاهز في القاعدة: PathwayCourse و TemplateCourse للكيانات، والشعب
   والتسجيلات للبشر. ولا شيء يُحسب تقديرا: كل رقم صفوفٌ تُعدّ.

   ⚠ الاستعلامات مجمَّعة لا لكل دورة على حدها: شاشة المراجعة تعرض عشرات
   الاقتراحات، واستعلام لكل واحدة يجعل فتحها أبطأ من قراءتها. */

import type { PrismaClient } from '@prisma/client'

export interface BlastRadiusEntity {
  id: string
  titleAr: string
  /* required | optional | gift للمسارات · required | conditional | bridge | starter للقوالب */
  roleAr: string
}

export interface CourseBlastRadius {
  courseId: string
  pathways: BlastRadiusEntity[]
  templates: BlastRadiusEntity[]
  /** مجموع الكيانات التي يصلها التعديل — مسارات + قوالب */
  entityCount: number
  cohorts: { total: number; live: number }
  /** متعلمون مسجَّلون غير منسحبين في شعب هذه الدورة */
  learners: number
}

const PATHWAY_KIND_AR: Record<string, string> = {
  required: 'إلزامية', optional: 'اختيارية', gift: 'هدية',
}
const TEMPLATE_LIST_AR: Record<string, string> = {
  required: 'مطلوبة', conditional: 'شرطية', bridge: 'جسر', starter: 'تمهيدية',
}
/* شعبة «حيّة» = يتأثر بها متعلم الآن */
const LIVE_COHORT = ['open', 'full', 'active']

function empty(courseId: string): CourseBlastRadius {
  return { courseId, pathways: [], templates: [], entityCount: 0, cohorts: { total: 0, live: 0 }, learners: 0 }
}

/** دوائر أثر عدة دورات دفعة واحدة — أربعة استعلامات لا أربعة لكل دورة */
export async function courseBlastRadius(
  prisma: PrismaClient,
  courseIds: string[],
): Promise<Map<string, CourseBlastRadius>> {
  const ids = [...new Set(courseIds.filter(Boolean))]
  const out = new Map<string, CourseBlastRadius>(ids.map((id) => [id, empty(id)]))
  if (ids.length === 0) return out

  const [pathwayLinks, templateLinks, cohorts] = await Promise.all([
    prisma.pathwayCourse.findMany({
      where: { courseId: { in: ids } },
      include: { pathway: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
      orderBy: [{ courseId: 'asc' }, { pathwayId: 'asc' }],
    }),
    prisma.templateCourse.findMany({
      where: { courseId: { in: ids } },
      include: { template: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
      orderBy: [{ courseId: 'asc' }, { templateId: 'asc' }],
    }),
    prisma.cohort.findMany({
      where: { courseId: { in: ids } },
      select: { id: true, courseId: true, status: true, _count: { select: { enrollments: true } } },
    }),
  ])

  for (const l of pathwayLinks) {
    const row = out.get(l.courseId)
    if (!row) continue
    row.pathways.push({
      id: l.pathwayId,
      titleAr: l.pathway.versions[0]?.title ?? l.pathwayId,
      roleAr: PATHWAY_KIND_AR[l.kind] ?? l.kind,
    })
  }
  for (const l of templateLinks) {
    const row = out.get(l.courseId)
    if (!row) continue
    /* القالب قد يضمّ الدورة في أكثر من قائمة — تُذكر مرة بأول دور تُوجد فيه */
    if (row.templates.some((t) => t.id === l.templateId)) continue
    row.templates.push({
      id: l.templateId,
      titleAr: l.template.versions[0]?.nameAr ?? l.templateId,
      roleAr: TEMPLATE_LIST_AR[l.listType] ?? l.listType,
    })
  }

  /* المتعلمون: التسجيلات غير المنسحبة في شعب الدورة */
  const cohortIds = cohorts.map((c) => c.id)
  const enrollments = cohortIds.length
    ? await prisma.enrollment.groupBy({
        by: ['cohortId'],
        where: { cohortId: { in: cohortIds }, status: { not: 'dropped' } },
        _count: { _all: true },
      })
    : []
  const byCohort = new Map(enrollments.map((e) => [e.cohortId, e._count._all]))

  for (const c of cohorts) {
    const row = out.get(c.courseId)
    if (!row) continue
    row.cohorts.total += 1
    if (LIVE_COHORT.includes(c.status)) row.cohorts.live += 1
    row.learners += byCohort.get(c.id) ?? 0
  }

  for (const row of out.values()) row.entityCount = row.pathways.length + row.templates.length

  return out
}

/* صيغة العدد في العربية: ١ مفرد · ٢ مثنى · ٣–١٠ جمع · ١١+ مفرد منصوب.
   «1 مسارا» و«3 قالبا» خطأ يقرؤه المراجع في كل سطر — والعدد هنا يُقرأ لا يُحسب. */
export function countAr(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return `${n} ${forms.one}`
  if (n === 2) return `${n} ${forms.two}`
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`
  return `${n} ${forms.many}`
}

const PATHWAY_FORMS = { one: 'مسار', two: 'مساران', few: 'مسارات', many: 'مسارا' }
const TEMPLATE_FORMS = { one: 'قالب مركّب', two: 'قالبان مركّبان', few: 'قوالب مركّبة', many: 'قالبا مركّبا' }
const COHORT_FORMS = { one: 'شعبة حيّة', two: 'شعبتان حيّتان', few: 'شعب حيّة', many: 'شعبة حيّة' }
const LEARNER_FORMS = { one: 'متعلم مسجَّل', two: 'متعلمان مسجَّلان', few: 'متعلمين مسجَّلين', many: 'متعلما مسجَّلا' }

/** جملة عربية تصف الدائرة — تُعرض فوق الاقتراح، ومصدرها الأرقام نفسها */
export function blastRadiusSentenceAr(r: CourseBlastRadius): string {
  if (r.entityCount === 0 && r.cohorts.total === 0) {
    return 'لا مسار ولا قالب ولا شعبة تستخدم هذه الدورة بعد — التعديل لا يصل إلى أحد الآن.'
  }
  const parts: string[] = []
  if (r.pathways.length > 0) parts.push(countAr(r.pathways.length, PATHWAY_FORMS))
  if (r.templates.length > 0) parts.push(countAr(r.templates.length, TEMPLATE_FORMS))
  if (r.cohorts.live > 0) parts.push(countAr(r.cohorts.live, COHORT_FORMS))
  if (r.learners > 0) parts.push(countAr(r.learners, LEARNER_FORMS))
  return `هذه الدورة يستخدمها ${parts.join(' · ')} — التعديل سيصل إليها جميعا.`
}
