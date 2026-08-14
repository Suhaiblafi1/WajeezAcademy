/* مطابقة المدرب — مرشحات صارمة ثم تسجيل موزون؛ الفشل يعني unassigned لا بديل مزيف */

import { trainerProfiles } from './catalog'
import { TRAINER_WEIGHTS } from './config'
import type { FactBag, TrainerMatch } from './types'

export function matchTrainer(_pathwayId: string, facts: FactBag, pathwaySkillSlugs: string[]): TrainerMatch {
  const persona = facts['persona_type']?.value as string | undefined
  const language = (facts['language']?.value as string | undefined) ?? 'ar'

  const eligible = trainerProfiles.filter((t) => {
    if (language !== 'both' && !t.languages.includes(language) && !t.languages.includes('both')) return false
    if (persona && t.personas.length > 0 && !t.personas.includes(persona)) return false
    if (t.availability_weekly_hours <= 0) return false
    return true
  })

  if (eligible.length === 0) {
    return {
      status: 'unassigned',
      note_ar: 'يُعيَّن المدرب بعد اعتماد الشعبة — لا نعرض اسما غير موثق.',
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
    note_ar: 'رُشّح هذا المدرب بمطابقة موزونة موثقة.',
  }
}
