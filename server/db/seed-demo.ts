/* بذر حسابات وبيانات الديمو — بيئة العرض المحلية فقط، لا تُشغَّل في الإنتاج.
   - خمسة حسابات ديمو بكلمة مرور موحدة (انظر DEMO_PASSWORD) وأدوار مختلفة.
   - طالب ديمو غني: ملف شخصي كامل، تشخيص مرفق، تسجيلان (نشط + مكتمل بشهادة)،
     طلب مدفوع بفاتورة ودفعة، إشعارات، وحالة مستشار مسندة لحساب المستشار التجريبي.
   - كل السجلات موسومة «ديمو/تجريبي» وتستخدم بريدا على نطاق wajeez.local.
   - idempotent: إعادة التشغيل لا تكرر شيئا (find-or-create بعلامات ثابتة). */

import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import { seedRbac } from '../auth/rbac-seed'
import { parseChecks } from '../../src/application/content/module-checks'

export const DEMO_PASSWORD = 'Wajeez-Demo-2026'

export const DEMO_ACCOUNTS = [
  { key: 'student', email: 'student.demo@wajeez.local', name: 'ليان الحوراني — حساب ديمو', roles: ['learner'] },
  { key: 'consultant', email: 'consultant.demo@wajeez.local', name: 'أستاذ سامر — مستشار ديمو', roles: ['advisor'] },
  { key: 'trainer', email: 'trainer.demo@wajeez.local', name: 'أستاذ رامي — مدرب ديمو', roles: ['trainer'] },
  { key: 'admin', email: 'admin.demo@wajeez.local', name: 'مدير أكاديمي — حساب ديمو', roles: ['academic_manager'] },
  { key: 'superadmin', email: 'superadmin.demo@wajeez.local', name: 'مدير النظام — حساب ديمو', roles: ['super_admin'] },
] as const

export type DemoRoleKey = (typeof DEMO_ACCOUNTS)[number]['key']

async function ensureUser(prisma: PrismaClient, email: string, name: string, roles: string[]) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  const user = await prisma.user.create({
    data: {
      email,
      displayName: name,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      roles: { createMany: { data: roles.map((roleId) => ({ roleId })) } },
    },
  })
  return user
}

/* متن درس ديمو (البند ح-١) — يعرض الصيغة كاملة: عناوين وقائمة مرقّمة
   ونقطية واقتباس وفاصل، بعربية سليمة لا نص حشو. */
const DEMO_LESSON_AR = [
  '# ما هي العملية القابلة للأتمتة؟',
  '',
  'ليست كل مهمة متكررة تصلح للأتمتة. المهمة المرشَّحة تجتمع فيها أربع صفات — وغياب واحدة منها يكفي لتأجيلها.',
  '',
  '## الصفات الأربع',
  '',
  '1. **متكررة بوتيرة معروفة** — يوميا أو أسبوعيا، لا مرة في السنة.',
  '2. **مدخلاتها منظّمة** — نموذج أو جدول أو رسالة بصيغة ثابتة، لا نصّ حرّ يختلف كل مرة.',
  '3. **قرارها محسوم بقاعدة** — «إن تجاوز المبلغ كذا فوجّهه لكذا»، لا «حسب تقدير المسؤول».',
  '4. **خطؤها مكلف أو مملّ** — فالأتمتة تشتري لك دقة أو وقتا، وإن لم تشترِ أيّهما فلا داعي لها.',
  '',
  '> القاعدة العملية: إن لم تستطع كتابة المهمة خطوات مرقّمة يفهمها زميل جديد، فلا تستطيع أتمتتها بعد.',
  '',
  '## تمرين قبل الجلسة',
  '',
  '- اكتب ثلاث مهام تكررها في أسبوعك.',
  '- ضع بجانب كل واحدة الصفات التي تحققها من الأربع.',
  '- احتفظ بالتي تحقق ثلاثا على الأقل — ستكون حالتك العملية في هذه الدورة.',
  '',
  '---',
  '',
  'في الجلسة القادمة نرسم عمليتك المختارة على ورقة واحدة، ثم نحدّد أضعف حلقة فيها.',
].join('\n')

