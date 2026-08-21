/* خدمة إدارة الكتالوج — إنشاء كيانات كمسودات وطلبات تغيير محكومة بـ maker-checker.
   دورة حياة الكيان: draft → (طلب تغيير معتمد) approved → (نشر) published.
   لا تعديل بأثر رجعي على المنشور — كل تعديل إصدار جديد. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { assessSkillSelection, skillStateOf } from '../../src/application/catalog/skill-measurement'
import { domainsV2 } from '../../src/domain/diagnostic/v2/data'
import { PERSONA_BASE_TO_STAGES, REACHABLE_LEGACY_GOALS } from '../../src/domain/diagnostic/v2_1/universe'
import { GOALS_V21 } from '../../src/domain/diagnostic/v2_1/maps'

export interface ReadinessStep {
  key: 'basics' | 'courses' | 'profile' | 'domains' | 'impact'
  labelAr: string
  ok: boolean
  /** سبب يُقرأ كما هو: ماذا ينقص وما أثر نقصه */
  reasonAr: string
}

export interface PathwayReadiness {
  pathwayId: string
  steps: ReadinessStep[]
  ok: boolean
}

/** مرجع فحص الأثر لمسار — ثابت كي يجد المعالج فحصه ولا يخلطه بغيره */
export const PATHWAY_IMPACT_REF = (pathwayId: string) => `pathway:${pathwayId}`

