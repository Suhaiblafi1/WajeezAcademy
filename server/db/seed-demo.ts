/* بذر حسابات وبيانات الديمو — بيئة العرض المحلية فقط، لا تُشغَّل في الإنتاج.
   - خمسة حسابات ديمو بكلمة مرور موحدة (انظر DEMO_PASSWORD) وأدوار مختلفة.
   - طالب ديمو غني: ملف شخصي كامل، تشخيص مرفق، تسجيلان (نشط + مكتمل بشهادة)،
     طلب مدفوع بفاتورة ودفعة، إشعارات، وحالة مستشار مسندة لحساب المستشار التجريبي.
   - كل السجلات موسومة «ديمو/تجريبي» وتستخدم بريدا على نطاق wajeez.local.
   - idempotent: إعادة التشغيل لا تكرر شيئا (find-or-create بعلامات ثابتة). */

import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import { seedRbac } from '../auth/rbac-seed'

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

export async function seedDemo(prisma: PrismaClient): Promise<{ users: number; richData: 'created' | 'existing' }> {
  await seedRbac(prisma)

  const [student, consultant, trainer, admin, superadmin] = await Promise.all(
    DEMO_ACCOUNTS.map((a) => ensureUser(prisma, a.email, a.name, [...a.roles])),
  )

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