/* تمرين استرجاع ديمو (ح-٣) — ثلاثة أسئلة على درس الوحدة نفسه */
const DEMO_CHECKS_AR = [
  'س: أي صفة لا تكفي وحدها لترشيح مهمة للأتمتة؟',
  'م: automation_opportunity_analysis',
  '+ تكرارها اليومي',
  '- انتظام مدخلاتها',
  '- حسم قرارها بقاعدة',
  'ش: التكرار شرط لا يكفي. مهمة متكررة بمدخلات غير منظّمة أو بقرار تقديري تفشل أتمتتها.',
  '',
  'س: ما علامة أن قرار المهمة «محسوم بقاعدة»؟',
  'م: process_mapping',
  '- أن يتخذه المسؤول سريعا',
  '+ أن تُكتب شروطه: إن كان كذا فافعل كذا',
  '- أن يكون القرار صحيحا غالبا',
  'ش: القاعدة تُكتب شروطا صريحة. «غالبا صحيح» تقدير لا قاعدة، ولا تصلح للأتمتة.',
  '',
  'س: متى تُؤجَّل أتمتة مهمة تحقق الصفات الأربع؟',
  'م: financial_decision_making',
  '- إذا كانت أسبوعية لا يومية',
  '- إذا كان عدد خطواتها كبيرا',
  '+ إذا كان خطؤها غير مكلف ولا مملّ',
  'ش: الأتمتة تشتري دقة أو وقتا. فإن لم تشترِ أيّهما فالعائد صفر وإن توفّرت بقية الشروط.',
  '',
  'س: بأي شيء يبدأ تحليل الأتمتة؟',
  'ف: 1',
  'م: operations_basics',
  '+ بالعملية نفسها',
  '- باختيار الأداة',
  '- بميزانية المشروع',
  'ش: الأداة تأتي بعد فهم العملية — والعكس يُنتج أتمتة لعملية مكسورة.',
].join('\n')

/* فيديو ديمو بفصول (ح-٢) — رابط عام معروف، والقيمة في الفصول لا في المحتوى */
const DEMO_VIDEO_AR = [
  'https://www.youtube.com/watch?v=aircAruvnKk',
  '0:00 لماذا نبدأ بالعملية لا بالأداة',
  '2:30 الصفات الأربع بالتفصيل',
  '7:10 تمرين على حالتك',
].join('\n')

/* البند ح-١: متن درس ديمو على أول وحدة من دورة معلومة.
   مستقلّة ومُستدعاة قبل حراسة «البيانات الغنية موجودة»، فتُطبَّق على قاعدة
   قائمة أيضا. ولا تلمس متنا مكتوبا — الحراسة !bodyAr. */
async function seedLessonBody(prisma: PrismaClient, courseId: string): Promise<'written' | 'skipped'> {
  const firstModule = await prisma.courseModule.findFirst({ where: { courseId }, orderBy: { id: 'asc' } })
  if (!firstModule) return 'skipped'
  const currentVersion = await prisma.courseModuleVersion.findFirst({
    where: { moduleId: firstModule.id },
    orderBy: { version: 'desc' },
  })
  if (!currentVersion) return 'skipped'
  /* حراسة مستقلة لكل حقل: وجود المتن لا يمنع بذر التمرين ولا العكس */
  const data: { bodyAr?: string; checksAr?: string; videoAr?: string } = {}
  if (!currentVersion.bodyAr) data.bodyAr = DEMO_LESSON_AR
  /* ⚠ يُعاد كتابة تمرين الديمو إن كان بلا ربط مهارات (ح-٤): محتوى الديمو
     مُولَّد لا مُؤلَّف، فتحديثه على قاعدة تطوير قائمة مقصود. لا يمسّ إنتاجا:
     هذه الدالة لا تُشغَّل إلا في بذر الديمو. */
  if (!currentVersion.checksAr || !currentVersion.checksAr.includes('م:')) data.checksAr = DEMO_CHECKS_AR
  if (!currentVersion.videoAr) data.videoAr = DEMO_VIDEO_AR
  if (Object.keys(data).length === 0) return 'skipped'
  await prisma.courseModuleVersion.update({ where: { id: currentVersion.id }, data })
  return 'written'
}

/* البند ص-٢: تسليم مقيَّم بروبرك وتعليق مدرب وتعديل درجة موثَّق.
   مستقلّة ومُستدعاة قبل حراسة «البيانات الغنية موجودة» فتُطبَّق على قاعدة
   قائمة. بلا هذه البيانات لا يظهر «من أين جاءت درجتك» ولا التعليق المعنون،
   فتبقى الميزة شيفرة بلا شاهد. */