export class CatalogAdminService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** نظرة عامة: عدادات الحالات لكل نوع كيان */
  async overview() {
    const groupCount = (rows: { status: string }[]) => {
      const out: Record<string, number> = {}
      for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
      return out
    }
    const [p, c, s, t, q, crs] = await Promise.all([
      this.prisma.pathway.findMany({ select: { status: true } }),
      this.prisma.course.findMany({ select: { status: true } }),
      this.prisma.skill.findMany({ select: { status: true } }),
      this.prisma.compositeTemplate.findMany({ select: { status: true } }),
      this.prisma.question.findMany({ select: { status: true } }),
      this.prisma.contentChangeRequest.findMany({ select: { status: true } }),
    ])
    return {
      pathways: groupCount(p), courses: groupCount(c), skills: groupCount(s),
      templates: groupCount(t), questions: groupCount(q), changeRequests: groupCount(crs),
    }
  }

  async listPathways() {
    const rows = await this.prisma.pathway.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: true },
    })
    return rows.map((p) => ({
      id: p.id, status: p.status, currentVersion: p.currentVersion,
      title: p.versions[0]?.title ?? '', courseCount: p.courses.length,
    }))
  }

  async listCourses() {
    const rows = await this.prisma.course.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, skillLinks: true, pathwayLinks: true },
    })
    return rows.map((c) => ({
      id: c.id, status: c.status, title: c.versions[0]?.titleAr ?? '',
      hours: c.versions[0]?.totalHours ?? 0, skillCount: c.skillLinks.length,
      pathways: c.pathwayLinks.map((l) => l.pathwayId),
    }))
  }

  /**
   * كل المهارات وحالة قياسها (البند ب-٤).
   * الحالة تُحسب من المحرك نفسه (بنك الأسئلة وخطة سطح B2C) لا من عمود في
   * القاعدة — فما يراه المؤلّف هو ما يحدث في جلسة التشخيص فعلا.
   */
  async listSkills() {
    const rows = await this.prisma.skill.findMany({ orderBy: { id: 'asc' } })
    return rows.map((s) => {
      const st = skillStateOf(s.slug, s.nameAr)
      return {
        id: s.id, status: s.status, slug: s.slug, nameAr: s.nameAr, familyId: s.familyId,
        measureState: st.state,
        measuredBy: st.measuredBy,
        decisionRoleAr: st.decisionRoleAr,
        measureNoteAr: st.noteAr,
      }
    })
  }

  async listTemplates() {
    const rows = await this.prisma.compositeTemplate.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: true },
    })
    return rows.map((t) => ({
      id: t.id, status: t.status, name: t.versions[0]?.nameAr ?? '', courseCount: t.courses.length,
    }))
  }

  async listQuestions() {
    const rows = await this.prisma.question.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, options: true },
    })
    return rows.map((q) => ({
      id: q.id, status: q.status, active: q.active, module: q.moduleName ?? q.moduleId ?? '',
      text: q.versions[0]?.textAr ?? '', optionCount: q.options.length,
    }))
  }

  /** إنشاء مهارة جديدة كمسودة — المعرف بصيغة SK-X-* للامتدادات */
  async createSkill(input: { id: string; slug: string; nameAr: string; familyId?: string }, actorId?: string) {
    if (!/^SK-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف المهارة بصيغة SK-XXX-000')
    const dup = await this.prisma.skill.findUnique({ where: { id: input.id } })
    if (dup) throw new AuthError('duplicate_id', 'معرف المهارة موجود مسبقا', 409)
    if (input.familyId) {
      const known = await this.prisma.skill.findFirst({ where: { familyId: input.familyId }, select: { id: true } })
      if (!known) throw new AuthError('unknown_family', 'رمز عائلة المهارة غير معروف في القاموس')
    }
    return this.prisma.skill.create({
      data: {
        id: input.id, slug: input.slug, nameAr: input.nameAr, familyId: input.familyId ?? null,
        status: 'draft',
        versions: { create: { version: 1, nameAr: input.nameAr, status: 'draft', createdBy: actorId } },
      },
    })
  }

  /** إنشاء دورة كمسودة مع وحداتها وروابط مهاراتها */
  async createCourse(input: {
    id: string; pathwayId: string; sequence: number; titleAr: string; shortPromiseAr?: string
    levelAr?: string; totalHours: number; skillIds: string[]
    modules: { sequence: number; titleAr: string; outcomeAr?: string; activityAr?: string; artifactAr?: string; bodyAr?: string; checksAr?: string; videoAr?: string; scenarioAr?: string; hours: number }[]
  }, actorId?: string) {
    if (!/^C-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف الدورة بصيغة C-XXX-000')
    if (await this.prisma.course.findUnique({ where: { id: input.id } })) {
      throw new AuthError('duplicate_id', 'معرف الدورة موجود مسبقا', 409)
    }
    const pathway = await this.prisma.pathway.findUnique({ where: { id: input.pathwayId } })
    if (!pathway) throw new AuthError('unknown_pathway', 'المسار الأم غير موجود')
    const skills = await this.prisma.skill.findMany({ where: { id: { in: input.skillIds } } })
    if (skills.length !== input.skillIds.length) throw new AuthError('unknown_skill', 'مهارة واحدة أو أكثر غير موجودة')
    if (input.modules.length === 0) throw new AuthError('no_modules', 'الدورة بلا وحدات غير مقبولة')

    /* البند ب-٤: تقييم جودة القياس يُحسب ويُعاد مع الردّ — لا يمنع الحفظ.
       المؤلّف يرى أثر اختياره لحظة الحفظ لا بعد أسبوع في ترشيح باهت. */
    const skillAssessment = assessSkillSelection(skills.map((sk) => sk.slug))

    const created = await this.prisma.course.create({
      data: {
        id: input.id, status: 'draft', createdBy: actorId,
        versions: {
          create: {
            version: 1, titleAr: input.titleAr, shortPromiseAr: input.shortPromiseAr,
            levelAr: input.levelAr, totalHours: input.totalHours, status: 'draft', createdBy: actorId,
          },
        },
        skillLinks: { create: input.skillIds.map((skillId) => ({ skillId })) },
        pathwayLinks: { create: { pathwayId: input.pathwayId, sequence: input.sequence } },
        modules: {
          create: input.modules.map((m) => ({
            id: `${input.id}-M${m.sequence}`, status: 'draft',
            versions: {
              create: [{
                version: 1, sequence: m.sequence, titleAr: m.titleAr, outcomeAr: m.outcomeAr,
                activityAr: m.activityAr, artifactAr: m.artifactAr, bodyAr: m.bodyAr ?? null,
                checksAr: m.checksAr ?? null, videoAr: m.videoAr ?? null, scenarioAr: m.scenarioAr ?? null,
                hours: m.hours, status: 'draft',
              }],
            },
          })),
        },
      },
    })
    return { ...created, skillAssessment }
  }

  /** إنشاء مسار كمسودة مرتبط بدورات موجودة */
  async createPathway(input: {
    id: string; title: string; shortTitle?: string; audience?: string; beforeText?: string
    afterText?: string; durationWeeks?: number; weeklyHours?: string; level?: string
    capstone?: string; courseIds: string[]
    /** مجالات المسار (ج-١) — بلا مجال لا يجتاز المسار حاجز النشر ولا يدخل مطابقة الاحتياج */
    domainIds?: string[]
    /** الجمهور والهدف (ج-٣) — الفراغ يجعل المسار يطابق الجميع */
    personas?: string[]
    goals?: string[]
    minWeeklyLoad?: string
    notesAr?: string
  }, actorId?: string) {
    if (!/^PW-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف المسار بصيغة PW-XXX-000')
    if (await this.prisma.pathway.findUnique({ where: { id: input.id } })) {
      throw new AuthError('duplicate_id', 'معرف المسار موجود مسبقا', 409)
    }
    const courses = await this.prisma.course.findMany({ where: { id: { in: input.courseIds } } })
    if (courses.length !== input.courseIds.length) throw new AuthError('unknown_course', 'دورة واحدة أو أكثر غير موجودة')
    const created = await this.prisma.pathway.create({
      data: {
        id: input.id, status: 'draft', createdBy: actorId,
        versions: {
          create: {
            version: 1, title: input.title, shortTitle: input.shortTitle, audience: input.audience,
            beforeText: input.beforeText, afterText: input.afterText, durationWeeks: input.durationWeeks,
            weeklyHours: input.weeklyHours, level: input.level, capstone: input.capstone,
            status: 'draft', createdBy: actorId,
          },
        },
        courses: { create: input.courseIds.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
        domains: { create: this.checkedDomains(input.domainIds ?? []).map((domainId, i) => ({ domainId, orderIndex: i })) },
      },
    })
    /* الملف التشخيصي في نفس العملية حين يُرسَل — كي لا يوجد مسار أُنشئ بجمهور
       ثم ضاع جمهوره لأن المؤلّف أغلق الشاشة قبل نداء ثان. */
    if (input.personas?.length || input.goals?.length) {
      await this.setPathwayProfile(created.id, {
        personas: input.personas ?? [], goals: input.goals ?? [],
        minWeeklyLoad: input.minWeeklyLoad, notesAr: input.notesAr,
      })
    }
    return created
  }

  /** ملف المسار التشخيصي (ج-٣) — الشخصيات والأهداف: بلا واحدة منهما لا يُطابق
      المسار أحدا فلا يُوصى به أبدا. الاستبدال كامل كالمجالات. */
  async setPathwayProfile(pathwayId: string, input: {
    personas: string[]; goals: string[]; minWeeklyLoad?: string; notesAr?: string
    sectors?: string[]; functions?: string[]
  }) {
    if (!(await this.prisma.pathway.findUnique({ where: { id: pathwayId } }))) {
      throw new AuthError('not_found', 'المسار غير موجود', 404)
    }
    const personas = this.checkedKeys(input.personas, new Set(Object.keys(PERSONA_BASE_TO_STAGES)), 'شخصية')
    const goals = this.checkedKeys(input.goals, await this.knownGoals(), 'هدف')
    const profile = {
      personas, goals,
      sectors: input.sectors ?? [],
      functions: input.functions ?? [],
      ...(input.minWeeklyLoad ? { min_weekly_load: input.minWeeklyLoad } : {}),
      ...(input.notesAr ? { notes_ar: input.notesAr } : {}),
    }
    await this.prisma.diagnosticProfile.upsert({
      where: { entityType_entityId: { entityType: 'pathway', entityId: pathwayId } },
      update: {
        profile, audience: personas, goals,
        timeConstraints: input.minWeeklyLoad ? { min_weekly_load: input.minWeeklyLoad } : undefined,
        rationales: input.notesAr ? { notes_ar: input.notesAr } : undefined,
        readinessStatus: 'diagnostic_ready',
      },
      create: {
        entityType: 'pathway', entityId: pathwayId, profile, audience: personas, goals,
        timeConstraints: input.minWeeklyLoad ? { min_weekly_load: input.minWeeklyLoad } : undefined,
        rationales: input.notesAr ? { notes_ar: input.notesAr } : undefined,
        readinessStatus: 'diagnostic_ready',
      },
    })
    /* الأهداف غير القابلة للوصول تُبلَّغ ولا تُرفض: المسار يبقى قابلا للترشيح
       بإشارات أخرى (مجال · مهارة · مرحلة)، لكن المؤلّف يستحق أن يعرف أن هذا
       الهدف بعينه لا يُنتجه تدفق B2C الحالي. */
    const unreachable = goals.filter((g) => !REACHABLE_LEGACY_GOALS.has(g))
    return { pathwayId, personas, goals, unreachableGoals: unreachable }
  }

  /** مفردات الأهداف المقبولة: ما يستطيع تدفق B2C إنتاجه (GOALS_V21) + ما تستعمله
      ملفات المسارات القائمة فعلا. هكذا يُرفض الخطأ الإملائي ولا يُرفض رمزٌ قديم
      مشروع — ورمزٌ لا يُنتجه شيء يطابق لا شيء، فقبوله بلا تنبيه خطأ صامت. */
  private async knownGoals(): Promise<Set<string>> {
    const rows = await this.prisma.diagnosticProfile.findMany({
      where: { entityType: 'pathway' }, select: { goals: true },
    })
    const used = rows.flatMap((r) => (Array.isArray(r.goals) ? (r.goals as string[]) : []))
    return new Set([...REACHABLE_LEGACY_GOALS, ...GOALS_V21.map((g) => g.legacy_goal), ...used])
  }

  /** مفاتيح معروفة بلا تكرار — المجهول يُرفض لا يُحذف صامتا */
  private checkedKeys(keys: string[], known: Set<string>, kindAr: string): string[] {
    const unknown = keys.filter((k) => !known.has(k))
    if (unknown.length > 0) throw new AuthError('unknown_key', `مفتاح ${kindAr} غير معروف: ${unknown.join('، ')}`)
    return [...new Set(keys)]
  }

  /** ربط المسار بمجالاته — الاستبدال كامل، والترتيب هو ترتيب المُدخل (الأول الأقرب).
      بابٌ في الحاجز: بلا هذه العملية يبقى أي مسار يُنشأ بعد النشر عاجزا عن النشر (ج-١). */
  async setPathwayDomains(pathwayId: string, domainIds: string[]) {
    if (!(await this.prisma.pathway.findUnique({ where: { id: pathwayId } }))) {
      throw new AuthError('not_found', 'المسار غير موجود', 404)
    }
    const ids = this.checkedDomains(domainIds)
    await this.prisma.$transaction([
      this.prisma.pathwayDomain.deleteMany({ where: { pathwayId } }),
      this.prisma.pathwayDomain.createMany({
        data: ids.map((domainId, i) => ({ pathwayId, domainId, orderIndex: i })),
      }),
    ])
    return { pathwayId, domainIds: ids }
  }

  /** معرفات مجالات معروفة بلا تكرار — المجهول يُرفض لا يُحذف صامتا:
      معرف غير موجود في التصنيف يطابق لا شيء، فيصير المسار كأنه بلا مجال. */
  private checkedDomains(domainIds: string[]): string[] {
    const known = new Set(domainsV2.map((d) => d.id))
    const unknown = domainIds.filter((d) => !known.has(d as never))
    if (unknown.length > 0) {
      throw new AuthError('unknown_domain', `معرف مجال غير معروف: ${unknown.join('، ')}`)
    }
    return [...new Set(domainIds)]
  }

  /* ═══ ج-٣ · جاهزية المسار — تعريفٌ واحد ═══
     إضافة مسار تتطلب خمسة مواضع، ونقصُ واحدٍ ينتج «جوكرا»: كيانا ينافس الجميع
     أو لا يُوصى به أبدا. الخطوات الخمس هنا هي **نفسها** التي يعرضها المعالج
     ونفسها التي يفحصها حاجز النشر — لأن تعريفين للجاهزية يتباعدان دائما، وقد
     حدث ذلك فعلا في هذا المشروع (ثلاثة أرقام لمفهوم القياس الواحد، البند ب-٤). */

  async pathwayReadiness(pathwayId: string): Promise<PathwayReadiness> {
    const pathway = await this.prisma.pathway.findUnique({
      where: { id: pathwayId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: true, domains: true },
    })
    if (!pathway) throw new AuthError('not_found', 'المسار غير موجود', 404)
    const v = pathway.versions[0]
    const steps: ReadinessStep[] = []

    /* ١) البيانات: عنوان وجمهور وتحوّل قبل/بعد — بلا التحوّل لا يعرف المتعلم ما يشتريه */
    const missingBasics = [
      !v?.title?.trim() && 'العنوان',
      !v?.audience?.trim() && 'الجمهور المستهدف',
      !v?.beforeText?.trim() && 'الحال قبل المسار',
      !v?.afterText?.trim() && 'الحال بعد المسار',
    ].filter((x): x is string => typeof x === 'string')
    steps.push({
      key: 'basics', labelAr: 'بيانات المسار', ok: missingBasics.length === 0,
      reasonAr: missingBasics.length === 0
        ? 'العنوان والجمهور والتحوّل قبل/بعد مكتملة.'
        : `ناقص: ${missingBasics.join(' · ')} — بلا التحوّل لا يعرف المتعلم ما يشتريه.`,
    })

    /* ٢) الدورات: واحدة على الأقل وكلها موجودة وجاهزة للنشر */
    const courseIds = pathway.courses.map((c) => c.courseId)
    const courses = courseIds.length > 0
      ? await this.prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, status: true } })
      : []
    const missingCourses = courseIds.filter((id) => !courses.some((c) => c.id === id))
    const notReady = courses.filter((c) => !['published', 'approved', 'draft'].includes(c.status)).map((c) => c.id)
    steps.push({
      key: 'courses', labelAr: 'الدورات', ok: courseIds.length > 0 && missingCourses.length === 0 && notReady.length === 0,
      reasonAr: courseIds.length === 0
        ? 'بلا دورة واحدة — المسار وعدٌ بلا محتوى.'
        : missingCourses.length > 0 ? `مراجع دورات مفقودة: ${missingCourses.join('، ')}`
        : notReady.length > 0 ? `دورات بحالة غير صالحة: ${notReady.join('، ')}`
        : `${courseIds.length} دورة مرتبطة.`,
    })

    /* ٣) الجمهور والهدف — إلزامي: الفراغ يجعل المسار يطابق كل شخصية وكل هدف */
    const prof = await this.prisma.diagnosticProfile.findUnique({
      where: { entityType_entityId: { entityType: 'pathway', entityId: pathwayId } },
    })
    const personas = (prof?.audience as string[] | null) ?? []
    const goals = (prof?.goals as string[] | null) ?? []
    steps.push({
      key: 'profile', labelAr: 'الجمهور والهدف', ok: personas.length > 0 && goals.length > 0,
      reasonAr: personas.length === 0 && goals.length === 0
        ? 'بلا شخصيات ولا أهداف — الفراغ يجعل المسار يطابق الجميع، فينافس كل مستخدم بلا قيد.'
        : personas.length === 0 ? 'بلا شخصيات — يطابق كل شخصية.'
        : goals.length === 0 ? 'بلا أهداف — يطابق كل هدف.'
        : `${personas.length} شخصية و${goals.length} هدف.`,
    })

    /* ٤) المجال — إلزامي: بلا مجال لا يدخل مطابقة احتياج المستخدم (ج-١) */
    steps.push({
      key: 'domains', labelAr: 'المجال', ok: pathway.domains.length > 0,
      reasonAr: pathway.domains.length > 0
        ? `${pathway.domains.length} مجال: ${pathway.domains.map((d) => d.domainId).join('، ')}`
        : 'بلا مجال — لا يدخل مطابقة المجالات إطلاقا، فيُنشر ولا يُوصى به.',
    })

    /* ٥) فحص الأثر — بعد آخر تعديل على المسار، لا فحصٌ قديم لحالة أخرى */
    const lastImpact = await this.prisma.impactAnalysisRun.findFirst({
      where: { changeRef: PATHWAY_IMPACT_REF(pathwayId) },
      orderBy: { createdAt: 'desc' },
    })
    /* «آخر تعديل» = أحدث ما يمسّ ما سيُنشر: بيانات المسار أو إصداره أو ملفه
       التشخيصي أو مجالاته. تعديل الجمهور أو المجال يجب أن يُبطل فحصا سابقا
       لأنه يغيّر التوصية فعلا — وأخذ updatedAt للمسار وحده كان يمرّره. */
    const editedAt = new Date(Math.max(
      pathway.updatedAt.getTime(),
      v?.createdAt.getTime() ?? 0,
      prof?.updatedAt.getTime() ?? 0,
      ...pathway.domains.map((d) => d.createdAt.getTime()),
    ))
    const fresh = !!lastImpact && lastImpact.createdAt >= editedAt
    steps.push({
      key: 'impact', labelAr: 'فحص الأثر التشخيصي', ok: fresh,
      reasonAr: !lastImpact
        ? 'لم يُفحص أثره على الشخصيات الاثنتي عشرة بعد.'
        : fresh ? `فُحص بعد آخر تعديل (${lastImpact.createdAt.toISOString().slice(0, 16).replace('T', ' ')}).`
        : 'الفحص أقدم من آخر تعديل — أعِد الفحص كي يصف ما ستنشره فعلا.',
    })

    return { pathwayId, steps, ok: steps.every((s2) => s2.ok) }
  }

  /** تقديم طلب تغيير (maker) — لا يُطبَّق شيء قبل الاعتماد */
  async submitChangeRequest(entityType: string, entityId: string, payload: unknown, actorId: string) {
    if (!['pathway', 'course', 'skill', 'question', 'template'].includes(entityType)) {
      throw new AuthError('invalid_entity', 'نوع كيان غير مدعوم')
    }
    return this.prisma.contentChangeRequest.create({
      data: { entityType, entityId, payload: payload as object, status: 'in_review', createdBy: actorId },
    })
  }

  async listChangeRequests(status?: string) {
    const rows = await this.prisma.contentChangeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { decisions: { orderBy: { createdAt: 'desc' } } },
    })
    return rows
  }

  /** قرار مراجعة (checker) — ممنوع أن يعتمد صانعُ الطلب طلبَه بنفسه */
  async decide(changeRequestId: string, decision: 'approve' | 'request_changes' | 'reject', noteAr: string | undefined, actorId: string) {
    const cr = await this.prisma.contentChangeRequest.findUnique({ where: { id: changeRequestId } })
    if (!cr) throw new AuthError('not_found', 'طلب التغيير غير موجود', 404)
    if (cr.status !== 'in_review') throw new AuthError('bad_state', 'الطلب ليس قيد المراجعة', 409)
    if (cr.createdBy === actorId) throw new AuthError('maker_checker', 'لا يجوز اعتماد طلب أنشأته بنفسك (maker-checker)', 403)

    const newStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested'
    return this.prisma.$transaction(async (tx) => {
      await tx.contentApprovalDecision.create({ data: { changeRequestId, actorId, decision, noteAr } })
      const updated = await tx.contentChangeRequest.update({ where: { id: changeRequestId }, data: { status: newStatus, reviewedBy: actorId, reviewedAt: new Date() } })
      /* الاعتماد يرفع الكيان المسودة إلى «approved» استعدادا للنشر */
      if (decision === 'approve') await this.promoteEntity(tx, cr.entityType, cr.entityId, 'draft', 'approved')
      return updated
    })
  }

  /** رفع حالة كيان وإصداره الحالي معا — داخل معاملة القرار أو النشر */
  async promoteEntity(tx: Prisma.TransactionClient, entityType: string, entityId: string, from: string, to: string) {
    if (entityType === 'pathway') {
      const e = await tx.pathway.update({ where: { id: entityId }, data: { status: to } })
      await tx.pathwayVersion.updateMany({ where: { pathwayId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'course') {
      const e = await tx.course.update({ where: { id: entityId }, data: { status: to } })
      await tx.courseVersion.updateMany({ where: { courseId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
      /* الوحدات تتبع دورتها */
      await tx.courseModule.updateMany({ where: { courseId: entityId, status: from }, data: { status: to } })
      await tx.courseModuleVersion.updateMany({ where: { module: { courseId: entityId }, status: from }, data: { status: to } })
    } else if (entityType === 'skill') {
      const e = await tx.skill.update({ where: { id: entityId }, data: { status: to } })
      await tx.skillVersion.updateMany({ where: { skillId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'question') {
      const e = await tx.question.update({ where: { id: entityId }, data: { status: to } })
      await tx.questionVersion.updateMany({ where: { questionId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'template') {
      const e = await tx.compositeTemplate.update({ where: { id: entityId }, data: { status: to } })
      await tx.compositeTemplateVersion.updateMany({ where: { templateId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    }
  }
}
