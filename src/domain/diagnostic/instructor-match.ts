/* مطابقة المدرب — مرشحات صارمة ثم تسجيل موزون؛ الفشل يعني unassigned لا بديل مزيف.
   لا يُرشَّح أي مدرب إلا إذا اجتاز كل المرشحات الصارمة:
   توثيق سارٍ بمصدر، عقد نشط، لغة، شخصية/مستوى، صيغة تعلم، توفر، سعة، وعدم تعارض موعد. */

import { launchPathways, trainerProfiles } from './catalog'
import { TRAINER_WEIGHTS } from './config'
import type { FactBag, TrainerMatch, TrainerProfile } from './types'

/** صلاحية التوثيق: 12 شهرا من تاريخ verified_at */
const VERIFICATION_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000

function verificationValid(t: TrainerProfile, now: number): boolean {
  if (t.verified !== true) return false
  if (!t.verified_source || t.verified_source.trim() === '') return false
  if (!t.verified_at) return false
  const at = Date.parse(t.verified_at)
  if (Number.isNaN(at)) return false
  return now - at <= VERIFICATION_VALIDITY_MS
}

/** تعارض موعد: إن عبّر المتعلم عن نوافذ محددة ولم تتقاطع مع جدول المدرب يُستبعد */
function scheduleConflict(t: TrainerProfile, facts: FactBag): boolean {
  const windows = facts['schedule_windows']?.value
  if (!Array.isArray(windows) || windows.length === 0) return false
  if (!t.weekly_schedule || t.weekly_schedule.length === 0) return true
  return !windows.some((w) =>
    t.weekly_schedule!.some((s) => typeof w === 'string' && w.includes(s.day)),
  )
}

export function matchTrainer(
  pathwayId: string,
  facts: FactBag,
  pathwaySkillSlugs: string[],
  now: number = Date.now(),
): TrainerMatch {
  const persona = facts['persona_type']?.value as string | undefined
  const language = (facts['language']?.value as string | undefined) ?? 'ar'
  const format = facts['learning_format']?.value as string | undefined
  const pathwayLevel = launchPathways.find((p) => p.id === pathwayId)?.level

  const rejections: { trainerId: string; reason: string }[] = []
  const eligible = trainerProfiles.filter((t) => {
    const reject = (reason: string) => {
      rejections.push({ trainerId: t.trainer_id, reason })
      return false
    }
    if (!verificationValid(t, now)) return reject('توثيق غير سارٍ أو بلا مصدر')
    if (t.contract_status !== 'active') return reject('العقد غير نشط')
    if (language !== 'both' && !t.languages.includes(language) && !t.languages.includes('both'))
      return reject('لغة التدريب لا تطابق لغة المتعلم')
    if (persona && t.personas.length > 0 && !t.personas.includes(persona)) return reject('الشخصية خارج نطاقه')
    if (pathwayLevel && t.levels && t.levels.length > 0 && !t.levels.includes(pathwayLevel))
      return reject('مستوى المسار خارج نطاقه')
    if (format && t.formats.length > 0 && !t.formats.includes(format) && !t.formats.includes('mixed'))
      return reject('صيغة التعلم غير متوفرة لديه')
    if (t.availability_weekly_hours <= 0) return reject('لا توفر أسبوعيا')
    if (
      t.capacity_max_learners !== undefined &&
      t.capacity_active_learners !== undefined &&
      t.capacity_active_learners >= t.capacity_max_learners
    )
      return reject('بلغ سقف السعة')
    if (scheduleConflict(t, facts)) return reject('تعارض موعد مع نوافذ المتعلم')
    return true
  })

  if (eligible.length === 0) {
    return {
      status: 'unassigned',
      note_ar:
        trainerProfiles.length === 0
          ? 'لا توجد ملفات مدربين موثقة بعد — يُعيَّن المدرب بعد اعتماد الشعبة، ولا نعرض اسما غير موثق.'
          : 'لا مدرب موثق يجتاز المرشحات الصارمة لهذه الحالة — يُعيَّن بعد اعتماد الشعبة.',
    }
  }

  const scored = eligible.map((t) => {
    const skillCoverage =
      pathwaySkillSlugs.length === 0
        ? 0
        : t.skill_slugs.filter((s) => pathwaySkillSlugs.includes(s)).length / pathwaySkillSlugs.length
    const levelPersona = persona && t.personas.includes(persona) ? 1 : 0.5
    const formatLanguage = t.languages.includes(language) ? 1 : 0.6
    const availability = Math.min(1, t.availability_weekly_hours / 10)
    const quality = t.quality_score
    const continuity = 0.5
    const score =
      skillCoverage * TRAINER_WEIGHTS.skillCoverage +
      levelPersona * TRAINER_WEIGHTS.levelPersona +
      formatLanguage * TRAINER_WEIGHTS.formatLanguage +
      availability * TRAINER_WEIGHTS.availability +
      quality * TRAINER_WEIGHTS.quality +
      continuity * TRAINER_WEIGHTS.continuity
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score || a.t.trainer_id.localeCompare(b.t.trainer_id))
  const best = scored[0]
  return {
    status: 'assigned',
    trainerId: best.t.trainer_id,
    nameAr: best.t.name_ar,
    score: best.score,
    note_ar: 'رُشّح هذا المدرب بعد اجتيازه كل المرشحات الصارمة، بمطابقة موزونة موثقة.',
  }
}
