/* خدمة إدارة الكتالوج — إنشاء كيانات كمسودات وطلبات تغيير محكومة بـ maker-checker.
   دورة حياة الكيان: draft → (طلب تغيير معتمد) approved → (نشر) published.
   لا تعديل بأثر رجعي على المنشور — كل تعديل إصدار جديد. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { assessSkillSelection, skillStateOf } from '../../src/application/catalog/skill-measurement'
import { normalizeAr } from '../../src/application/text/search-ar'
import { COURSE_DOMAIN_FAMILIES, courseDomain } from '../../src/application/catalog/course-domain'
import { domainsV2 } from '../../src/domain/diagnostic/v2/data'
import { PERSONA_BASE_TO_STAGES, REACHABLE_LEGACY_GOALS } from '../../src/domain/diagnostic/v2_1/universe'
import { CAREER_STAGE_LABELS_AR, GOALS_V21 } from '../../src/domain/diagnostic/v2_1/maps'
import type { PermissionKey } from '../auth/permissions'

/* حبّةُ استثناء maker-checker — تُكتب مرّةً واحدةً، ونوعُها من فهرس الصلاحيّات
   نفسِه: فإن زالت من الفهرس أو تغيّر حرفٌ في اسمها لم تُترجَم الشيفرةُ أصلا،
   ولا تصمت الحبّةُ الميّتةُ صمتَ النصّ المطابَق. */