async function seedGradedSubmission(prisma: PrismaClient): Promise<'written' | 'skipped'> {
  const student = await prisma.user.findUnique({ where: { email: 'student.demo@wajeez.local' } })
  const trainer = await prisma.user.findUnique({ where: { email: 'trainer.demo@wajeez.local' } })
  const admin = await prisma.user.findUnique({ where: { email: 'admin.demo@wajeez.local' } })
  if (!student || !trainer || !admin) return 'skipped'
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: student.id, status: 'enrolled' },
    orderBy: { createdAt: 'asc' },
  })
  if (!enrollment) return 'skipped'
  const already = await prisma.cohortAssessment.findFirst({
    where: { cohortId: enrollment.cohortId, title: { contains: 'خريطة عملية' } },
  })
  if (already) return 'skipped'
  const now = Date.now()

  const rubric = await prisma.gradingRubric.create({
    data: {
      title: 'روبرك خريطة العملية — ديمو',
      createdBy: admin.id,
      criteria: {
        create: [
          { sequence: 1, title: 'وضوح المشكلة وحدودها', maxScore: 10 },
          { sequence: 2, title: 'دقة رسم الخطوات', maxScore: 10 },
          { sequence: 3, title: 'تحديد أضعف حلقة بدليل', maxScore: 10 },
        ],
      },
    },
    include: { criteria: { orderBy: { sequence: 'asc' } } },
  })
  const assessment = await prisma.cohortAssessment.create({
    data: {
      cohortId: enrollment.cohortId,
      title: 'خريطة عملية قابلة للأتمتة',
      type: 'assignment',
      maxScore: 30,
      passScore: 18,
      dueAt: new Date(now - 3 * 86400_000),
      rubricId: rubric.id,
      status: 'published',
      createdBy: trainer.id,
    },
  })
  const submission = await prisma.assignmentSubmission.create({
    data: {
      assessmentId: assessment.id,
      enrollmentId: enrollment.id,
      textAnswer: 'رسمت عملية «مطابقة الفواتير» في سبع خطوات، وأضعف حلقة هي الإدخال اليدوي لأرقام الفواتير.',
      status: 'accepted',
      reviewNote: 'خريطة واضحة وتحديدك لأضعف حلقة مسنود بأمثلة. انتبه أن الخطوة الرابعة تحتاج قاعدة قرار صريحة قبل أتمتتها.',
      submittedAt: new Date(now - 2 * 86400_000),
      reviewedAt: new Date(now - 86400_000),
      reviewedBy: trainer.id,
    },
  })
  const grade = await prisma.grade.create({
    data: {
      submissionId: submission.id,
      score: 25,
      maxScore: 30,
      rubricScores: rubric.criteria.map((c, i) => ({ criterionId: c.id, score: [9, 8, 8][i] ?? 8 })),
      gradedBy: trainer.id,
    },
  })
  /* تعديل درجة موثّق — يظهر للمتعلم «عُدِّلت من ٢٢ إلى ٢٥» */
  await prisma.gradeHistory.create({
    data: { gradeId: grade.id, oldScore: 22, newScore: 25, reason: 'أُعيد النظر في معيار وضوح المشكلة بعد توضيح المتعلم', changedBy: trainer.id },
  })
  await prisma.trainerFeedback.create({
    data: {
      submissionId: submission.id,
      authorId: trainer.id,
      body: 'أفضل ما في تسليمك أنك بدأت بالعملية لا بالأداة. للخطوة القادمة: اكتب قاعدة القرار للخطوة الرابعة صراحة — «إن كان المبلغ أقل من كذا فوجّهه تلقائيا» — ثم قدّر الوقت الموفَّر أسبوعيا.',
    },
  })
  return 'written'
}

/* البند ط-١/ح-٧: متجه القياس في لقطة التشخيص الديمو.
   لقطة الديمو كانت بلا skill_vector، فكان ملف المهارات فارغا والنمو بلا مرجع
   قبليّ. نكتب مستويات ما قبل الدورة على مهارات حقيقية من القاعدة — منخفضة
   قصدا حتى يظهر أثر التعلم. مستقلّة ومُستدعاة قبل حراسة البيانات الغنية. */
