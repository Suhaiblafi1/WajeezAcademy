/* باني لقطة الكتالوج من قاعدة البيانات — يعيد تركيب حمولة المحرك بالضبط
   (نفس أشكال ملفات JSON الموثقة) من الصفوف العلائقية المنشورة فقط.
   الحقول المضمنة في مراجع القوالب تُولَّد من الكتالوج المركزي لحظة البناء —
   لا يمكن أن تتقادم لأنها لا تُخزَّن أصلا. */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface BuiltSnapshot {
  payload: Record<string, unknown>
  hash: string
  counts: { pathways: number; courses: number; modules: number; skills: number; questions: number; templates: number }
}

/** يبني لقطة من صفوف المنشور — ومع extraStatuses يشمل حالات إضافية (مثل «approved» للقطات المرشحة قبل النشر) */
export async function buildSnapshotFromDb(
  prisma: PrismaClient,
  opts: { extraStatuses?: string[] } = {},
): Promise<BuiltSnapshot> {
  const visible = ['published', ...(opts.extraStatuses ?? [])]
  /* المهارات: المنشورة فقط — SK-X-* امتدادات، وما سواها القاموس الأساسي */
  const skills = await prisma.skill.findMany({ where: { status: { in: visible } } })
  const mainSkills = skills.filter((s) => !s.id.startsWith('SK-X-'))
  const extensions = skills.filter((s) => s.id.startsWith('SK-X-'))

  /* الأسئلة المنشورة + نص الإصدار الحالي + الخيارات مرتبة بمعرفاتها الثابتة */
  const questions = await prisma.question.findMany({
    where: { status: { in: visible }, active: true },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 }, options: { orderBy: { orderIndex: 'asc' } } },
    orderBy: { id: 'asc' },
  })
  const optionEffects: Record<string, Record<string, unknown>> = {}
  const questionRows = questions.map((q) => {
    for (const o of q.options) {
      if (o.effects) {
        ;(optionEffects[q.id] ??= {})[o.optionId] = o.effects
      }
    }
    return {
      question_id: q.id,
      module_id: q.moduleId ?? '',
      module_name: q.moduleName ?? undefined,
      version: String(q.currentVersion),
      text_ar: q.versions[0]?.textAr ?? '',
      answer_type: q.answerType,
      options_ar: q.options.map((o) => o.textAr),
      options_key: q.optionsKey,
      persona_scope: (q.personaScope as string[]) ?? [],
      trigger_condition: q.triggerCondition,
      measures: (q.measures as string[]) ?? [],
      decision_impact: q.reasonAr ?? '',
      sensitivity_level: q.sensitivityLevel,
      required_level: q.requiredLevel,
      weight: q.weight,
      active: q.active,
    }
  })

  /* الدورات المنشورة + إصدارها الحالي + مهاراتها من الروابط المركزية */
  const courses = await prisma.course.findMany({
    where: { status: { in: visible } },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      skillLinks: { include: { skill: true } },
      pathwayLinks: { orderBy: { sequence: 'asc' } },
    },
  })
  const courseRows = courses.map((c) => {
    const v = c.versions[0]
    const home = c.pathwayLinks[0]
    return {
      course_id: c.id,
      pathway_id: home?.pathwayId ?? '',
      sequence: home?.sequence ?? 1,
      title_ar: v?.titleAr ?? '',
      subtitle_ar: v?.shortPromiseAr ?? undefined,
      level_ar: v?.levelAr ?? undefined,
      total_hours: v?.totalHours ?? 0,
      skill_ids: c.skillLinks.map((l) => l.skillId),
      skill_slugs: c.skillLinks.map((l) => l.skill.slug),
      skill_names_ar: c.skillLinks.map((l) => l.skill.nameAr),
    }
  })

  /* الوحدات المنشورة */
  const modules = await prisma.courseModule.findMany({
    where: { status: { in: visible } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  const moduleRows = modules.flatMap((m) => {
    const v = m.versions[0]
    if (!v) return []
    return [{
      module_id: m.id, course_id: m.courseId, sequence: v.sequence, title_ar: v.titleAr,
      module_outcome_ar: v.outcomeAr ?? '', practice_activity_ar: v.activityAr ?? '',
      evidence_artifact_ar: v.artifactAr ?? '', expected_hours: v.hours,
      /* متن الدرس (ح-١) — يُحذف الحقل حين لا متن، فلا تنتفخ اللقطة بسلاسل فارغة */
      ...(v.bodyAr ? { module_body_ar: v.bodyAr } : {}),
    }]
  })

  /* المسارات المنشورة + دوراتها المرجعية مرتبة */
  const pathways = await prisma.pathway.findMany({
    where: { status: { in: visible } },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      courses: { orderBy: { sequence: 'asc' } },
    },
  })
  const hoursByCourse = new Map(courseRows.map((c) => [c.course_id, c.total_hours]))
  const pathwayRows = pathways.map((p) => {
    const v = p.versions[0]
    const courseIds = p.courses.map((l) => l.courseId)
    return {
      id: p.id,
      title: v?.title ?? '',
      short_title: v?.shortTitle ?? undefined,
      audience: v?.audience ?? '',
      not_for: v?.notFor ?? undefined,
      entry: v?.entry ?? undefined,
      before: v?.beforeText ?? '',
      after: v?.afterText ?? '',
      duration_weeks: v?.durationWeeks ?? 0,
      weekly_hours: v?.weeklyHours ?? '',
      level: v?.level ?? '',
      delivery: v?.delivery ?? undefined,
      capstone: v?.capstone ?? '',
      outcome_metric: v?.outcomeMetric ?? undefined,
      credential_ar: v?.credentialAr ?? undefined,
      course_ids: courseIds,
      total_hours: courseIds.reduce((s, cid) => s + (hoursByCourse.get(cid) ?? 0), 0),
    }
  })
  const pathwayTitleById = new Map(pathwayRows.map((p) => [p.id, p.title]))

  /* القوالب المنشورة + قوائم دوراتها — الحقول المضمنة تُولَّد من المركزي هنا */
  const templates = await prisma.compositeTemplate.findMany({
    where: { status: { in: visible } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: { orderBy: { sequence: 'asc' } } },
  })
  const courseCentral = new Map(courses.map((c) => [c.id, c]))
  const templateRows = templates.map((t) => {
    const v = t.versions[0]
    const refs = (listType: string) =>
      t.courses.filter((l) => l.listType === listType).map((l) => {
        const central = courseCentral.get(l.courseId)
        const cv = central?.versions[0]
        const pathwayId = central?.pathwayLinks[0]?.pathwayId ?? ''
        return {
          sequence: l.sequence,
          course_type: l.listType,
          course_id: l.courseId,
          course_title_ar: cv?.titleAr ?? '', // من الكتالوج المركزي — لا نسخة مخزنة
          pathway_id: pathwayId,
          pathway_title_ar: pathwayTitleById.get(pathwayId) ?? '',
          hours: cv?.totalHours ?? 0,
          role_ar: l.roleAr ?? undefined,
          reason_ar: l.reasonAr ?? undefined,
          condition_ar: l.conditionAr ?? undefined,
        }
      })
    return {
      template_id: t.id,
      name_ar: v?.nameAr ?? '',
      short_name_ar: v?.shortNameAr ?? undefined,
      intent_ar: v?.intentAr ?? undefined,
      persona: v?.persona ?? undefined,
      transformation: v?.transformation ?? undefined,
      plan: v?.plan ?? undefined,
      diagnostic: v?.diagnostic ?? undefined,
      required_courses: refs('required'),
      conditional_courses: refs('conditional'),
      bridge_courses: refs('bridge'),
      starter_courses: refs('starter'),
      entity_type: 'composite_template',
      not_counted_as_pathway: t.notCountedAsPathway,
      status: 'published',
      version: String(t.currentVersion),
    }
  })

  /* الملفات التشخيصية للمسارات → شكل pathway-profiles */
  const profiles = await prisma.diagnosticProfile.findMany({ where: { entityType: 'pathway' } })
  const profileMap: Record<string, unknown> = {}
  for (const p of profiles) {
    /* اللقطة الكاملة من المصدر — بلا اقتطاع — تتقدم على الحقول المفككة */
    if (p.profile) {
      profileMap[p.entityId] = p.profile
      continue
    }
    profileMap[p.entityId] = {
      personas: (p.audience as string[]) ?? [],
      goals: (p.goals as string[]) ?? [],
      sectors: [],
      functions: [],
      min_weekly_load: (p.timeConstraints as { min_weekly_load?: string } | null)?.min_weekly_load,
      notes_ar: (p.rationales as { notes_ar?: string } | null)?.notes_ar,
    }
  }

  /* مصنفات الكلمات — وثيقة تراكب لم تُنمذج بعد؛ تُقرأ من مصدرها الموثق */
  const optionEffectsOverlay = JSON.parse(readFileSync(join(root, 'src/data/overlays/option-effects.v2.json'), 'utf8'))

  const payload = {
    questions: { questions: questionRows },
    skills: { skills: mainSkills.map(skillRow) },
    coreCatalog: {
      launch_pathways: pathwayRows,
      courses: courseRows,
      modules: moduleRows,
      skill_extensions: extensions.map(skillRow),
    },
    templates: { templates: templateRows },
    optionEffects: {
      option_effects: optionEffects,
      keyword_classifiers: optionEffectsOverlay.keyword_classifiers ?? {},
    },
    pathwayProfiles: { profiles: profileMap },
  }
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return {
    payload: payload as Record<string, unknown>,
    hash,
    counts: {
      pathways: pathwayRows.length, courses: courseRows.length, modules: moduleRows.length,
      skills: skills.length, questions: questionRows.length, templates: templateRows.length,
    },
  }
}

function skillRow(s: { id: string; slug: string; nameAr: string; familyId: string | null }) {
  return { skill_id: s.id, slug: s.slug, name_ar: s.nameAr, family_id: s.familyId ?? undefined }
}

/** اللقطة الفعالة: أحدث إصدار منشور — المحرك لا يقرأ غيرها */
export async function getActiveSnapshot(prisma: PrismaClient): Promise<{
  versionId: string; label: string; payload: unknown; hash: string
} | null> {
  const version = await prisma.catalogVersion.findFirst({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  const snap = version?.snapshots[0]
  if (!version || !snap) return null
  return { versionId: version.id, label: version.label, payload: snap.payload, hash: snap.payloadHash }
}