const SELF_APPROVE: PermissionKey = 'catalog.self_approve'

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
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        skillLinks: true,
        /* اسمُ المسار لا معرّفُه: مرشِّحُ «المجال» في شاشة الشعب يُبنى منه،
           وكان يقرؤه من الكتالوج المضمَّن — فيخرج فارغا دائما. */
        pathwayLinks: {
          include: { pathway: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
        },
      },
    })
    return rows.map((c) => ({
      id: c.id, status: c.status, title: c.versions[0]?.titleAr ?? '',
      hours: c.versions[0]?.totalHours ?? 0, skillCount: c.skillLinks.length,
      /* والمعرّفاتُ لا العددُ وحدَه (ك-٣): من يُصلح دورةً بلا مهاراتٍ يحتاج
         أن يرى ما عليها الآن قبل أن يبدّله — والعددُ لا يقول ذلك. */
      skillIds: c.skillLinks.map((l) => l.skillId),
      pathways: c.pathwayLinks.map((l) => l.pathwayId),
      pathwayNames: c.pathwayLinks
        .map((l) => l.pathway?.versions[0]?.title)
        .filter((t): t is string => Boolean(t)),
      /* السعرُ يُعاد من هنا لأنّ هذا هو المصدرُ الذي يرثه `createCohort`
         (`cohort.service.ts` → `course.listPrice`). وكانت الشاشةُ تقرؤه من
         الكتالوج المضمَّن، وهو لا يُملأ في لوحة الإدارة أصلا — فتقول «بلا
         سعر» ثمّ تُنشئ شعبةً بـ١٢٥ دولارا. */
      listPrice: c.listPrice != null ? Number(c.listPrice) : null,
      listCurrency: c.listCurrency ?? 'USD',
      /* ك-٥: إذنُ ترشيحِها وحدَها ومجالُها — تُقرآن في الصفّ فيُعرف حالُ
         دورةٍ بلا مسارٍ بلا فتح شاشةٍ أخرى. */
      recommendableDirectly: c.recommendableDirectly,
      diagnosticDomains: c.diagnosticDomains,
      diagnosticStages: c.diagnosticStages,
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

  /* ═══ مهارةٌ جديدةٌ تُولد بقصدٍ ويُعرف من ولّدها (ح-٤) ═══

     المهارةُ عملةُ «مؤشّر وجيز»: بها يُقاس كلُّ متعلّمٍ وعليها يُرشَّح كلُّ
     مسار. فإدخالُ واحدةٍ جديدةٍ **يغيّر كيف يُقاس الناسُ جميعا** — لا كيف
     تُعرض دورةٌ واحدة.

     وكان البابُ مفتوحا على مصراعَيه في موضعَين:

     ① **لا أثرَ يُكتب**. تُنشأ المهارةُ فلا يبقى في السجلّ أنّها أُنشئت ولا
        من أنشأها. ونظيرُها `catalog.course.skills_set` يُسجَّل — فربطُ
        مهارةٍ قائمةٍ بدورةٍ كان أوثقَ توثيقا من خلقِ المهارة نفسِها.

     ② **ولا شيءَ يقول «هي موجودةٌ عندك»**. `slug` وحدَه فريدٌ في المخطّط،
        و`nameAr` ليس كذلك — فـ«القيادة» و«قياده» و«القِيادة» ثلاثُ مهاراتٍ
        تدخل القاموسَ بلا اعتراض. وثلاثتُها تقسم قياسَ المهارة الواحدة
        أثلاثا: من أتقنها تُحسب له واحدةٌ وتبقى اثنتان ثغرةً في تشخيصه، فيُرشَّح
        له ما يعرفه. وهو عطبٌ **لا يظهر عند الإنشاء** بل بعد شهورٍ في توصيةٍ
        رديئةٍ لا يُعرف سببُها.

     فالشرطُ هنا «اختر من الموجود أوّلا» مبنيًّا لا موصًى به: تُقارَن الأسماءُ
     **مطبَّعةً** (همزاتٍ وتشكيلا وتاءً مربوطة) فيُردّ التوأمُ ويُسمَّى معرّفُه
     — فمن أراد ربطَ دورته بها وجدها، ومن أراد غيرَها سمّاها باسمٍ يفرّقها.
     والردُّ لا يمنع مهارةً جديدةً حقّا؛ يمنع أن تدخل **بالغلط**. */
  async createSkill(input: { id: string; slug: string; nameAr: string; familyId?: string }, actorId?: string) {
    if (!/^SK-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف المهارة بصيغة SK-XXX-000')
    const dup = await this.prisma.skill.findUnique({ where: { id: input.id } })
    if (dup) throw new AuthError('duplicate_id', 'معرف المهارة موجود مسبقا', 409)
    if (input.familyId) {
      const known = await this.prisma.skill.findFirst({ where: { familyId: input.familyId }, select: { id: true } })
      if (!known) throw new AuthError('unknown_family', 'رمز عائلة المهارة غير معروف في القاموس')
    }

    /* والقاموسُ مئاتٌ لا ملايين، والفعلُ فعلُ إدارةٍ لا مسارٌ ساخن — فتُقرأ
       الأسماءُ وتُطبَّع في الذاكرة. وعمودٌ مطبَّعٌ في القاعدة يُصان ويُهاجَر
       ويتخلّف عن `normalizeAr` حين تتغيّر، وهي واحدةٌ للبحث ولهذا الباب. */
    const wanted = normalizeAr(input.nameAr)
    const all = await this.prisma.skill.findMany({ select: { id: true, nameAr: true } })
    const twin = all.find((s) => normalizeAr(s.nameAr) === wanted)
    if (twin) {
      throw new AuthError(
        'duplicate_name',
        `في القاموس مهارةٌ بهذا الاسم: ${twin.nameAr} (${twin.id}) — اربِط دورتَك بها،`
        + ' أو سمِّ الجديدةَ اسما يفرّقها عنها. واسمان متشابهان يقسمان قياسَ المهارة الواحدة.',
        409,
      )
    }

    const created = await this.prisma.skill.create({
      data: {
        id: input.id, slug: input.slug, nameAr: input.nameAr, familyId: input.familyId ?? null,
        status: 'draft',
        versions: { create: { version: 1, nameAr: input.nameAr, status: 'draft', createdBy: actorId } },
      },
    })
    await recordAudit(this.prisma, {
      actorId: actorId ?? null, action: 'catalog.skill.create',
      entityType: 'skill', entityId: created.id,
      meta: { nameAr: created.nameAr, slug: created.slug, familyId: created.familyId },
    })
    return created
  }

  /* ═══ ومهاراتُ الدورة تُصلَح بعد ميلادها (ك-٣) ═══

     كانت `CourseSkillLink` تُكتب في موضعَين لا ثالثَ لهما: `createCourse`
     والمستورِد. فما وُلد بلا مهارةٍ بقي بلا مهارةٍ إلى الأبد — **ولا شاشةَ
     في المنصّة كلِّها تُصلحه**. وشاشةُ الكتالوج كانت تدلّ على بابٍ لا يفتح:
     «`skillIds` لربط المهارات — تُدمج في إصدارٍ جديد بعد الاعتماد والنشر»،
     ولا شيءَ في الخادم يقرأ حمولةَ طلبِ تغييرٍ ويطبّقها. وعدٌ بلا آلة.

     فهذا هو البابُ نفسُه: يُستبدَل الربطُ كلُّه بما أُرسل — لا إضافةٌ وحدَها،
     إذ فكُّ مهارةٍ أُلحقت خطأً حاجةٌ كحاجةِ إلحاقها.

     ولا يمسّ إصدارا: `CourseSkillLink` معلَّقةٌ بالدورة لا بنسختها
     (`@@id([courseId, skillId])`) — وهو قرارٌ قائمٌ في المخطّط، ومعناه أنّ
     المهاراتِ لا تختلف بين نسخةٍ وأخرى. فلا نسخةَ تُولد من ربطِ مهارة. */
  async setCourseSkills(courseId: string, skillIds: string[], actorId?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const unique = [...new Set(skillIds)]
    const known = await this.prisma.skill.findMany({ where: { id: { in: unique } }, select: { id: true } })
    const missing = unique.filter((id) => !known.some((k) => k.id === id))
    if (missing.length) throw new AuthError('unknown_skill', `مهاراتٌ غيرُ معروفة: ${missing.join(' · ')}`, 422)

    const before = (await this.prisma.courseSkillLink.findMany({
      where: { courseId }, select: { skillId: true },
    })).map((l) => l.skillId).sort()

    await this.prisma.$transaction(async (tx) => {
      await tx.courseSkillLink.deleteMany({ where: { courseId } })
      if (unique.length) await tx.courseSkillLink.createMany({ data: unique.map((skillId) => ({ courseId, skillId })) })
    })

    /* الأثرُ يقول ما كان وما صار — فمن قرأه بعد شهرٍ عرف ما فُكّ وما رُبط */
    await recordAudit(this.prisma, {
      actorId, action: 'catalog.course.skills_set', entityType: 'course', entityId: courseId,
      before: { skillIds: before }, after: { skillIds: [...unique].sort() },
    })

    /* وتقييمُ القياس يعود مع الردّ كما في الإنشاء: يرى المؤلّفُ أثرَ اختياره
       لحظتَها لا بعد أسبوعٍ في ترشيحٍ باهت (ب-٤). */
    const slugs = await this.prisma.skill.findMany({ where: { id: { in: unique } }, select: { slug: true } })
    return { courseId, skillIds: unique, assessment: assessSkillSelection(slugs.map((s) => s.slug)) }
  }

  /* ═══ دورةٌ تُرشَّح وحدَها في التشخيص (٢٠ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «إن أردتُ أن أضيفها دورةً جديدةً، فلِمَ أضيفها إلى
     مسار؟ ينبغي أن تُحتسب دورةً جديدةً في نتيجة التشخيص بمهاراتها».

     والحقلان يُضبطان معا لأنّهما شرطٌ واحد: رمزٌ بلا مجالٍ كيانٌ لا يفوز
     أبدا — لا يصله هدفٌ ولا احتياج — ومجالٌ بلا رمزٍ لا يُقرأ. فمن أراد
     إطفاءَها أطفأ الرمزَ، والمجالُ يبقى مكتوبا لا يُفقَد.

     ولا يُشتقّ المجالُ من المهارات: المهارةُ لا تحمل مجالا في هذا المخطّط —
     المجالُ يُخرَط من المسار أو الهدف أو الوظيفة. فيُعلَن. */
  async setStandaloneRecommendation(
    courseId: string,
    input: { recommendable: boolean; domains: string[]; stages: string[] },
    actorId?: string,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true, recommendableDirectly: true, diagnosticDomains: true, diagnosticStages: true,
        skillLinks: { select: { skillId: true } },
      },
    })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const domains = [...new Set(input.domains.map((d) => d.trim()).filter(Boolean))].sort()
    const known = new Set(domainsV2.map((d) => d.id as string))
    const unknown = domains.filter((d) => !known.has(d))
    if (unknown.length) {
      throw new AuthError('unknown_domain', `مجالاتٌ لا يعرفها التشخيص: ${unknown.join(' · ')}`, 422)
    }

    const stages = [...new Set(input.stages.map((x) => x.trim()).filter(Boolean))].sort()
    const knownStages = new Set(Object.keys(CAREER_STAGE_LABELS_AR))
    const badStages = stages.filter((x) => !knownStages.has(x))
    if (badStages.length) {
      throw new AuthError('unknown_stage', `مراحلُ لا يعرفها التشخيص: ${badStages.join(' · ')}`, 422)
    }

    /* ولا تُشعَل بلا ما تنافس به: مجالٌ يصلها به احتياج، ومهارةٌ تُقاس.
       والإشعالُ بلا أحدهما يضع في الفضاء كيانا لا يفوز أبدا — ويقرأ من
       أشعله أنّ دورتَه «تُرشَّح» وهي لا تُرشَّح. */
    if (input.recommendable) {
      if (domains.length === 0) {
        throw new AuthError('no_domain', 'اذكر مجالَ التشخيص الذي تخدمه — بلا مجالٍ لا يصلها هدفٌ ولا احتياج', 422)
      }
      if (course.skillLinks.length === 0) {
        throw new AuthError('no_skills', 'اربطْ مهاراتِها أوّلا — الدورةُ تنافس بمهاراتها، وبلا مهارةٍ لا شيءَ يُقاس', 422)
      }
      /* والصمتُ عن الجمهور يُخرجها من المنافسة لا يُدخلها كلَّ منافسة
         (`assessEntityEligibility`) — فتُرشَّح في الورق ولا تنافس مرّةً. */
      if (stages.length === 0) {
        throw new AuthError('no_stages', 'اذكر جمهورَها — كيانٌ بلا جمهورٍ مُعلَنٍ يخرج من المنافسة ولا ينافس مرّة', 422)
      }
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { recommendableDirectly: input.recommendable, diagnosticDomains: domains, diagnosticStages: stages },
      select: { id: true, recommendableDirectly: true, diagnosticDomains: true, diagnosticStages: true },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'catalog.course.standalone_set', entityType: 'course', entityId: courseId,
      before: {
        recommendable: course.recommendableDirectly,
        domains: [...course.diagnosticDomains].sort(), stages: [...course.diagnosticStages].sort(),
      },
      after: {
        recommendable: updated.recommendableDirectly,
        domains: updated.diagnosticDomains, stages: updated.diagnosticStages,
      },
    })
    return updated
  }

  /* ═══ معرّفُ الدورة يُولَّد ولا يُكتب (١٦ سبتمبر ٢٠٢٦) ═══

     كان حقلا في المعالج نصُّه النائب «المعرّف — CRS-XXX-000»، والخادمُ
     يشترط `‎/^C-[A-Z0-9-]+$/‎`. أي أنّ **ما تطلبه الشاشةُ يرفضه الخادم**:
     من كتب `CRS-FIN-001` كما قيل له رُدّ بـ«معرف الدورة بصيغة C-XXX-000».
     وهما مكتوبان في ملفّين لا يقرأ أحدُهما الآخر، فبقي الخلافُ سنةً.

     وقرارُ صاحب المنصّة: «تسمية الدورات ليس من اختصاص البشر وإنما من
     اختصاص النظام — اجعلها تلقائية ولا يمكن تغييرها».

     ── ولماذا العائلةُ من المسار الأمّ ──

     العائلةُ في المعرّف **ليست زينة**: `courseDomain` تقرؤها فتُخرج مجالَ
     الدورة المعرفيّ (`C-CYB-101` ← الأمن السيبراني)، وعليه تقوم مرشِّحاتُ
     المجال وقائمةُ تأهيل المدرّب ومنعُ التزاحم في مخطِّط الفصل. فعائلةٌ
     مخترَعةٌ تُسقط الدورةَ في «أخرى» بصمت.

     وقيست القاعدةُ على الكتالوج الحيّ: **عشرون مسارا، وفي كلٍّ منها عائلةُ
     دوراتٍ واحدةٌ لا غير** (٨١ دورة). فالمسارُ الأمُّ يحدّد العائلةَ تحديدا
     تامّا — ولا يُسأل عنها إنسان.

     ومسارٌ لا دورةَ فيه بعدُ لا سابقةَ له، فتُؤخذ عائلتُه من مقطعه
     (`PW-MKT-002` ← `MKT`). وإن لم تكن عائلةً معروفةً بقي `domainAr` فارغا
     كما كان دائما — ولا يُخترع مجالٌ لا يعرفه أحد. */
  async mintCourseId(pathwayId: string): Promise<string> {
    const familyOf = (courseId: string) => /^C-([A-Z0-9]+)-\d+$/.exec(courseId)?.[1] ?? null

    /* ١ · عائلةُ دوراتِ المسار — **الأصليّةِ وحدَها**.

       ولمَ التقييد: `PathwayCourse` تحمل المساندات أيضا (`kind: 'support'`)،
       وهي من عائلاتٍ أخرى عمدا — `PW-STU-003` مسارُه `C-CAR-*` وتُسنده
       `C-COMX-106` (الإنجليزية للأعمال). فعدُّ الروابط كلِّها يخلط
       المساندَ بالأصل، وفي مسارٍ مساندُه أكثرُ من أصله تُؤخذ العائلةُ
       الخطأ. وأمسك هذا **اختبارُ النشر الشامل** على قاعدةٍ حقيقيّة.

       و`homePathwayId` هو الفصلُ الصريح: المسارُ الأمُّ للدورة، يكتبه
       المستورِدُ من `pathway_id` في المصدر. */
    const siblings = await this.prisma.course.findMany({
      where: { homePathwayId: pathwayId }, select: { id: true },
    })
    const tally = new Map<string, number>()
    for (const c of siblings) {
      const f = familyOf(c.id)
      if (f) tally.set(f, (tally.get(f) ?? 0) + 1)
    }
    const fromSiblings = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    /* ٢ · وإلّا فمقطعُ المسار نفسِه */
    const fromPathway = /^PW-([A-Z0-9]+)-\d+$/.exec(pathwayId)?.[1]
    return this.mintCourseIdInFamily(fromSiblings ?? fromPathway ?? 'GEN')
  }

  /** ═══ ورقمٌ في عائلةٍ تُسمّى صراحةً — لدورةٍ بلا مسارٍ أمّ ═══

      قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): «إن أردتُ أن أضيفها دورةً جديدةً،
      فلِمَ أضيفها إلى مسار؟». وكان المعرِّفُ يُشتقّ من المسار وحدَه، فصار
      المسارُ لازما لميلاد الدورة لا لتصنيفها.

      والعائلةُ تبقى لازمة: `C-MKT-101` يُقرأ ويُصنَّف ويُرتَّب به الكتالوج،
      و«دورةٌ بلا عائلة» تصير `C-GEN-101` بلا مجالٍ ولا جيران. فمن أنشأ بلا
      مسارٍ سمّى عائلتَها — حقلٌ واحدٌ من قائمةٍ معلومة، لا مسارٌ يُخترع
      بجمهورٍ وتحوّلٍ ومدّة. */
  async mintCourseIdInFamily(family: string): Promise<string> {
    /* ٣ · والرقمُ يلي أكبرَ ما في العائلة — و١٠١ مبدأُ الترقيم في الكتالوج */
    const inFamily = await this.prisma.course.findMany({
      where: { id: { startsWith: `C-${family}-` } }, select: { id: true },
    })
    const top = inFamily.reduce((max, c) => {
      const n = Number(/^C-[A-Z0-9]+-(\d+)$/.exec(c.id)?.[1] ?? 0)
      return n > max ? n : max
    }, 0)
    return `C-${family}-${Math.max(top + 1, 101)}`
  }

  /** ═══ إنشاء دورة كمسودة — والمسارُ الأمُّ اختياريٌّ منذ ٢٠ سبتمبر ٢٠٢٦ ═══

      قرارُ صاحب المنصّة: «إن أردتُ أن أضيفها دورةً جديدةً، فلِمَ أضيفها إلى
      مسار؟ ينبغي أن تُحتسب دورةً جديدةً في نتيجة التشخيص بمهاراتها. ولا
      حاجةَ لأن تُعرض مسارَ تعلّمٍ إلّا أن يصنع المدرّبُ مسارَه بنفسه».

      وكان المسارُ لازما في ثلاثة مواضعَ معا: يُتحقَّق من وجوده، ويُشتقّ منه
      المعرِّف، ويُكتب له صفُّ ربطٍ في `PathwayCourse`. فمن أراد دورةً واحدةً
      قائمةً بنفسها اضطُرّ إلى اختراع مسارٍ لها — أو إلحاقها بمسارٍ لا تنتمي
      إليه، فتظهر في رحلةِ من لم يطلبها.

      والثلاثةُ صارت مشروطةً بوجوده: بلا مسارٍ تُسمّى العائلةُ صراحةً، ولا
      يُكتب صفُّ ربط. وما تبقّى — المهاراتُ والوحداتُ وتقييمُ القياس — هو هو،
      فالدورةُ دورةٌ سواءٌ كانت في رحلةٍ أم قائمةً وحدَها. */
  async createCourse(input: {
    /** المسارُ الأمّ — وفارغٌ يعني دورةً قائمةً بنفسها */
    pathwayId?: string | null
    /** ترتيبُها في مسارها — لا معنى له بلا مسار */
    sequence?: number | null
    /** عائلةُ المعرِّف حين لا مسارَ يُشتقّ منه (`MKT` ← `C-MKT-101`) */
    familyCode?: string | null
    titleAr: string; shortPromiseAr?: string
    levelAr?: string; totalHours: number; skillIds: string[]
    modules: { sequence: number; titleAr: string; outcomeAr?: string; activityAr?: string; artifactAr?: string; bodyAr?: string; checksAr?: string; videoAr?: string; scenarioAr?: string; hours: number }[]
  }, actorId?: string) {
    let id: string
    if (input.pathwayId) {
      const pathway = await this.prisma.pathway.findUnique({ where: { id: input.pathwayId } })
      if (!pathway) throw new AuthError('unknown_pathway', 'المسار الأم غير موجود')
      id = await this.mintCourseId(input.pathwayId)
    } else {
      /* والعائلةُ من القائمة المسمّاة لا حرفا يُكتب: عائلةٌ مخترعةٌ تصنع
         `C-XYZ-101` بلا مجالٍ عربيٍّ ولا جيران، ويقرؤها مخطِّطُ الفصل فراغا. */
      const family = (input.familyCode ?? '').trim().toUpperCase()
      if (!COURSE_DOMAIN_FAMILIES.includes(family)) {
        throw new AuthError(
          'unknown_family',
          'دورةٌ بلا مسارٍ أمٍّ تحتاج عائلةً مسمّاةً من قائمة العائلات — منها يُشتقّ معرّفُها ومجالُها',
          422,
        )
      }
      id = await this.mintCourseIdInFamily(family)
    }
    const skills = await this.prisma.skill.findMany({ where: { id: { in: input.skillIds } } })
    if (skills.length !== input.skillIds.length) throw new AuthError('unknown_skill', 'مهارة واحدة أو أكثر غير موجودة')
    if (input.modules.length === 0) throw new AuthError('no_modules', 'الدورة بلا وحدات غير مقبولة')

    /* البند ب-٤: تقييم جودة القياس يُحسب ويُعاد مع الردّ — لا يمنع الحفظ.
       المؤلّف يرى أثر اختياره لحظة الحفظ لا بعد أسبوع في ترشيح باهت. */
    const skillAssessment = assessSkillSelection(skills.map((sk) => sk.slug))

    /* والمجالُ يُكتب عند الميلاد لا في ترحيلٍ لاحق.

       كان `domainAr` يُملأ مرّةً واحدةً في ترحيل `term_system` من عائلةِ
       المعرّف، ولا يكتبه هذا المسارُ أبدا — فكلُّ دورةٍ أُنشئت من المعالج
       وُلدت بمجالٍ فارغ، ومخطِّطُ الفصل يقرأ الفارغَ فلا يمنع تزاحما.
       والعائلةُ صارت معلومةً هنا، فلا عذرَ لتركه. */
    const domainAr = COURSE_DOMAIN_FAMILIES.includes(/^C-([A-Z0-9]+)-/.exec(id)?.[1] ?? '')
      ? courseDomain(id)
      : null

    const created = await this.prisma.course.create({
      data: {
        id, status: 'draft', createdBy: actorId, domainAr,
        versions: {
          create: {
            version: 1, titleAr: input.titleAr, shortPromiseAr: input.shortPromiseAr,
            levelAr: input.levelAr, totalHours: input.totalHours, status: 'draft', createdBy: actorId,
          },
        },
        skillLinks: { create: input.skillIds.map((skillId) => ({ skillId })) },
        /* ولا صفَّ ربطٍ لدورةٍ بلا مسار — و`PathwayCourse` مفتاحُها
           `(pathwayId, courseId)`، فصفٌّ بمسارٍ فارغٍ لا يُكتب أصلا. */
        ...(input.pathwayId
          ? { pathwayLinks: { create: { pathwayId: input.pathwayId, sequence: input.sequence ?? 1 } } }
          : {}),
        modules: {
          create: input.modules.map((m) => ({
            id: `${id}-M${m.sequence}`, status: 'draft',
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

  /* ═══ موجة ٦ · أ-٢ · تأليف سؤال قياس ═══
     الحاجة: ٨ مهارات مقيسة من ٢٢٨ نشطة، و١٠ مسارات من ٢٠ وزنُ فجوة المهارة
     فيها خامل. وقبل ج-٢ كان إغلاق فجوة يحتاج نشر كود؛ الآن يحتاج صفّا في
     القاعدة وبناء لقطة.

     ونطاق هذه العملية **ضيّق بقصد**: تُنشئ سؤال `skill_level_5` يقيس مهارة
     مسجَّلة، لا سؤالا تشخيصيا عاما. الفرق حكوميّ لا تقني: شكل سؤال القياس
     يحدده المحرك (نوع الجواب · مقياس الأدلة الخمسة · `measures`)، فالحرّ فيه
     نصُّه وحده. وباب «أنشئ أي سؤال» يفتح سطح حوكمة أوسع بكثير ولا حاجة له
     لسدّ هذه الفجوة. */

  /** مقياس الأدلة الخمسة — نصٌّ واحد لكل أسئلة القياس، فلا يتفرّق المقياس */
  static readonly SKILL_LEVEL_OPTIONS = [
    'لا أعرفها',
    'مبتدئ',
    'أستخدمها أحيانا',
    'جيد عمليًا',
    'متقدم وأطبقها بثقة',
  ]

  async createMeasurementQuestion(input: {
    id: string
    /** المهارة المقيسة — يجب أن تكون مسجَّلة ونشطة، وإلا يُسأل المتعلم بلا أثر */
    skillSlug: string
    textAr: string
    /** أثر القرار كما يكتبه المؤلّف — تقرؤه خطة V2.1 لجملة «هذا السؤال موجود لأن…» */
    decisionImpactAr: string
    weight?: number
  }, actorId?: string) {
    if (!/^QB-M4-[A-Z0-9-]+$/.test(input.id)) {
      throw new AuthError('invalid_id', 'معرف سؤال القياس بصيغة QB-M4-XXX — الوحدة M4 هي وحدة أدلة المهارات')
    }
    if (await this.prisma.question.findUnique({ where: { id: input.id } })) {
      throw new AuthError('duplicate_id', 'معرف السؤال موجود مسبقا', 409)
    }
    if (input.textAr.trim().length < 15) {
      throw new AuthError('invalid_text', 'نص السؤال قصير جدا — المتعلم يقيس نفسه به')
    }
    if (input.decisionImpactAr.trim().length < 15) {
      throw new AuthError('invalid_impact', 'أثر القرار مطلوب: سؤال لا نستطيع إكمال جملة أثره يصبح متقاعدا في خطة V2.1 فلا يُطرح')
    }

    const skill = await this.prisma.skill.findFirst({ where: { slug: input.skillSlug } })
    if (!skill) throw new AuthError('unknown_skill', `لا مهارة مسجَّلة بالمُعرّف «${input.skillSlug}» — سجّلها أولا أو صحّح الاسم`)
    if (skill.active === false || skill.mergedInto) {
      throw new AuthError('inactive_skill', `المهارة «${input.skillSlug}» موقوفة أو مدموجة — قياسها لا يدخل أي ترشيح`)
    }
    /* مهارة لا يتطلبها مسار: يُسمح ويُبلَّغ. قياسها إشارة تخصيص لا فجوة —
       والمنع هنا يمنع أيضا الحالة المشروعة (مهارة تُقاس لتوجيه الخطة). */
    const inPathway = await this.prisma.pathwaySkillRequirement.count({ where: { skillId: skill.id } })
      + await this.prisma.courseSkillLink.count({ where: { skillId: skill.id } })

    const question = await this.prisma.question.create({
      data: {
        id: input.id, moduleId: 'M4', moduleName: 'خط أساس المهارات المحورية',
        answerType: 'skill_level_5', optionsKey: 'skill_level_5',
        personaScope: ['all'],
        /* skill_vector إلى جانب المهارة — هكذا يقرأ المحرك متجه المهارات */
        measures: [input.skillSlug, 'skill_vector'],
        triggerCondition: 'always',
        reasonAr: input.decisionImpactAr.trim(),
        sensitivityLevel: 'low', requiredLevel: 'deep',
        weight: input.weight ?? 1.1,
        active: true,
        /* مسودة: لا تدخل اللقطة المنشورة قبل الاعتماد والنشر */
        status: 'draft',
        versions: { create: { version: 1, textAr: input.textAr.trim(), status: 'draft', createdBy: actorId } },
        options: {
          create: CatalogAdminService.SKILL_LEVEL_OPTIONS.map((textAr, i) => ({
            optionId: `o${i + 1}`, orderIndex: i, textAr,
            /* التأثير: مستوى المهارة من ١ إلى ٥ في متجه المهارات */
            effects: { [input.skillSlug]: String(i + 1) },
          })),
        },
      },
    })
    await this.prisma.questionSkillLink.create({
      data: { questionId: question.id, skillId: skill.id },
    }).catch(() => undefined) // الرابط توثيقي — تكراره لا يُفشل التأليف

    return {
      id: question.id, status: question.status, skillSlug: input.skillSlug,
      /* تنبيه لا منع */
      noteAr: inPathway === 0
        ? `المهارة «${input.skillSlug}» لا تتطلبها دورة ولا مسار — قياسها إشارة تخصيص لا يغيّر ترتيب المرشحين.`
        : null,
    }
  }

  /** موجة ٦ · أ-٣ — إيقاف سؤال قياس معلَّق.
      المشكلة: أسئلة `skill_level_5` تقيس مفاتيح ليست مهارات مسجَّلة. ما كان
      منها على سطح B2C **يُسأل المتعلم ويُهمَل جوابه** — وقتٌ مهدور بلا مقابل.

      وللمعلَّق طريقان، وهذا أحدهما:
      ١) **تسجيل المهارة** وربطها بدورات — يصير القياس محتسبا (الأفضل حين
         المهارة حقيقية في المنتج).
      ٢) **الإيقاف** — هذه العملية. `active = false` يُخرج السؤال من اللقطة،
         فيسقط مفتاحه من المهارات المقيسة، ويتوقف إهدار وقت المتعلم.

      والفرق بينهما قرارٌ أكاديمي لا تقني، فلا تُتخذ هنا: العمليتان متاحتان
      والتقرير يعرض الاثنين. والإيقاف بيانيّ وقابل للرجوع — لا تعديل كود. */
  async retireMeasurementQuestion(id: string, reasonAr: string) {
    if (reasonAr.trim().length < 10) {
      throw new AuthError('reason_required', 'سبب الإيقاف مطلوب — يُقرأ في سجل التدقيق بعد أشهر')
    }
    const q = await this.prisma.question.findUnique({ where: { id } })
    if (!q) throw new AuthError('not_found', 'السؤال غير موجود', 404)
    if (q.answerType !== 'skill_level_5') {
      throw new AuthError('not_measurement', 'هذه العملية لأسئلة القياس وحدها — غيرها يُدار من خطة الأسئلة')
    }
    if (!q.active) return { id, active: false, alreadyInactive: true }
    await this.prisma.question.update({ where: { id }, data: { active: false, reasonAr: `${q.reasonAr ?? ''}\n[أُوقف] ${reasonAr.trim()}`.trim() } })
    return { id, active: false, alreadyInactive: false }
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

  /* ═══ قرارُ المراجعة (checker) — ومن يراجع نفسَه ═══

     القاعدةُ أنّ صانعَ الطلب لا يعتمده. واستثناؤها حبّةٌ واحدةٌ
     (`catalog.self_approve`) شرحُ وجودها في `server/auth/permissions.ts`
     حيث تُعرَّف — لا يُنسخ هنا فيفترق النسخان.

     و`permissions` صلاحيّاتُ الفاعل كما حلّتها الجلسةُ في طبقة HTTP، تُمرَّر
     ولا تُقرأ هنا من القاعدة: الخدمةُ تُختبَر بلا جلسةٍ ولا كوكي. وفراغُها
     الافتراضيُّ يعني «لا استثناء» — فمن نسي تمريرَها وقع على القاعدة الأشدّ
     لا على أوسعها، وهو الاتّجاهُ الذي يُخطئ فيه الصمتُ بأمان. */
  async decide(
    changeRequestId: string,
    decision: 'approve' | 'request_changes' | 'reject',
    noteAr: string | undefined,
    actorId: string,
    permissions: readonly string[] = [],
  ) {
    const cr = await this.prisma.contentChangeRequest.findUnique({ where: { id: changeRequestId } })
    if (!cr) throw new AuthError('not_found', 'طلب التغيير غير موجود', 404)
    if (cr.status !== 'in_review') throw new AuthError('bad_state', 'الطلب ليس قيد المراجعة', 409)
    const isSelf = cr.createdBy === actorId
    if (isSelf && !permissions.includes(SELF_APPROVE)) {
      throw new AuthError('maker_checker', 'لا يجوز اعتماد طلب أنشأته بنفسك (maker-checker)', 403)
    }

    const newStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested'
    return this.prisma.$transaction(async (tx) => {
      await tx.contentApprovalDecision.create({ data: { changeRequestId, actorId, decision, noteAr } })
      const updated = await tx.contentChangeRequest.update({ where: { id: changeRequestId }, data: { status: newStatus, reviewedBy: actorId, reviewedAt: new Date() } })
      /* الاعتماد يرفع الكيان المسودة إلى «approved» استعدادا للنشر */
      if (decision === 'approve') await this.promoteEntity(tx, cr.entityType, cr.entityId, 'draft', 'approved')
      /* ثمنُ الاستثناء: أن يُقال إنّه وقع.

         الاعتمادُ العاديّ يُقرأ من `ContentApprovalDecision`، واعتمادُ الذات
         يُستخرَج منه بمقابلة `createdBy` بـ`reviewedBy` — أي لا يُقرأ. فيُكتب
         هنا فعلا مستقلّا في سجلّ الأثر، **داخل المعاملة نفسِها**: إن سقط
         الاعتمادُ سقط أثرُه معه، ولا يبقى خبرُ ترقيةٍ لم تقع.

         والردُّ وطلبُ التعديل لا يُكتبان: من يردّ عملَه إلى نفسه لم يتخطَّ
         حاجزا — الحاجزُ على ما يمضي قُدُما لا على ما يرجع. */
      if (isSelf && decision === 'approve') {
        await recordAudit(tx, {
          actorId,
          action: 'catalog.change_request.self_approve',
          entityType: 'content_change_request',
          entityId: changeRequestId,
          reason: noteAr,
          meta: { entityType: cr.entityType, entityId: cr.entityId },
        })
      }
      return updated
    })
  }

  /* ═══ والطلبُ قد يسبق وجودَ ما يطلبه ═══

     طلبُ التغيير ليس دائما تغييرا على صفٍّ قائم. منه ما هو **طلبُ ميلاد**:
     `trainer_new_course` معرّفُه `C-PROPOSED-…` ولا صفَّ له في `Course`
     بقصد — كما يثبته اختبارُ الإرسال نفسُه — و`skill_request` معرّفُه
     «مَزلَقُ» مهارةٍ لم تُخلَق بعد.

     وكان الاعتمادُ يكتب `update({ where: { id } })` على الصفّ في كلّ حال،
     فيرمي Prisma الرمزَ `P2025`، وتُلغى المعاملةُ كلُّها، **ويرى المراجعُ
     ٥٠٠ بلا سبب** — على أنّ قرارَه سليمٌ ومكتوبٌ وقد سجّل. ومرّ ذلك لأنّ
     الاختباراتِ حرست الإرسالَ كلَّه ولم يحرس أحدٌ الزرَّ الوحيدَ الذي
     يُضغط بعده.

     والقاعدةُ التي كانت ناقصةً تُقال في سطر: **يُرفَع ما هو موجود.** ومن
     طُلب ميلادُه يُعتمد قرارا، ثمّ يولد من باب التأليف حيث تُكتب محاورُه
     وتُربط مهاراتُه — لا من باب القرار بابا خلفيّا.

     ولمَ الوجودُ يُسأل عنه القاعدةَ ولا يُقاس على بادئة الاسم: البادئةُ
     تحرس صنفا واحدا، وقد كان الصنفان اثنَين من أوّل يوم. وثالثٌ يأتي غدا
     فيسقط سقوطَهما. */
  private async entityExists(tx: Prisma.TransactionClient, entityType: string, id: string): Promise<boolean> {
    const where = { id }
    if (entityType === 'pathway') return (await tx.pathway.count({ where })) > 0
    if (entityType === 'course') return (await tx.course.count({ where })) > 0
    if (entityType === 'skill') return (await tx.skill.count({ where })) > 0
    if (entityType === 'question') return (await tx.question.count({ where })) > 0
    if (entityType === 'template') return (await tx.compositeTemplate.count({ where })) > 0
    return false
  }

  /** رفع حالة كيان وإصداره الحالي معا — داخل معاملة القرار أو النشر */
  async promoteEntity(tx: Prisma.TransactionClient, entityType: string, entityId: string, from: string, to: string) {
    /* يُرفَع ما هو موجود — وما طُلب ميلادُه يُعتمد قرارا ويولد بعدُ */
    if (!(await this.entityExists(tx, entityType, entityId))) return
    if (entityType === 'pathway') {
      const e = await tx.pathway.update({ where: { id: entityId }, data: { status: to } })
      await tx.pathwayVersion.updateMany({ where: { pathwayId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'course') {
      const e = await tx.course.update({ where: { id: entityId }, data: { status: to } })
      await tx.courseVersion.updateMany({ where: { courseId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
      /* ── الوحدةُ تتبع دورتها، لكن ليس في كلّ حال ──

         كان السطرُ يكتب حالةَ الدورة على وحداتها كما هي. ولدورةٍ ستُّ حالات
         (`draft | in_review | approved | published | paused | archived`)،
         وللوحدةِ ثلاثٌ (`draft | published | archived`) — فاعتمادُ دورةٍ كان
         يكتب `approved` على كلّ وحداتها، **وهي حالةٌ لا تملكها الوحدة**.
         والوحدةُ لا دورةَ مراجعةٍ لها أصلا: المراجَعةُ تقع على الدورة،
         والوحدةُ تُنشر معها أو تُؤرشف معها.

         ولم يشكُ أحد، لأنّ العمودَ كان بلا قيد — وهذا هو بعينه العطبُ الذي
         تُزيله قيودُ الحالات: حالةٌ لا يعرفها أحدٌ تعيش في القاعدة سنينَ،
         فتسقط الوحدةُ من كلّ استعلامٍ يُرشِّح بالحالة ولا يظهر خطأ.

         فصار النقلُ يقع **حين تكون الحالةُ من حالات الوحدة** لا دائما. وشرطُ
         الحالة السابقة يُقاس على الوحدة نفسِها (`not: to`) لا على الدورة —
         فبعد أن تصير المراجعةُ لا تمسّ الوحدات، لم تبقَ وحدةٌ حالُها
         `approved` ينتظرها النشر. */
      const MODULE_STATES = new Set(['draft', 'published', 'archived'])
      if (MODULE_STATES.has(to)) {
        await tx.courseModule.updateMany({ where: { courseId: entityId, status: { not: to } }, data: { status: to } })
        await tx.courseModuleVersion.updateMany({ where: { module: { courseId: entityId }, status: { not: to } }, data: { status: to } })
      }
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