async function seedDemoSkillVector(prisma: PrismaClient): Promise<'written' | 'skipped'> {
  const student = await prisma.user.findUnique({ where: { email: 'student.demo@wajeez.local' } })
  if (!student) return 'skipped'
  const profile = await prisma.learnerProfile.findUnique({ where: { userId: student.id } })
  if (!profile?.diagnosticSnapshot) return 'skipped'
  const snapshot = profile.diagnosticSnapshot as Record<string, unknown>
  if (snapshot.skill_vector) return 'skipped'

  /* مهارات الدورة المكتملة أولا (ليكون للنمو مرجع)، ثم متطلبات المسار */
  const courseLinks = await prisma.courseSkillLink.findMany({
    where: { courseId: 'C-AI-105' }, include: { skill: { select: { slug: true } } },
    orderBy: [{ weight: 'desc' }, { skillId: 'asc' }],
  })
  const pathwayReqs = await prisma.pathwaySkillRequirement.findMany({
    where: { pathwayId: 'PW-AUT-001' }, include: { skill: { select: { slug: true } } },
    take: 10, orderBy: { skillId: 'asc' },
  })
  const slugs = [...new Set([...courseLinks.map((l) => l.skill.slug), ...pathwayReqs.map((r) => r.skill.slug)])]
  if (slugs.length === 0) return 'skipped'

  /* مستويات ثابتة لا عشوائية: ١..٣ بالتناوب — بيانات ديمو تُعاد بنفس النتيجة */
  const skill_vector = Object.fromEntries(slugs.map((slug, i) => [slug, (i % 3) + 1]))
  await prisma.learnerProfile.update({
    where: { userId: student.id },
    data: { diagnosticSnapshot: { ...snapshot, skill_vector } },
  })
  return 'written'
}

/* البند ح-٧: قياس بعديّ محفوظ على التسجيل المكتمل، ليظهر النمو بأرقامه في ملف
   المهارات وعلى الشهادة. بلا هذه البيانات تبقى الميزة شيفرة بلا شاهد.
   الفرق مبذور واقعيا: أغلب المهارات ترتفع، وواحدة تثبت، وواحدة تتراجع —
   لأن مؤشرا لا ينزل ليس قياسا. */
async function seedDemoRemeasure(prisma: PrismaClient): Promise<'written' | 'skipped'> {
  const student = await prisma.user.findUnique({ where: { email: 'student.demo@wajeez.local' } })
  if (!student) return 'skipped'
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: student.id, status: 'completed' }, include: { cohort: { select: { courseId: true } } },
  })
  if (!enrollment) return 'skipped'
  const existing = await prisma.skillRemeasure.count({ where: { enrollmentId: enrollment.id } })
  if (existing > 0) return 'skipped'

  const profile = await prisma.learnerProfile.findUnique({ where: { userId: student.id } })
  const snapshot = (profile?.diagnosticSnapshot ?? {}) as { skill_vector?: Record<string, number> }
  const baseline = snapshot.skill_vector ?? {}
  const links = await prisma.courseSkillLink.findMany({
    where: { courseId: enrollment.cohort.courseId },
    include: { skill: { select: { slug: true } } },
    orderBy: [{ weight: 'desc' }, { skillId: 'asc' }],
  })
  if (links.length === 0) return 'skipped'

  /* نمط ثابت: +2 · +1 · بلا تغيّر ثم يتكرر — يُقصّ على السلّم ١..٥ */
  const gains = [2, 1, 0]
  const measuredAt = new Date(Date.now() - 9 * 86400_000)
  const data = links.map((l, i) => {
    const before = baseline[l.skill.slug] ?? null
    return {
      userId: student.id,
      enrollmentId: enrollment.id,
      courseId: enrollment.cohort.courseId,
      skillSlug: l.skill.slug,
      beforeLevel: before,
      afterLevel: Math.min(5, Math.max(1, (before ?? 2) + gains[i % gains.length])),
      measuredAt,
    }
  })
  /* تراجع واحد مبذور على أعلى مستوى قبليّ — لأن مؤشرا لا ينزل ليس قياسا،
     ولأن الطرح على مستوى ١ يُقصّ فلا يظهر تراجع أصلا */
  let top = -1
  for (const [i, r] of data.entries()) {
    if ((r.beforeLevel ?? 0) >= 2 && (top < 0 || (r.beforeLevel ?? 0) > (data[top].beforeLevel ?? 0))) top = i
  }
  if (top >= 0) data[top].afterLevel = (data[top].beforeLevel ?? 2) - 1
  await prisma.skillRemeasure.createMany({ data, skipDuplicates: true })
  return 'written'
}

