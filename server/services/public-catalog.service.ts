/* خدمة الكتالوج العام — ما يراه الموقع للزوار: المنشور فقط.
   لا draft ولا in_review يخرج من هنا أبدا، والأسعار والمواعيد من الشعب المفتوحة. */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { readableModuleVersion } from '../catalog/module-version-visibility'
import { AuthError } from './auth.service'
import { openRegistrationWhere } from './registration-window'
import { PUBLIC_TRAINER_WHERE, TRAINER_VISIBILITY_SELECT, trainerPubliclyVisible } from './trainer-visibility'
import { photoPublicUrl } from './storage.service'

export class PublicCatalogService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async pathways() {
    const rows = await this.prisma.pathway.findMany({
      where: { status: 'published' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        courses: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } },
      },
      orderBy: { id: 'asc' },
    })
    return rows.map((pw) => ({
      id: pw.id, status: pw.status, version: pw.currentVersion,
      title: pw.versions[0]?.title ?? '', audience: pw.versions[0]?.audience ?? '',
      durationWeeks: pw.versions[0]?.durationWeeks ?? null,
      weeklyHours: pw.versions[0]?.weeklyHours ?? null,
      level: pw.versions[0]?.level ?? null,
      outcomeMetric: pw.versions[0]?.outcomeMetric ?? null,
      courses: pw.courses
        .sort((a, b) => a.sequence - b.sequence)
        .map((l) => ({ courseId: l.courseId, sequence: l.sequence, title: l.course.versions[0]?.titleAr ?? '', hours: l.course.versions[0]?.totalHours ?? 0 })),
    }))
  }

  async pathway(id: string) {
    const all = await this.pathways()
    const found = all.find((pw) => pw.id === id)
    if (!found) throw new AuthError('not_found', 'المسار غير موجود أو غير منشور', 404)
    return found
  }

  async courses() {
    const rows = await this.prisma.course.findMany({
      where: { status: 'published' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1, include: { outcomes: true, objectives: true } },
        modules: { where: { status: 'published' }, include: { versions: { ...readableModuleVersion(), take: 1 } } },
      },
      orderBy: { id: 'asc' },
    })
    return rows.map((c) => ({
      id: c.id, version: c.currentVersion,
      title: c.versions[0]?.titleAr ?? '', levelAr: c.versions[0]?.levelAr ?? null,
      totalHours: c.versions[0]?.totalHours ?? 0, priceUsd: c.priceUsd,
      outcomes: c.versions[0]?.outcomes.map((o) => o.textAr) ?? [],
      modules: c.modules
        .sort((a, b) => (a.versions[0]?.sequence ?? 0) - (b.versions[0]?.sequence ?? 0))
        .map((m) => ({ id: m.id, title: m.versions[0]?.titleAr ?? '', hours: m.versions[0]?.hours ?? 0 })),
    }))
  }

  async course(id: string) {
    const all = await this.courses()
    const found = all.find((c) => c.id === id)
    if (!found) throw new AuthError('not_found', 'الدورة غير موجودة أو غير منشورة', 404)
    return found
  }

  async templates() {
    const rows = await this.prisma.compositeTemplate.findMany({
      where: { status: 'published' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { id: 'asc' },
    })
    return rows.map((t) => ({
      id: t.id, version: t.currentVersion,
      name: t.versions[0]?.nameAr ?? '', description: t.versions[0]?.intentAr ?? '',
    }))
  }

  /** الشعب المعروضة للزوار — مفتوحة أو ممتلئة أو جارية: السعر والموعد والمدرب */
  async cohorts() {
    return this.openCohorts({})
  }

  /* الشعبُ المفتوحةُ للتسجيل، بترشيحٍ إضافيٍّ يضيفه النداء.

     كانت هذه الاستعلامةُ في `cohorts()` وحدَها، فلمّا لزمت صفحةَ المدرّب
     العامّةَ كان البديلُ نسخَها. ونسختان تفترقان: عدُّ المقاعد هنا يجمع
     المحجوزَ مع المسجَّل (وأوّلُ من ينسخ ينسى)، والبوّابةُ تُطبَّق على اسم
     المدرّب. فالترشيحُ وسيطٌ والجسدُ واحد. */
  private async openCohorts(extraWhere: Record<string, unknown>) {
    const rows = await this.prisma.cohort.findMany({
      where: { status: { in: ['open', 'full', 'active'] }, ...openRegistrationWhere(), ...extraWhere },
      include: {
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
        trainers: {
          include: { profile: { select: { ...TRAINER_VISIBILITY_SELECT, application: { select: { fullName: true } } } } },
        },
        sessions: { orderBy: { startsAt: 'asc' }, select: { startsAt: true, endsAt: true, title: true } },
        /* المقعدُ المحجوز مقعدٌ مشغول.

           كان العدُّ على `enrolled` وحدَه، و`checkout` يمنع على
           `enrolled + seat_held` (commerce.service.ts:303–309). فشعبةٌ امتلأت
           بحجوزٍ لم تُدفع بعد كانت تُعلن مقاعدَ متاحة، ثمّ تُرفض بـ409 عند
           الضغط على «اشترِ». والمشتري يقرأ ذلك عطبا في الموقع لا امتلاءً.

           فالعدّان صارا واحدا: ما يُعرض هو ما يقبله الشراء. */
        _count: {
          select: {
            enrollments: { where: { status: 'enrolled' } },
            enrollmentRequests: { where: { status: 'seat_held' } },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    })
    return rows.map((c) => ({
      id: c.id, title: c.title, status: c.status,
      courseId: c.courseId, courseTitle: c.course.versions[0]?.titleAr ?? '',
      startsAt: c.startsAt, endsAt: c.endsAt, daysOfWeek: c.daysOfWeek, startTime: c.startTime,
      timezone: c.timezone, price: c.price, currency: c.currency, language: c.language,
      deliveryMode: c.deliveryMode,
      seatsLeft: c.capacity ? Math.max(0, c.capacity - c._count.enrollments - c._count.enrollmentRequests) : null,
      /* البوّابةُ الواحدة — كان الشرطُ هنا اعتمادَ النشر وحدَه، فالموقوفُ الذي
         اعتُمد نشرُه قبل إيقافه يبقى اسمُه في بيانات الشعبة. */
      trainers: c.trainers
        .filter((t) => trainerPubliclyVisible(t.profile))
        .map((t) => t.profile.application.fullName),
      nextSession: c.sessions[0] ?? null,
    }))
  }

  /* صفحةُ المدرّب العامّة — `/t/<slug>`.

     قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «يظهر مسارٌ خاصٌّ باسم المدرّب
     للعامّة في الرابط ليقوموا بالتسجيل فيه». وهي بابٌ جديدٌ على شعبٍ قائمة:
     لا يُباع فيها جديد، ولا سعرَ يختلف — ما يتغيّر أنّ من دخل منها يُحسب
     لصاحبها.

     والبوّابةُ بوّابةُ المستودَع نفسُها: لا اسمَ مدرّبٍ يُعرض قبل اعتماد
     نشره. فالمسارُ الذي لم يُعتمد نشرُ صاحبه **غيرُ موجود** (404) لا
     «موجودٌ فارغ» — إذ الثاني يقرّ بوجوده ويُخبر عن حالته. */
  async trainerPublicPage(slug: string) {
    const profile = await this.prisma.trainerProfile.findFirst({
      where: { publicSlug: slug, ...PUBLIC_TRAINER_WHERE, application: { status: 'active' } },
      include: {
        application: { select: { fullName: true, country: true, specialties: true } },
        referralLinks: { where: { cohortId: null }, select: { code: true } },
      },
    })
    if (!profile) throw new AuthError('not_found', 'لا مدرّبَ بهذا المسار', 404)

    const cohorts = await this.openCohorts({ trainers: { some: { profileId: profile.id } } })

    /* ═══ ومسارُه باسمه على صفحته (ن-٨) ═══

       رابطُ الدعوة يشير إلى هذه الصفحة، وكانت تعرض شعبَه المفتوحةَ وحدَها.
       فمن بنى مسارا باسمه ونُشر على الرفّ العامّ، **لم يكن رابطُه يبلغه** —
       يقع الزائرُ على قائمةِ شعبٍ متفرّقةٍ لا على ما جمعه له صاحبُها.

       ولا يُفحص هنا اعتمادُ نشرِ المدرّب ثانيةً: `PUBLIC_TRAINER_WHERE` أعلاه
       ردّ الصفحةَ كلَّها ٤٠٤ إن لم يُعتمد. فالمسارُ يُقرأ بحالته وحدَها. */
    const paths = (await this.prisma.trainerPath.findMany({
      where: { profileId: profile.id, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      include: {
        term: { select: { titleAr: true, season: true, year: true, startsOn: true } },
        courses: { orderBy: { sequence: 'asc' }, select: { courseId: true } },
      },
    })).map((p) => ({
      slug: p.slug,
      titleAr: p.titleAr,
      blurbAr: p.blurbAr,
      term: p.term,
      courseCount: p.courses.length,
    }))

    return {
      slug,
      name: profile.application.fullName,
      headline: profile.headline,
      bio: profile.bioPublic,
      photoUrl: photoPublicUrl(profile.photoUrl),
      country: profile.application.country,
      specialties: profile.application.specialties.map((s) => s.specialty),
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount,
      hoursTaught: profile.hoursTaught,
      graduatesCount: profile.graduatesCount,
      /* رمزُه الواسعُ يخرج مع الصفحة: من دخل من بابه يُسجَّل له بلا أن
         يحمل الزائرُ شيئا في العنوان. */
      referralCode: profile.referralLinks[0]?.code ?? null,
      paths,
      cohorts,
    }
  }

  /** المراجع العلمية للمنهجية — الملف نفسه مصدر واحد، يقدمه الخادم */
  async methodology() {
    const path = join(process.cwd(), 'src/data/methodology-references.v1.json')
    return JSON.parse(await readFile(path, 'utf8'))
  }

  /* الكتالوج الجوهري المنشور بصيغة core-catalog.v2 نفسها — الواجهة تعيد بناء
     عرضها منه بالمحوّلات ذاتها، فلا توجد نسخة ثانية متعارضة داخل المكونات.
     المنشور فقط: لا draft ولا in_review يخرج من هنا أبدا. */
  async coreCatalog() {
    const [pathways, courses, library] = await Promise.all([
      this.prisma.pathway.findMany({
        where: { status: 'published' },
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
          courses: { orderBy: { sequence: 'asc' } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.course.findMany({
        where: { status: 'published' },
        include: {
          versions: {
            orderBy: { version: 'desc' }, take: 1,
            include: {
              objectives: { orderBy: { sequence: 'asc' } },
              outcomes: { orderBy: { sequence: 'asc' } },
              project: true,
            },
          },
          modules: { where: { status: 'published' }, include: { versions: { ...readableModuleVersion(), take: 1 } } },
          skillLinks: { include: { skill: true } },
          pathwayLinks: true,
        },
        orderBy: { id: 'asc' },
      }),
      /* المكتبة — موادّ خارج الدورات، تُفتح في تبويب خارجي لا داخل الصفحة */
      this.prisma.libraryResource.findMany({
        where: { status: 'published' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    ])

    /* ساعاتُ كلّ دورة — تُجمَع للمسار في `total_hours` أدناه.

       البطاقة التي يراها المشتري أوّلَ ما ينزل إلى المسارات تعرض حجمَ المسار:
       «٤ دورات · ٤٠ ساعة · ٧ أسابيع». والساعات كانت تختفي منها في القاعة الحيّة
       وحدها: باني اللقطة يحسبها (catalog/snapshot-builder.ts) لكنّ هذا المسلك —
       وهو ما تقرؤه الواجهة فعلا — لم يكن يُصدر الحقل أصلا، فتقرأ pathways.ts
       الافتراضَ صفرا ويسقط الرقم من السطر بلا خطأ. تُحسب هنا بالمنطق نفسه:
       الدورات المطلوبة وحدها، فالمساندة عرضٌ خارج المسار لا جزءٌ من حجمه. */
    const hoursByCourse = new Map(courses.map((c) => [c.id, c.versions[0]?.totalHours ?? 0]))

    return {
      source: 'api',
      launch_pathways: pathways.map((pw) => {
        const v = pw.versions[0]
        const requiredIds = pw.courses.filter((l) => l.kind !== 'support').map((l) => l.courseId)
        return {
          id: pw.id,
          title: v?.title ?? '',
          audience: v?.audience ?? '',
          after: v?.afterText ?? '',
          capstone: v?.capstone ?? '',
          duration_weeks: v?.durationWeeks ?? 0,
          weekly_hours: v?.weeklyHours ?? '',
          level: v?.level ?? '',
          ...(v?.delivery ? { delivery: v.delivery } : {}),
          /* المساندة تُقصى من course_ids هنا كما تُقصى في بناء اللقطة.

             هذا المسلك هو ما تقرؤه الواجهة الحيّة فعلا (services/public-content.ts)،
             وكان يجمع كلّ روابط المسار بلا تمييز — فتدخل المساندات الثلاث
             `course_ids`، ومنها يقرؤها `pathwaySkills` فتُشتقّ منها فجوةُ
             المهارات التي تزن ٢٥٪ من ترتيب المسارات. أي أنّ الفصل الذي حرسناه
             في الملفّ وفي اللقطة كان ينهار عند أوّل تحميلٍ من القاعة.
             حارسه: server/tests/catalog/public-core-catalog.test.ts */
          course_ids: requiredIds,
          course_count: requiredIds.length,
          total_hours: requiredIds.reduce((sum, cid) => sum + (hoursByCourse.get(cid) ?? 0), 0),
          support_courses: pw.courses
            .filter((l) => l.kind === 'support')
            .map((l) => ({ course_id: l.courseId, reason_ar: l.reasonAr ?? '' })),
        }
      }),
      courses: courses.map((c) => {
        const v = c.versions[0]
        /* المسار الأمّ للدورة = رابطها غير المساند.

           صار للدورة أكثر من رابط مسار: واحدٌ أساسيّ في مسارها، وحتى أربعةٌ مساندة
           في مسارات أخرى. وأخذُ `pathwayLinks[0]` صار يلتقط أحدها اعتباطا — فظهرت
           «دورة الكتابة والبحث بالذكاء الاصطناعي» تحت مسار «قرارك المهني الأول»
           بترتيب ٥ بدل ٣، فوقعت في التصنيف الخطأ في كتالوج الدورات واختفت من فئتها.
           الحارس: server/tests/catalog/public-core-catalog.test.ts */
        const link = c.pathwayLinks.find((l) => l.pathwayId === c.homePathwayId)
          ?? c.pathwayLinks.find((l) => l.kind === 'required')
          ?? c.pathwayLinks[0]
        return {
          course_id: c.id,
          pathway_id: c.homePathwayId ?? link?.pathwayId ?? '',
          sequence: c.homeSequence ?? link?.sequence ?? 1,
          title_ar: v?.titleAr ?? '',
          ...(v?.termEn ? { title_term_en: v.termEn } : {}),
          ...(v?.legacyTitleAr ? { legacy_title_ar: v.legacyTitleAr } : {}),
          ...(v?.shortPromiseAr ? { short_promise_ar: v.shortPromiseAr } : {}),
          ...(v?.descriptionAr ? { description_ar: v.descriptionAr } : {}),
          ...(v?.audienceAr ? { target_audience_ar: v.audienceAr } : {}),
          ...(v?.prerequisitesAr ? { prerequisites_ar: v.prerequisitesAr } : {}),
          ...(v?.levelAr ? { level_ar: v.levelAr } : {}),
          total_hours: v?.totalHours ?? 0,
          /* سعر القائمة — رقمٌ معلن لكل دورة، لا مقدَّرٌ ولا محوَّل عملة.
             ترثه الشعبة عند إنشائها، فما تعرضه الصفحة هو ما تُصدره الفاتورة. */
          ...(c.listPrice !== null ? { list_price: Number(c.listPrice), list_currency: c.listCurrency } : {}),
          skill_slugs: c.skillLinks.map((l) => l.skill.slug),
          skill_names_ar: c.skillLinks.map((l) => l.skill.nameAr),
          learning_objectives_ar: (v?.objectives ?? []).map((o) => o.textAr),
          learning_outcomes_ar: (v?.outcomes ?? []).map((o) => o.textAr),
          ...(v?.project?.descriptionAr ? { summative_assessment_ar: v.project.descriptionAr } : {}),
        }
      }),
      modules: courses.flatMap((c) =>
        c.modules.map((m) => {
          const v = m.versions[0]
          return {
            module_id: m.id,
            course_id: c.id,
            sequence: v?.sequence ?? 1,
            title_ar: v?.titleAr ?? '',
            module_outcome_ar: v?.outcomeAr ?? '',
            practice_activity_ar: v?.activityAr ?? '',
            evidence_artifact_ar: v?.artifactAr ?? '',
            expected_hours: v?.hours ?? 0,
            /* متنُ الوحدة بأجزائه الستّة (ح-١ … ح-٧) — يُحذف الحقلُ حين لا
               قيمةَ له، فلا تنتفخ الحمولةُ العامّة.

               وهذه الواجهةُ هي **مصدرُ المتعلّم فعلا**: `public-content.ts`
               يستبدل بها الكتالوجَ المضمَّن، ولا يُقرأ المضمَّنُ إلّا حين
               تسقط. فكلُّ جزءٍ لا يُذكر هنا لا يصل المتعلّمَ وإن كان
               مؤلَّفا ومستورَدا ومنشورا.

               وقد وقع ذلك: أُضيف حقلا النشاط والروبرك إلى السياسة والبوّابة
               والكتالوج والمخطَّط والمستورِد واللقطة والواجهة، ونُسي هذا
               الإسقاطُ وحدَه — فسقط نصفُ ميزانيّة وقت المتعلّم (النشاطُ
               ٥٠–٦٠ دقيقةً من ١٢٠، والروبركُ عشر) من أربعٍ وثمانين وحدة،
               بلا خطأٍ يظهر: الحقلُ الغائبُ يُقرأ «لا نشاطَ لهذه الوحدة».
               ويحرسه الآن اختبارٌ يقارن حقولَ هذا الإسقاط بحقول اللقطة. */
            ...(v?.bodyAr ? { module_body_ar: v.bodyAr } : {}),
            ...(v?.checksAr ? { module_checks_ar: v.checksAr } : {}),
            ...(v?.videoAr ? { module_video_ar: v.videoAr } : {}),
            ...(v?.scenarioAr ? { module_scenario_ar: v.scenarioAr } : {}),
            ...(v?.practiceAr ? { module_practice_ar: v.practiceAr } : {}),
            ...(v?.rubricAr ? { module_rubric_ar: v.rubricAr } : {}),
          }
        }),
      ),
      library_resources: library.map((r) => ({
        id: r.id,
        kind: r.kind,
        title_ar: r.titleAr,
        ...(r.descriptionAr ? { description_ar: r.descriptionAr } : {}),
        url: r.url,
        ...(r.sourceAr ? { source_ar: r.sourceAr } : {}),
        ...(r.minutes ? { minutes: r.minutes } : {}),
        ...(r.skillSlugs.length ? { skill_slugs: r.skillSlugs } : {}),
        sort_order: r.sortOrder,
      })),
    }
  }
}
