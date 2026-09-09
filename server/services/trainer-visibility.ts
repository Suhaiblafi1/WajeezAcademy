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

/** الترشيحُ — للملفّ حين يصل ضمن إسنادٍ أو شعبة */
export function trainerPubliclyVisible(p: TrainerVisibilityFields): boolean {
  return p.publicVisibility && p.isVerified && p.publishApprovedAt !== null && p.suspendedAt === null
}