/* البند ح-٤: بطاقات استرجاع متباعد للطالب الديمو — بعضها استحق وبعضها لم يحن،
   وواحدة في قمة السلّم وأخرى عادت لأوله بعد خطأ. بلا هذه البيانات تبقى صفحة
   المراجعة فارغة فلا يُرى السلوك. المواعيد نسبية للحظة البذر فتبقى واقعية. */
async function seedDemoRetrievalCards(prisma: PrismaClient): Promise<'written' | 'skipped'> {
  const student = await prisma.user.findUnique({ where: { email: 'student.demo@wajeez.local' } })
  if (!student) return 'skipped'
  const moduleId = 'C-AUT-101-M1'
  const existing = await prisma.retrievalCard.count({ where: { userId: student.id, moduleId } })
  if (existing > 0) return 'skipped'

  const version = await prisma.courseModuleVersion.findFirst({ where: { moduleId }, orderBy: { version: 'desc' } })
  if (!version) return 'skipped'
  const { checks } = parseChecks(version.checksAr)
  if (checks.length === 0) return 'skipped'

  const now = Date.now()
  /* خطوة · إزاحة الموعد بالأيام (سالب = استحق) · صواب سابق · أخطاء */
  const plan: [number, number, boolean | null, number][] = [
    [1, -2, true, 0],
    [0, -1, false, 1],
    [4, 40, true, 0],
    [2, -0.04, true, 1],
  ]
  const data = checks.slice(0, plan.length).map((c, i) => {
    const [step, offsetDays, lastCorrect, wrongCount] = plan[i]
    return {
      userId: student.id,
      moduleId,
      checkIndex: i,
      skillSlug: c.skillSlug,
      step,
      dueAt: new Date(now + offsetDays * 86400_000),
      lastAnswerAt: new Date(now - 3 * 86400_000),
      lastCorrect,
      correctCount: lastCorrect === true ? step + 1 : step,
      wrongCount,
    }
  })
  await prisma.retrievalCard.createMany({ data, skipDuplicates: true })
  return 'written'
}

