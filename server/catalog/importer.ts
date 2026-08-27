/* مستورد الكتالوج الأكاديمي — idempotent بالكامل.
   يستورد من ملفات JSON الموثقة (مصدر الحقيقة) إلى PostgreSQL:
   20 مسارا + 16 قالبا + 100 دورة + 400 وحدة + 305 مهارات + 192 سؤالا + العلاقات + المراجع.
   لا يستورد أي بيانات تشغيلية أو توضيحية (لا مدربين ولا طلابا ولا شعبا ولا مدفوعات).
   المعرفات الثابتة (PW-/C-/TPL-/SK-/QB-) تُحفظ كما هي؛ تشغيله مرتين لا يكرر شيئا. */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { assertCatalogSourceValid } from './validate-source'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

/** يستخرج عددا صحيحا من قيمة قد تكون نصا («4» أو «4-6 ساعات») وإلا null */
const toInt = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string') {
    const m = /(\d+)/.exec(v)
    return m ? parseInt(m[1], 10) : null
  }
  return null
}

export interface ImportStats {
  pathways: number
  courses: number
  modules: number
  skills: number
  questions: number
  options: number
  templates: number
  references: number
  links: number
  diagnosticProfiles: number
  pathwayDomains: number
  catalogVersionId: string
  catalogVersionCreated: boolean
  snapshotHash: string
  /** بصمة ملفات المستودع الآن — تُقارن باللقطة المنشورة لكشف الانحراف */
  repoSnapshotHash: string
  /** اللقطة المنشورة لا تطابق ملفات المستودع: الجداول حُدِّثت والمحرك ما زال يقرأ القديم */
  snapshotStale: boolean
}

/* ── أنواع مصادر JSON ── */
interface RawSkill {
  skill_id: string; slug: string; name_ar: string; name_en?: string
  family_ar?: string; family_id?: string; definition_ar?: string
  mastery_indicators_ar?: unknown; evidence_examples_ar?: unknown
  source_frameworks?: unknown; related_question_measures?: string[]; active?: boolean
  /* ج-٢: قرار الدمج — تحتاجه طبقات المهارات المولّدة وقت النشر */
  merged_into?: string; merge_date?: string
}
interface RawPathway {
  id: string; title: string; short_title?: string; audience?: string; not_for?: string
  entry?: string; before?: string; after?: string; duration_weeks?: number
  weekly_hours?: string | number; level?: string; delivery?: string; capstone?: string
  outcome_metric?: string; credential_ar?: string; course_ids: string[]
}
interface RawCourse {
  course_id: string; pathway_id: string; sequence: number; title_ar: string
  legacy_title_ar?: string; subtitle_ar?: string; short_promise_ar?: string
  description_ar?: string; target_audience_ar?: string; prerequisites_ar?: string
  level_ar?: string; total_hours: number; skill_ids?: string[]; skill_slugs?: string[]
  skill_names_ar?: string[]; learning_objectives_ar?: string[]; learning_outcomes_ar?: string[]
  summative_assessment_ar?: string
}
interface RawModule {
  module_id: string; course_id: string; sequence: number; title_ar: string
  module_outcome_ar?: string; practice_activity_ar?: string; evidence_artifact_ar?: string
  /** متن الدرس (ح-١) — اختياري في المصدر */
  module_body_ar?: string
  /** تمرين الاسترجاع (ح-٣) — اختياري في المصدر */
  module_checks_ar?: string
  /** فيديو الوحدة وفصوله (ح-٢) — اختياري في المصدر */
  module_video_ar?: string
  module_scenario_ar?: string
  expected_hours: number
}
interface RawTemplateCourseRef {
  course_id: string; sequence?: number; role_ar?: string; reason_ar?: string; condition_ar?: string
}
interface RawTemplate {
  template_id: string; name_ar: string; short_name_ar?: string; intent_ar?: string
  persona?: unknown; transformation?: unknown; plan?: unknown; diagnostic?: unknown
  status?: string; not_counted_as_pathway?: boolean
  required_courses?: RawTemplateCourseRef[]; conditional_courses?: RawTemplateCourseRef[]
  bridge_courses?: RawTemplateCourseRef[]; starter_courses?: RawTemplateCourseRef[]
}
interface RawQuestion {
  question_id: string; module_id?: string; module_name?: string; text_ar: string
  answer_type: string; options_ar: string[]; options_key?: string | null
  persona_scope?: string[]; trigger_condition?: string; measures?: string[]
  decision_impact?: string; sensitivity_level?: string; required_level?: string
  weight?: number; active?: boolean
}
interface RawReference {
  id: string; name_ar: string; organization?: string; source_url?: string
  implementation_status?: string; implementation_evidence?: string
}

