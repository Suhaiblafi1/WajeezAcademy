/* بوّابةُ ظهور اسم المدرّب للعامّة — واحدةٌ لكلّ السطوح.

   ═══ ما كان ═══

   أربعةُ سطوحٍ تُظهر اسمَ مدرّب، ولكلٍّ بوّابتُها المكتوبةُ بيدها:
     · الصفحةُ العامّة `/trainers`: ظهورٌ + توثيقٌ + اعتمادُ نشرٍ + لا إيقاف.
     · بطاقةُ الدورة `/api/courses/:id/trainer`: ظهورٌ + توثيقٌ + لا إيقاف —
       **بلا اعتمادِ نشر**.
     · الشعبُ العامّة `/api/public/cohorts`: اعتمادُ نشرٍ **وحدَه** — فالموقوفُ
       الذي اعتُمد نشرُه قبل إيقافه يبقى اسمُه في بيانات الشعبة.
     · التقويمُ: ظهورٌ + اعتمادُ نشر.

   وهي متّفقةٌ اليوم بالصدفة (اعتمادُ النشر هو الذي يشعل الظهور، والإيقافُ
   يطفئه)، لا بالبنية — وأوّلُ من يعدّل واحدةً يفرّقها.

   ═══ القرار ═══

   قاعدةُ المستودَع: «لا اسمَ مدرّبٍ يُعرض حقيقةً قبل اعتمادِ نشره
   (`publishApprovedAt`)». فالبوّابةُ هنا وحدَها، بصيغتين: شرطُ استعلامٍ لمن
   يقرأ من الجدول مباشرة، ودالّةُ ترشيحٍ لمن يقرأ الملفَّ ضمن علاقة. وكلتاهما
   تقولان الشيءَ نفسَه، ويحرسهما `src/tests/trainers-page.test.ts`. */

import type { Prisma } from '@prisma/client'
import { termBounds, termOf } from '../../src/application/terms/season'

/** ما تحتاجه البوّابةُ من الملفّ — يُنتقى في `select` حيث يُقرأ ضمن علاقة */
export interface TrainerVisibilityFields {
  publicVisibility: boolean
  isVerified: boolean
  publishApprovedAt: Date | null
  suspendedAt: Date | null
}

export const TRAINER_VISIBILITY_SELECT = {
  publicVisibility: true, isVerified: true, publishApprovedAt: true, suspendedAt: true,
} as const

/** شرطُ الاستعلام — للقوائم التي تقرأ `TrainerProfile` مباشرة */
export const PUBLIC_TRAINER_WHERE: Prisma.TrainerProfileWhereInput = {
  publicVisibility: true, isVerified: true, publishApprovedAt: { not: null }, suspendedAt: null,
}

/* ═══ ولا اسمَ ولا صورةَ إلّا لمن له دوراتٌ منشورةٌ هذا الفصلَ أو بعده ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «يجب أن تكون الصور المنشورة والحسابات
   المنشورة فقط للمدربين الذين لهم دورات هذا الفصل أو بعده! لا ينشر حساب لمن لم
   نعتمد دوراته ولم تنشر». فاعتمادُ النشر أعلاه شرطٌ لا يكفي وحدَه.

   و«دوراتُه» بقاعدة الأتعاب نفسِها (`cohort-lead.ts`): أصيلُ الشعبة، أو إسنادُه
   النشطُ فيها. و«منشورة» شعبةٌ خرجت من الإعداد إلى الناس: مفتوحةٌ أو ممتلئةٌ أو
   جارية — وهذه من الفصل الجاري أو ما بعده بطبيعتها. والمكتملةُ تُحسب إن انتهت
   في الفصل الجاري: هي من دوراته «هذا الفصل». ومثلُها مسارُه المنشورُ لفصلٍ لم
   ينتهِ أو بلا فصل. وشعبةُ الإعداد والمسودّةُ والملغاة لا تُحسب: لم تُعتمد ولم تُنشر.

   والفصلُ من التاريخ (`termOf`) لا من `termId`: شعبُ الإنتاج كلُّها بلا فصلٍ
   مربوط — قِيس في ١٩ أكتوبر: ٣٢ شعبةً مفتوحةً و`termId` فارغٌ فيها كلِّها.

   ولماذا دالّةٌ لا ثابت: اليومُ جزءٌ من الشرط، وثابتٌ يُحسب عند تحميل الوحدة
   يتجمّد على يوم الإقلاع والخادمُ يعمل أسابيع. */

/** أوّلُ يومٍ في الفصل الجاري — ما انتهى قبله ليس «هذا الفصلَ أو بعده» */
export function currentTermStart(now: Date): Date {
  const t = termOf(now)
  return termBounds(t.year, t.season).startsOn
}

/** الشعبةُ المنشورةُ هذا الفصلَ أو بعده — شرطُها وحدَه */
export function liveCohortWhere(now: Date = new Date()): Prisma.CohortWhereInput {
  return {
    OR: [
      { status: { in: ['open', 'full', 'active'] } },
      { status: 'completed', endsAt: { gte: currentTermStart(now) } },
    ],
  }
}

/** والمسارُ المنشورُ لفصلٍ لم ينتهِ — والفصلُ فيه اختياريّ (`TrainerPath.termId`):
    منشورٌ بلا فصلٍ معتمدٌ منشورٌ وليس ماضيا، فيُحسب */
export function livePathWhere(now: Date = new Date()): Prisma.TrainerPathWhereInput {
  return { status: 'published', OR: [{ termId: null }, { term: { endsOn: { gte: currentTermStart(now) } } }] }
}

/** شرطُ «له دوراتٌ منشورةٌ هذا الفصلَ أو بعده» وحدَه — تقرؤه شاشةُ الإدارة أيضا */
export function liveTrainerWhere(now: Date = new Date()): Prisma.TrainerProfileWhereInput {
  const cohort = liveCohortWhere(now)
  return {
    OR: [
      { cohortTrainers: { some: { role: 'lead', cohort } } },
      { assignments: { some: { status: 'active', cohort } } },
      { paths: { some: livePathWhere(now) } },
    ],
  }
}

/** البوّابةُ كاملةً — لكلّ سطحٍ يعرض المدرّبَ بذاته: صفحةُ الفريق وصفحتُه وصورتُه */
export function publicTrainerWhere(now: Date = new Date()): Prisma.TrainerProfileWhereInput {
  return { ...PUBLIC_TRAINER_WHERE, AND: [liveTrainerWhere(now)] }
}

/** الترشيحُ — للملفّ حين يصل ضمن إسنادٍ أو شعبة. ولا يُسأل فيه عن الدورات:
    من يصل هكذا يُعرض **مدرّبا لشعبةٍ أو مسارٍ منشورٍ** بعينه، فهو صاحبُ دورة. */
export function trainerPubliclyVisible(p: TrainerVisibilityFields): boolean {
  return p.publicVisibility && p.isVerified && p.publishApprovedAt !== null && p.suspendedAt === null
}