export async function seedDemo(prisma: PrismaClient): Promise<{ users: number; richData: 'created' | 'existing' }> {
  await seedRbac(prisma)

  const [student, consultant, trainer, admin, superadmin] = await Promise.all(
    DEMO_ACCOUNTS.map((a) => ensureUser(prisma, a.email, a.name, [...a.roles])),
  )

  /* متن الدرس يُبذر أولا: قابل للتطبيق على قاعدة قائمة، وحراسته الخاصة تمنع التكرار */
  await seedLessonBody(prisma, 'C-AUT-101')
  await seedGradedSubmission(prisma)
  /* متجه القياس ثم القياس البعديّ — بهذا الترتيب: الفرق يحتاج مرجعا قبليّا */
  await seedDemoSkillVector(prisma)
  await seedDemoRemeasure(prisma)
  await seedDemoRetrievalCards(prisma)

  /* إن كان الطالب الديمو مسجلا في شعبة فالبيانات الغنية موجودة — لا تكرار */
  const alreadyRich = await prisma.enrollment.findFirst({ where: { userId: student.id } })
  if (alreadyRich) return { users: DEMO_ACCOUNTS.length, richData: 'existing' }

  /* ── المدرب الديمو: طلب معتمد + ملف مدرب مرتبط بالحساب (غير ظاهر للعامة) ── */
  const courseActive = await prisma.course.findFirst({ where: { id: 'C-AUT-101', status: 'published' } })
  const courseDone = await prisma.course.findFirst({ where: { id: 'C-AI-105', status: 'published' } })
  if (!courseActive || !courseDone) throw new Error('الكتالوج غير مستورد — شغّل الاستيراد قبل بذر الديمو')

  const application = await prisma.trainerApplication.upsert({
    where: { reference: 'WJ-TR-DEMO-0001' },
    update: {},
    create: {
      reference: 'WJ-TR-DEMO-0001',
      status: 'active',
      email: trainer.email,
      emailVerifiedAt: new Date(),
      fullName: 'رامي العبداللات — مدرب ديمو',
      country: 'الأردن',
      timezone: 'Asia/Amman',
      employmentStatus: 'full_time_training',
      jobTitle: 'مدرب أتمتة أعمال',
      bio: 'حساب مدرب تجريبي لأغراض العرض الداخلي فقط — لا يظهر للعامة.',
      motivation: 'حساب ديمو.',
      privacyConsentAt: new Date(),
      demoConsent: true,
      teachableCourseIds: [courseActive.id, courseDone.id],
    },
  })

  const trainerProfile = await prisma.trainerProfile.upsert({
    where: { applicationId: application.id },
    update: { userId: trainer.id },
    create: {
      applicationId: application.id,
      userId: trainer.id,
      headline: 'مدرب ديمو — أتمتة الأعمال',
      bioPublic: 'ملف تجريبي للعرض الداخلي — لا يُنشر للعامة.',
      isVerified: false,
      publicVisibility: false, // لا أرقام ولا ظهور عام لحسابات الديمو
    },
  })

  await prisma.trainerCourseQualification.upsert({
    where: { profileId_courseId: { profileId: trainerProfile.id, courseId: courseActive.id } },
    update: {},
    create: { profileId: trainerProfile.id, courseId: courseActive.id, status: 'qualified', qualifiedBy: admin.id, note: 'تأهيل ديمو' },
  })

  /* ── شعبتان: نشطة (قيد الدراسة) ومكتملة (بشهادة) ── */
  const now = Date.now()
  const cohortActive =
    (await prisma.cohort.findFirst({ where: { courseId: courseActive.id, title: { contains: 'ديمو' } } })) ??
    (await prisma.cohort.create({
      data: {
        courseId: courseActive.id,
        title: 'شعبة ديمو — اختيار العملية وجدوى الأتمتة',
        status: 'active',
        startsAt: new Date(now - 14 * 86400_000),
        endsAt: new Date(now + 14 * 86400_000),
        daysOfWeek: ['الأحد', 'الأربعاء'],
        startTime: '18:00',
        timezone: 'Asia/Amman',
        capacity: 20,
        price: 250,
        currency: 'JOD',
        registrationOpen: true,
        financialReady: true,
      },
    }))

  const cohortDone =
    (await prisma.cohort.findFirst({ where: { courseId: courseDone.id, title: { contains: 'ديمو' } } })) ??
    (await prisma.cohort.create({
      data: {
        courseId: courseDone.id,
        title: 'شعبة ديمو — مشروع إنتاجية مسؤول بالذكاء الاصطناعي',
        status: 'completed',
        startsAt: new Date(now - 60 * 86400_000),
        endsAt: new Date(now - 10 * 86400_000),
        daysOfWeek: ['الاثنين'],
        startTime: '17:00',
        timezone: 'Asia/Amman',
        capacity: 15,
        price: 200,
        currency: 'JOD',
        financialReady: true,
      },
    }))

  await prisma.cohortTrainer.upsert({
    where: { cohortId_profileId: { cohortId: cohortActive.id, profileId: trainerProfile.id } },
    update: {},
    create: { cohortId: cohortActive.id, profileId: trainerProfile.id, role: 'lead', assignedBy: admin.id },
  })
  await prisma.trainerCourseAssignment.create({
    data: { profileId: trainerProfile.id, courseId: courseActive.id, cohortId: cohortActive.id, assignedBy: admin.id },
  })

  /* ── الطالب الديمو: ملف شخصي كامل + تشخيص مرفق ── */
  const diagnosticSnapshot = {
    demo: true,
    kind: 'pathway',
    pathwayId: 'PW-AUT-001',
    pathwayTitle: 'أتمتة الأعمال والوكلاء الذكيون تحت إشراف بشري',
    confidence: 0.82,
    whyAr: 'بيانات ديمو — لقطة تشخيص تجريبية مرفقة بالحساب لأغراض العرض.',
  }

  await prisma.learnerProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      goalAr: 'أتمتة عمليات متكررة في عملي الحالي — بيانات ديمو',
      preferredLanguage: 'العربية',
      timezone: 'Asia/Amman',
      diagnosticSnapshot,
      attachedAt: new Date(),
      phone: '+962771052222',
      country: 'الأردن',
      city: 'عمّان',
      education: 'بكالوريوس',
      university: 'الجامعة الأردنية',
      major: 'إدارة أعمال',
      jobTitle: 'أخصائي عمليات',
      company: 'شركة ديمو',
      experienceYears: '4-7',
      careerGoal: 'قيادة تحول رقمي في قسمي — هدف تجريبي',
      interests: ['الأتمتة', 'الذكاء الاصطناعي', 'تحسين العمليات'],
    },
  })

  await prisma.diagnosticSession.create({
    data: {
      userId: student.id,
      engineVersion: 'demo-1',
      answers: { demo: true, note: 'إجابات تجريبية لأغراض العرض' },
      decisionTrace: { demo: true, steps: ['هدف: أتمتة', 'فجوة: اختيار العملية', 'توصية: PW-AUT-001'] },
      recommendationSnapshot: diagnosticSnapshot,
    },
  })

  /* ── تسجيلان: نشط بتقدم متفاوت، ومكتمل بشهادة ── */
  const enrollmentActive = await prisma.enrollment.upsert({
    where: { cohortId_userId: { cohortId: cohortActive.id, userId: student.id } },
    update: {},
    create: { cohortId: cohortActive.id, userId: student.id, status: 'enrolled', enrolledBy: admin.id },
  })

  const modulesActive = await prisma.courseModule.findMany({ where: { courseId: courseActive.id }, orderBy: { id: 'asc' } })

  const progressStates = ['completed', 'completed', 'in_progress', 'not_started'] as const
  for (const [i, m] of modulesActive.entries()) {
    const st = progressStates[Math.min(i, progressStates.length - 1)]
    await prisma.moduleProgress.upsert({
      where: { enrollmentId_moduleId: { enrollmentId: enrollmentActive.id, moduleId: m.id } },
      update: {},
      create: {
        enrollmentId: enrollmentActive.id,
        moduleId: m.id,
        status: st,
        evidence: { demo: true },
        completedAt: st === 'completed' ? new Date(now - (10 - i) * 86400_000) : null,
      },
    })
  }
  await prisma.courseProgress.upsert({
    where: { enrollmentId: enrollmentActive.id },
    update: {},
    create: { enrollmentId: enrollmentActive.id, percent: 50, evidence: { demo: true, attendancePct: 90, modulesCompleted: 2 } },
  })

  const enrollmentDone = await prisma.enrollment.upsert({
    where: { cohortId_userId: { cohortId: cohortDone.id, userId: student.id } },
    update: {},
    create: { cohortId: cohortDone.id, userId: student.id, status: 'completed', enrolledBy: admin.id },
  })
  const modulesDone = await prisma.courseModule.findMany({ where: { courseId: courseDone.id } })
  for (const m of modulesDone) {
    await prisma.moduleProgress.upsert({
      where: { enrollmentId_moduleId: { enrollmentId: enrollmentDone.id, moduleId: m.id } },
      update: {},
      create: { enrollmentId: enrollmentDone.id, moduleId: m.id, status: 'completed', evidence: { demo: true }, completedAt: new Date(now - 12 * 86400_000) },
    })
  }
  await prisma.courseProgress.upsert({
    where: { enrollmentId: enrollmentDone.id },
    update: {},
    create: { enrollmentId: enrollmentDone.id, percent: 100, evidence: { demo: true, attendancePct: 100, modulesCompleted: modulesDone.length } },
  })

  const certExists = await prisma.certificate.findUnique({ where: { number: 'WJ-CERT-2026-90001' } })
  if (!certExists) {
    await prisma.certificate.create({
      data: {
        number: 'WJ-CERT-2026-90001',
        enrollmentId: enrollmentDone.id,
        learnerName: 'ليان الحوراني — حساب ديمو',
        courseId: courseDone.id,
        courseVersion: courseDone.currentVersion,
        issuedBy: admin.id,
      },
    })
  }

  /* ── طلب مدفوع: فاتورة + دفعة تجريبية ناجحة ── */
  const paymentExists = await prisma.payment.findUnique({ where: { idempotencyKey: 'demo-seed-pay-0001' } })
  if (!paymentExists) {
    const versionTitle = await prisma.courseVersion.findFirst({ where: { courseId: courseActive.id, version: courseActive.currentVersion } })
    const order = await prisma.order.create({
      data: {
        userId: student.id,
        status: 'paid',
        subtotal: 250,
        discount: 0,
        total: 250,
        currency: 'JOD',
        paidAt: new Date(now - 14 * 86400_000),
        items: {
          create: [{ kind: 'cohort', refId: cohortActive.id, titleAr: `${versionTitle?.titleAr ?? 'دورة'} — شعبة ديمو`, unitPrice: 250, quantity: 1 }],
        },
        invoice: {
          create: {
            number: 'WJ-INV-2026-90001',
            amount: 250,
            currency: 'JOD',
            status: 'paid',
            paidAt: new Date(now - 14 * 86400_000),
          },
        },
      },
      include: { invoice: true },
    })
    await prisma.payment.create({
      data: {
        invoiceId: order.invoice!.id,
        provider: 'test',
        amount: 250,
        currency: 'JOD',
        status: 'succeeded',
        idempotencyKey: 'demo-seed-pay-0001',
        methodNote: 'دفعة ديمو — لا مال حقيقي',
        recordedBy: admin.id,
        succeededAt: new Date(now - 14 * 86400_000),
      },
    })
  }

  /* ── إشعارات ── */
  const hasNotifications = await prisma.notification.findFirst({ where: { userId: student.id } })
  if (!hasNotifications) {
    await prisma.notification.createMany({
      data: [
        { userId: student.id, templateKey: 'enrollment.confirmed', title: 'تم تأكيد تسجيلك — ديمو', body: 'سُجلت في شعبة «اختيار العملية وجدوى الأتمتة». بيانات تجريبية.', status: 'read', sentAt: new Date(now - 14 * 86400_000), readAt: new Date(now - 13 * 86400_000), data: { demo: true } },
        { userId: student.id, templateKey: 'certificate.issued', title: 'صدرت شهادتك — ديمو', body: 'شهادة إتمام «مشروع إنتاجية مسؤول بالذكاء الاصطناعي» جاهزة. بيانات تجريبية.', status: 'sent', sentAt: new Date(now - 10 * 86400_000), data: { demo: true } },
        { userId: student.id, templateKey: 'session.reminder', title: 'تذكير بجلسة الأربعاء — ديمو', body: 'جلسة الشعبة النشطة الساعة 18:00 بتوقيت عمّان. بيانات تجريبية.', status: 'queued', data: { demo: true } },
      ],
    })
  }

  /* ── حالة مستشار مسندة لحساب المستشار الديمو ── */
  const advisorCase = await prisma.advisorCase.findFirst({ where: { clientId: student.id } })
  if (!advisorCase) {
    const kase = await prisma.advisorCase.create({
      data: {
        clientId: student.id,
        status: 'follow_up',
        nextAction: 'متابعة بعد الجلسة الثالثة — حالة ديمو',
        nextFollowUpAt: new Date(now + 7 * 86400_000),
        diagnosticSnapshot,
      },
    })
    await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId: consultant.id, assignedBy: admin.id } })
    await prisma.advisorNote.create({
      data: { caseId: kase.id, authorId: consultant.id, body: 'طالبة ملتزمة؛ تحتاج دعما في اختيار العملية الأولى للأتمتة. ملاحظة ديمو.' },
    })
    await prisma.advisorTask.create({
      data: { caseId: kase.id, title: 'مراجعة تقدم الوحدة الثالثة — مهمة ديمو', dueAt: new Date(now + 5 * 86400_000), createdBy: consultant.id },
    })
  }

  /* ⚠ تُستدعى ثانيا: النداء الأول (قبل حراسة البيانات الغنية) يخدم القاعدة
     القائمة، وهذا يخدم القاعدة الجديدة حيث لم يكن التسجيل المكتمل قد أُنشئ بعد.
     كلتاهما idempotent فلا يتكرر شيء. */
  await seedDemoSkillVector(prisma)
  await seedDemoRemeasure(prisma)
  await seedDemoRetrievalCards(prisma)

  void superadmin // الحساب يُنشأ ضمن ensureUser أعلاه — لا بيانات إضافية له
  return { users: DEMO_ACCOUNTS.length, richData: 'created' }
}

/* تشغيل مباشر: npx tsx scripts/with-db.ts tsx server/db/seed-demo.ts */
if (process.argv[1]?.endsWith('seed-demo.ts')) {
  const { getPrisma, disconnectPrisma } = await import('./client')
  const prisma = await getPrisma()
  const result = await seedDemo(prisma)
  console.log(`✅ بذر الديمو: ${result.users} حسابات — البيانات الغنية: ${result.richData === 'created' ? 'أُنشئت' : 'موجودة مسبقا'}`)
  console.log('   كلمة المرور الموحدة للديمو:', DEMO_PASSWORD)
  for (const a of DEMO_ACCOUNTS) console.log(`   - ${a.key}: ${a.email}`)
  await disconnectPrisma()
  process.exit(0)
}