export const IMPORT_VERSION_LABEL = 'catalog-v2.0-import'

export async function importCatalog(prisma: PrismaClient): Promise<ImportStats> {
  /* البند أ-١: البوابة أول شيء وقبل أي كتابة. موضعها هنا لا في السكربت وحده
     حتى لا يوجد مسار استيراد يتخطّاها — لا من CLI ولا من اختبار ولا من الإدارة.
     ترمي عند العطل، فلا نصف كتالوج في القاعدة. */
  assertCatalogSourceValid()

  const core = readJson('src/data/catalog/core-catalog.v2.json')
  const templatesFile = readJson('src/data/catalog/composite-templates.v1.json')
  const skillsFile = readJson('src/data/catalog/skills.v1.ar.json')
  const questionsFile = readJson('src/data/catalog/questions.v1.ar.json')
  const refsFile = readJson('src/data/methodology-references.v1.json')
  const optionEffects = readJson('src/data/overlays/option-effects.v2.json')
  const pathwayProfiles = readJson('src/data/overlays/pathway-profiles.v1.json')
  const domainsFile = readJson('src/data/catalog/v2/pathway-domains.v2.json')

  const pathways = core.launch_pathways as RawPathway[]
  const courses = core.courses as RawCourse[]
  const modules = core.modules as RawModule[]
  const skills = [...(skillsFile.skills as RawSkill[]), ...((core.skill_extensions ?? []) as RawSkill[])]
  const questions = questionsFile.questions as RawQuestion[]
  const templates = templatesFile.templates as RawTemplate[]
  const references = refsFile.references as RawReference[]

  let links = 0

  /* 1) المهارات */
  for (const s of skills) {
    await prisma.skill.upsert({
      where: { id: s.skill_id },
      /* التحديث يحمل قرار الدمج والتفعيل: قاعدة قائمة قبل ج-٢ تُصحَّح بإعادة
         الاستيراد بلا حذف — وبلا ذلك تبقى المهارة المدموجة «نشطة» في الطبقات. */
      update: {
        familyId: s.family_id ?? null,
        familyAr: s.family_ar ?? null,
        active: s.active !== false,
        mergedInto: s.merged_into ?? null,
        mergeDate: s.merge_date ?? null,
        /* الأطر المرجعية تعبر إلى اللقطة (موجة ٦ · ج) — قاعدة قائمة تُصحَّح
           بإعادة الاستيراد بلا حذف، وبلا ذلك تبقى مراجع المنهجية غائبة. */
        source: Array.isArray(s.source_frameworks) ? (s.source_frameworks as string[]).join('، ') : null,
        /* وهذه كانت تنقص: إعادة تسمية مهارة أو تحرير تعريفها في المستودع لا
           تصل قاعدة قائمة أبدا — والاسم هو ما يقرأه المستخدم في نتيجته. */
        nameAr: s.name_ar, definitionAr: s.definition_ar ?? null,
        domain: s.family_ar ?? s.family_id ?? null,
        masteryScale: s.mastery_indicators_ar === undefined ? undefined : JSON.parse(JSON.stringify(s.mastery_indicators_ar)),
        evidenceExamples: s.evidence_examples_ar === undefined ? undefined : JSON.parse(JSON.stringify(s.evidence_examples_ar)),
        status: s.active === false ? 'archived' : 'published',
      },
      create: {
        id: s.skill_id, slug: s.slug, nameAr: s.name_ar, definitionAr: s.definition_ar ?? null,
        familyAr: s.family_ar ?? null,
        active: s.active !== false, mergedInto: s.merged_into ?? null, mergeDate: s.merge_date ?? null,
        familyId: s.family_id ?? null,
        domain: s.family_ar ?? s.family_id ?? null,
        source: Array.isArray(s.source_frameworks) ? (s.source_frameworks as string[]).join('، ') : null,
        masteryScale: s.mastery_indicators_ar === undefined ? undefined : JSON.parse(JSON.stringify(s.mastery_indicators_ar)),
        evidenceExamples: s.evidence_examples_ar === undefined ? undefined : JSON.parse(JSON.stringify(s.evidence_examples_ar)),
        status: s.active === false ? 'archived' : 'published',
      },
    })
    await prisma.skillVersion.upsert({
      where: { skillId_version: { skillId: s.skill_id, version: 1 } },
      update: { nameAr: s.name_ar, definitionAr: s.definition_ar ?? null, status: 'published' },
      create: { skillId: s.skill_id, version: 1, nameAr: s.name_ar, definitionAr: s.definition_ar ?? null, status: 'published' },
    })
  }
  const skillIdBySlug = new Map(skills.map((s) => [s.slug, s.skill_id]))

  /* 2) المسارات + إصدار أول — الروابط تُنشأ بعد وجود الدورات (قسم 3ب) */
  for (const p of pathways) {
    await prisma.pathway.upsert({
      where: { id: p.id },
      update: { status: 'published' },
      create: { id: p.id, status: 'published', currentVersion: 1 },
    })
    await prisma.pathwayVersion.upsert({
      where: { pathwayId_version: { pathwayId: p.id, version: 1 } },
      update: {
        title: p.title, shortTitle: p.short_title ?? null,
        audience: p.audience ?? null, notFor: p.not_for ?? null, entry: p.entry ?? null,
        beforeText: p.before ?? null, afterText: p.after ?? null,
        durationWeeks: toInt(p.duration_weeks), weeklyHours: p.weekly_hours == null ? null : String(p.weekly_hours),
        level: p.level ?? null, delivery: p.delivery ?? null, capstone: p.capstone ?? null,
        outcomeMetric: p.outcome_metric ?? null, credentialAr: p.credential_ar ?? null,
        status: 'published',
      },
      create: {
        pathwayId: p.id, version: 1, title: p.title, shortTitle: p.short_title ?? null,
        audience: p.audience ?? null, notFor: p.not_for ?? null, entry: p.entry ?? null,
        beforeText: p.before ?? null, afterText: p.after ?? null,
        durationWeeks: toInt(p.duration_weeks), weeklyHours: p.weekly_hours == null ? null : String(p.weekly_hours),
        level: p.level ?? null, delivery: p.delivery ?? null, capstone: p.capstone ?? null,
        outcomeMetric: p.outcome_metric ?? null, credentialAr: p.credential_ar ?? null,
        status: 'published',
      },
    })
  }

  /* 3) الدورات + إصداراتها + أهدافها ومخرجاتها ومشاريعها + روابط المهارات */
  for (const c of courses) {
    await prisma.course.upsert({
      where: { id: c.course_id },
      update: { status: 'published' },
      create: { id: c.course_id, status: 'published', currentVersion: 1 },
    })
    const cv = await prisma.courseVersion.upsert({
      where: { courseId_version: { courseId: c.course_id, version: 1 } },
      update: {
        titleAr: c.title_ar, legacyTitleAr: c.legacy_title_ar ?? null,
        shortPromiseAr: c.short_promise_ar ?? c.subtitle_ar ?? null, descriptionAr: c.description_ar ?? null,
        audienceAr: c.target_audience_ar ?? null, prerequisitesAr: c.prerequisites_ar ?? null,
        levelAr: c.level_ar ?? null, totalHours: toInt(c.total_hours) ?? 0, status: 'published',
      },
      create: {
        courseId: c.course_id, version: 1, titleAr: c.title_ar, legacyTitleAr: c.legacy_title_ar ?? null,
        shortPromiseAr: c.short_promise_ar ?? c.subtitle_ar ?? null, descriptionAr: c.description_ar ?? null,
        audienceAr: c.target_audience_ar ?? null, prerequisitesAr: c.prerequisites_ar ?? null,
        levelAr: c.level_ar ?? null, totalHours: toInt(c.total_hours) ?? 0, status: 'published',
      },
    })
    for (const [i, text] of (c.learning_objectives_ar ?? []).entries()) {
      await prisma.learningObjective.upsert({
        where: { id: deterministicUuid(`obj:${c.course_id}:${i}`) },
        update: { sequence: i + 1, textAr: text },
        create: { id: deterministicUuid(`obj:${c.course_id}:${i}`), courseVersionId: cv.id, sequence: i + 1, textAr: text },
      })
    }
    for (const [i, text] of (c.learning_outcomes_ar ?? []).entries()) {
      await prisma.learningOutcome.upsert({
        where: { id: deterministicUuid(`out:${c.course_id}:${i}`) },
        update: { sequence: i + 1, textAr: text },
        create: { id: deterministicUuid(`out:${c.course_id}:${i}`), courseVersionId: cv.id, sequence: i + 1, textAr: text },
      })
    }
    if (c.summative_assessment_ar) {
      await prisma.practicalProject.upsert({
        where: { courseVersionId: cv.id },
        update: { descriptionAr: c.summative_assessment_ar },
        create: { courseVersionId: cv.id, descriptionAr: c.summative_assessment_ar },
      })
    }
    /* روابط المهارات — بمعرفات SK الثابتة، مع جسر slug عند الحاجة */
    const skillIds = new Set<string>([
      ...(c.skill_ids ?? []),
      ...(c.skill_slugs ?? []).map((slug) => skillIdBySlug.get(slug)).filter((x): x is string => Boolean(x)),
    ])
    for (const skillId of skillIds) {
      await prisma.courseSkillLink.upsert({
        where: { courseId_skillId: { courseId: c.course_id, skillId } },
        update: { targetLevel: 3, weight: 1 },
        create: { courseId: c.course_id, skillId, targetLevel: 3, weight: 1 },
      })
      links++
    }
  }

  /* 3ب) روابط المسارات: الدورات (مرجعية) + متطلبات المهارات المشتقة — بعد وجود الدورات */
  for (const p of pathways) {
    for (const [i, cid] of p.course_ids.entries()) {
      await prisma.pathwayCourse.upsert({
        where: { pathwayId_courseId: { pathwayId: p.id, courseId: cid } },
        update: { sequence: i + 1 },
        create: { pathwayId: p.id, courseId: cid, sequence: i + 1, kind: 'required' },
      })
      links++
    }
    /* متطلبات مهارات المسار: اجتماع مهارات دوراته (مصدر واحد مشتق، لا نسخة مستقلة) */
    const seen = new Set<string>()
    for (const cid of p.course_ids) {
      const c = courses.find((x) => x.course_id === cid)
      for (const slug of c?.skill_slugs ?? []) {
        const skillId = skillIdBySlug.get(slug)
        if (!skillId || seen.has(skillId)) continue
        seen.add(skillId)
        await prisma.pathwaySkillRequirement.upsert({
          where: { pathwayId_skillId: { pathwayId: p.id, skillId } },
          update: { requiredLevel: 3, priority: 'medium', weight: 1 },
          create: { pathwayId: p.id, skillId, requiredLevel: 3, priority: 'medium', weight: 1 },
        })
        links++
      }
    }
  }

  /* 4) الوحدات — لا تُحذف أبدا؛ الإصدار الأول يُنشأ مرة واحدة */
  for (const m of modules) {
    await prisma.courseModule.upsert({
      where: { id: m.module_id },
      update: { courseId: m.course_id, status: 'published' },
      create: { id: m.module_id, courseId: m.course_id, status: 'published' },
    })
    await prisma.courseModuleVersion.upsert({
      where: { moduleId_version: { moduleId: m.module_id, version: 1 } },
      update: {
        sequence: toInt(m.sequence) ?? 1, titleAr: m.title_ar,
        outcomeAr: m.module_outcome_ar ?? null, activityAr: m.practice_activity_ar ?? null,
        artifactAr: m.evidence_artifact_ar ?? null, bodyAr: m.module_body_ar ?? null,
        checksAr: m.module_checks_ar ?? null, videoAr: m.module_video_ar ?? null,
        scenarioAr: m.module_scenario_ar ?? null,
        hours: toInt(m.expected_hours) ?? 0, status: 'published',
      },
      create: {
        moduleId: m.module_id, version: 1, sequence: toInt(m.sequence) ?? 1, titleAr: m.title_ar,
        outcomeAr: m.module_outcome_ar ?? null, activityAr: m.practice_activity_ar ?? null,
        artifactAr: m.evidence_artifact_ar ?? null, bodyAr: m.module_body_ar ?? null,
        checksAr: m.module_checks_ar ?? null, videoAr: m.module_video_ar ?? null,
        scenarioAr: m.module_scenario_ar ?? null,
        hours: toInt(m.expected_hours) ?? 0, status: 'published',
      },
    })
  }

  /* 5) القوالب المركبة + إصداراتها + روابط الدورات الأربع */
  for (const t of templates) {
    await prisma.compositeTemplate.upsert({
      where: { id: t.template_id },
      update: { status: 'published', notCountedAsPathway: t.not_counted_as_pathway ?? true },
      create: { id: t.template_id, status: 'published', currentVersion: 1, notCountedAsPathway: t.not_counted_as_pathway ?? true },
    })
    await prisma.compositeTemplateVersion.upsert({
      where: { templateId_version: { templateId: t.template_id, version: 1 } },
      update: {
        nameAr: t.name_ar, shortNameAr: t.short_name_ar ?? null,
        intentAr: t.intent_ar ?? null,
        persona: t.persona === undefined ? undefined : JSON.parse(JSON.stringify(t.persona)),
        transformation: t.transformation === undefined ? undefined : JSON.parse(JSON.stringify(t.transformation)),
        plan: t.plan === undefined ? undefined : JSON.parse(JSON.stringify(t.plan)),
        diagnostic: t.diagnostic === undefined ? undefined : JSON.parse(JSON.stringify(t.diagnostic)),
        status: 'published',
      },
      create: {
        templateId: t.template_id, version: 1, nameAr: t.name_ar, shortNameAr: t.short_name_ar ?? null,
        intentAr: t.intent_ar ?? null,
        persona: t.persona === undefined ? undefined : JSON.parse(JSON.stringify(t.persona)),
        transformation: t.transformation === undefined ? undefined : JSON.parse(JSON.stringify(t.transformation)),
        plan: t.plan === undefined ? undefined : JSON.parse(JSON.stringify(t.plan)),
        diagnostic: t.diagnostic === undefined ? undefined : JSON.parse(JSON.stringify(t.diagnostic)),
        status: 'published',
      },
    })
    const lists: [string, RawTemplateCourseRef[]][] = [
      ['required', t.required_courses ?? []], ['conditional', t.conditional_courses ?? []],
      ['bridge', t.bridge_courses ?? []], ['starter', t.starter_courses ?? []],
    ]
    for (const [listType, refs] of lists) {
      for (const [i, r] of refs.entries()) {
        await prisma.templateCourse.upsert({
          where: { templateId_courseId_listType: { templateId: t.template_id, courseId: r.course_id, listType } },
          /* الدور والسبب والشرط نصوص من المستودع تُعرض للمستخدم في التوصية —
             وبلا تحديثها يبقى القالب القائم على نصوص أول استيراد. */
          update: {
            sequence: r.sequence ?? i + 1, roleAr: r.role_ar ?? null,
            reasonAr: r.reason_ar ?? null, conditionAr: r.condition_ar ?? null,
          },
          create: {
            templateId: t.template_id, courseId: r.course_id, listType,
            sequence: r.sequence ?? i + 1, roleAr: r.role_ar ?? null,
            reasonAr: r.reason_ar ?? null, conditionAr: r.condition_ar ?? null,
          },
        })
        links++
      }
    }
  }

  /* 6) بنك الأسئلة + الخيارات بمعرفات ثابتة o1.. + الآثار + روابط المهارات */
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.question_id },
      /* update يعكس create حقلا بحقل عدا المعرّف. كانت تنقصه خمسة، وكلها
         تصمت بدل أن تُعطب: `active` فلا يصل تقاعد سؤال، و`measures` فتبقى
         الأسئلة موجّهة إلى slug قديم غير مسجّل — فتخرج إجابتها من متجه
         المهارات بلا خطأ يُرى. خمسة أسئلة M4 عاشت كذلك في الإنتاج. */
      update: {
        moduleId: q.module_id ?? null, moduleName: q.module_name ?? null,
        answerType: q.answer_type, optionsKey: q.options_key ?? null,
        personaScope: q.persona_scope ?? [], measures: q.measures ?? [],
        triggerCondition: q.trigger_condition ?? 'always', reasonAr: q.decision_impact ?? null,
        sensitivityLevel: q.sensitivity_level ?? 'low', requiredLevel: q.required_level ?? 'core',
        weight: typeof q.weight === 'number' ? q.weight : 1,
        active: q.active !== false, status: 'published',
      },
      create: {
        id: q.question_id, moduleId: q.module_id ?? null, moduleName: q.module_name ?? null,
        answerType: q.answer_type, optionsKey: q.options_key ?? null,
        personaScope: q.persona_scope ?? [], measures: q.measures ?? [],
        triggerCondition: q.trigger_condition ?? 'always', reasonAr: q.decision_impact ?? null,
        sensitivityLevel: q.sensitivity_level ?? 'low', requiredLevel: q.required_level ?? 'core',
        weight: typeof q.weight === 'number' ? q.weight : 1,
        active: q.active !== false, status: 'published',
      },
    })
    await prisma.questionVersion.upsert({
      where: { questionId_version: { questionId: q.question_id, version: 1 } },
      update: { textAr: q.text_ar, status: 'published' },
      create: { questionId: q.question_id, version: 1, textAr: q.text_ar, status: 'published' },
    })
    const effects = optionEffects.option_effects?.[q.question_id] as Record<string, unknown> | undefined
    for (const [i, text] of q.options_ar.entries()) {
      const optionId = `o${i + 1}`
      await prisma.questionOption.upsert({
        where: { questionId_optionId: { questionId: q.question_id, optionId } },
        update: {
          orderIndex: i, textAr: text,
          effects: effects?.[optionId] === undefined ? undefined : JSON.parse(JSON.stringify(effects[optionId])),
        },
        create: {
          questionId: q.question_id, optionId, orderIndex: i, textAr: text,
          effects: effects?.[optionId] === undefined ? undefined : JSON.parse(JSON.stringify(effects[optionId])),
        },
      })
    }
  }
  /* روابط سؤال↔مهارة: تقاطع measures السؤال مع related_question_measures للمهارة */
  for (const s of skills) {
    const measures = new Set(s.related_question_measures ?? [])
    if (measures.size === 0) continue
    for (const q of questions) {
      if (!(q.measures ?? []).some((m) => measures.has(m))) continue
      await prisma.questionSkillLink.upsert({
        where: { questionId_skillId: { questionId: q.question_id, skillId: s.skill_id } },
        update: { weight: 1 },
        create: { questionId: q.question_id, skillId: s.skill_id, weight: 1 },
      })
      links++
    }
  }

  /* 7) المراجع المنهجية */
  for (const r of references) {
    await prisma.methodologyReference.upsert({
      where: { code: r.id },
      update: {
        titleAr: r.name_ar, publisherAr: r.organization ?? null,
        url: r.source_url ?? null, status: r.implementation_status ?? 'implemented',
        evidenceAr: r.implementation_evidence ?? null,
      },
      create: {
        code: r.id, titleAr: r.name_ar, publisherAr: r.organization ?? null,
        url: r.source_url ?? null, status: r.implementation_status ?? 'implemented',
        evidenceAr: r.implementation_evidence ?? null,
      },
    })
  }

  /* 8) الملفات التشخيصية: مسارات + قوالب — جاهزيتها من مصادرها الموثقة */
  let diagnosticProfiles = 0
  for (const p of pathways) {
    const profile = pathwayProfiles.profiles?.[p.id]
    await prisma.diagnosticProfile.upsert({
      where: { entityType_entityId: { entityType: 'pathway', entityId: p.id } },
      /* الحقول المشتقة من الملف تُحدَّث معه — وإلا بقيت الجماهير والأهداف
         وقيود الوقت على أول استيراد بينما profile نفسه يتقدّم. */
      update: {
        profile: profile === undefined ? undefined : JSON.parse(JSON.stringify(profile)),
        audience: profile?.personas === undefined ? undefined : JSON.parse(JSON.stringify(profile.personas)),
        goals: profile?.goals === undefined ? undefined : JSON.parse(JSON.stringify(profile.goals)),
        timeConstraints: profile?.min_weekly_load === undefined ? undefined : JSON.parse(JSON.stringify({ min_weekly_load: profile.min_weekly_load })),
        rationales: profile?.notes_ar === undefined ? undefined : JSON.parse(JSON.stringify({ notes_ar: profile.notes_ar })),
      },
      create: {
        entityType: 'pathway', entityId: p.id,
        profile: profile === undefined ? undefined : JSON.parse(JSON.stringify(profile)),
        audience: profile?.personas === undefined ? undefined : JSON.parse(JSON.stringify(profile.personas)),
        goals: profile?.goals === undefined ? undefined : JSON.parse(JSON.stringify(profile.goals)),
        timeConstraints: profile?.min_weekly_load === undefined ? undefined : JSON.parse(JSON.stringify({ min_weekly_load: profile.min_weekly_load })),
        rationales: profile?.notes_ar === undefined ? undefined : JSON.parse(JSON.stringify({ notes_ar: profile.notes_ar })),
        readinessStatus: 'diagnostic_ready',
      },
    })
    diagnosticProfiles++
  }
  for (const t of templates) {
    await prisma.diagnosticProfile.upsert({
      where: { entityType_entityId: { entityType: 'template', entityId: t.template_id } },
      update: {
        eligibility: JSON.parse(JSON.stringify((t.diagnostic as Record<string, unknown>) ?? {})),
        readinessStatus: 'diagnostic_ready',
      },
      create: {
        entityType: 'template', entityId: t.template_id,
        eligibility: JSON.parse(JSON.stringify((t.diagnostic as Record<string, unknown>) ?? {})),
        readinessStatus: 'diagnostic_ready',
      },
    })
    diagnosticProfiles++
  }

  /* 8ب) مجالات المسارات (ج-١) — صفوف تُنشر داخل اللقطة، لا استيراد وقت بناء الواجهة.
     الحذف قبل الإنشاء لكل مسار: إن قُلّصت قائمة مجالاته في المصدر لا يبقى صف قديم. */
  let pathwayDomains = 0
  const domainMap = (domainsFile.pathway_domains ?? {}) as Record<string, string[]>
  for (const p of pathways) {
    const ids = domainMap[p.id] ?? []
    await prisma.pathwayDomain.deleteMany({ where: { pathwayId: p.id, domainId: { notIn: ids.length > 0 ? ids : ['__none__'] } } })
    for (const [i, domainId] of ids.entries()) {
      await prisma.pathwayDomain.upsert({
        where: { pathwayId_domainId: { pathwayId: p.id, domainId } },
        update: { orderIndex: i },
        create: { pathwayId: p.id, domainId, orderIndex: i },
      })
      pathwayDomains++
    }
  }

  /* 9) إصدارات التقييم والتوصية الأولى */
  await prisma.scoringConfigVersion.upsert({
    where: { version: 1 },
    update: { config: readJson('src/data/overlays/option-effects.v2.json').metadata ?? {}, status: 'published' },
    create: { version: 1, config: readJson('src/data/overlays/option-effects.v2.json').metadata ?? {}, status: 'published', publishedAt: new Date() },
  })
  await prisma.recommendationVersion.upsert({
    where: { version: 1 },
    update: { rules: { source: 'composite-templates.v1.json', variant_policy: 'starter|full|extended' }, status: 'published' },
    create: { version: 1, rules: { source: 'composite-templates.v1.json', variant_policy: 'starter|full|extended' }, status: 'published', publishedAt: new Date() },
  })

  /* 10) إصدار الكتالوج الأول + اللقطة المجمدة التي يقرأها المحرك.

     اللقطة تُبنى مرة واحدة عند أول استيراد فقط، لأن تسمية الإصدار ثابتة. وهذا
     مقصود: النشر إلى منصة حيّة يمرّ بلوحة النشر (مسودة ← تحقق ← تحليل أثر على
     12 شخصية ← نشر ذرّي ← تراجع)، ولا يجوز أن يستبدلها استيراد من سطر الأوامر.

     لكن الصمت كان الخطأ: الاستيراد يحدّث الجداول ثم يُنهي بـ«✅ اكتمل» بينما
     المحرك ما زال يقرأ لقطة قديمة — فيظن المشغّل أن التغيير وصل المستخدم وهو لم
     يصل. نقارن الآن بصمة ملفات المستودع باللقطة المنشورة ونرفع العلم صراحة. */
  const snapshotPayload = {
    questions: questionsFile,
    skills: skillsFile,
    coreCatalog: core,
    templates: templatesFile,
    optionEffects,
    pathwayProfiles,
    pathwayDomains: { pathway_domains: domainMap },
  }
  const repoHash = createHash('sha256').update(JSON.stringify(snapshotPayload)).digest('hex')

  let catalogVersion = await prisma.catalogVersion.findUnique({ where: { label: IMPORT_VERSION_LABEL } })
  let created = false
  if (!catalogVersion) {
    catalogVersion = await prisma.catalogVersion.create({
      data: {
        label: IMPORT_VERSION_LABEL, status: 'published', publishedAt: new Date(),
        snapshots: { create: { payload: snapshotPayload, payloadHash: repoHash } },
        events: { create: { action: 'publish', details: { source: 'import-catalog', hash: repoHash } } },
      },
    })
    created = true
  }
  const snapshot = await prisma.catalogSnapshot.findFirst({ where: { catalogVersionId: catalogVersion.id } })

  /* اللقطة الفعالة قد تكون من إصدار أحدث نشرته اللوحة — نقارن بالمنشور لا
     بلقطة الاستيراد وحدها، وإلا صرخنا عند كل نشر سليم. */
  const publishedNow = await prisma.catalogVersion.findFirst({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  const liveHash = publishedNow?.snapshots[0]?.payloadHash ?? ''
  const snapshotStale = !created && liveHash !== repoHash

  return {
    pathways: pathways.length, courses: courses.length, modules: modules.length,
    skills: skills.length, questions: questions.length,
    options: questions.reduce((n, q) => n + q.options_ar.length, 0),
    templates: templates.length, references: references.length, links, diagnosticProfiles,
    pathwayDomains,
    catalogVersionId: catalogVersion.id, catalogVersionCreated: created,
    snapshotHash: snapshot?.payloadHash ?? '',
    repoSnapshotHash: repoHash, snapshotStale,
  }
}

/** UUID حتمي من نص — لصفوف الاستيراد الفرعية حتى يبقى الاستيراد idempotent */
function deterministicUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
