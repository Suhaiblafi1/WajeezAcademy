/* تصحيحُ «مرآة وجيز» — حتميٌّ بالكامل، بجدولٍ يُقرأ لا بنموذجٍ يُصدَّق.
 *
 * كلُّ بُعدٍ متوسّطُ ثلاثةِ بنودٍ على مسطرة ١..٥. لا أوزانَ خفيّة، ولا معايرةَ
 * بعيّنةٍ لا نملكها. ومن أراد أن يراجع الحساب راجعه بورقةٍ وقلم — وهذا شرطُ
 * نشرِ اختبارٍ بلا تسجيل: ما لا يُدقَّق لا يُعرض على زائرٍ لا يعرفنا. */

import { RIASEC_DIMS, type RiasecDim } from '../v2_1/maps'
import { RIASEC_ITEM_IDS, mirrorItems, type ReadinessKey } from './items'

export type MirrorAnswerMap = Record<string, number>

export interface MirrorResult {
  /** متوسّطُ كلّ بُعد على ١..٥ — أو `null` إن لم يُجب أيُّ بندٍ منه */
  dims: Record<RiasecDim, number | null>
  /** الرمزُ الثلاثيّ: أعلى ثلاثةِ أبعادٍ مرتَّبةً */
  code: RiasecDim[]
  /** مقاييسُ الجاهزيّة — تُعرض، ولا يُبذَر منها إلّا `goal_clarity` */
  readiness: Record<ReadinessKey, number | null>
  answered: number
  total: number
}

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length

export function scoreMirror(answers: MirrorAnswerMap): MirrorResult {
  const items = mirrorItems()
  const dims = {} as Record<RiasecDim, number | null>
  for (const dim of RIASEC_DIMS) {
    const vals = RIASEC_ITEM_IDS[dim].map((id) => answers[id]).filter((v): v is number => typeof v === 'number')
    dims[dim] = mean(vals)
  }

  const readiness = {} as Record<ReadinessKey, number | null>
  for (const key of ['goal_clarity', 'application_readiness', 'completion_pattern'] as ReadinessKey[]) {
    const vals = items
      .filter((it) => it.block === 'readiness' && it.measures === key)
      .map((it) => answers[it.id])
      .filter((v): v is number => typeof v === 'number')
    readiness[key] = mean(vals)
  }

  /* الرمزُ الثلاثيّ. والتعادلُ يُحسم **بترتيب الأبعاد الثابت** لا بالقرعة:
     زائران بالإجابات نفسِها يريان الرمزَ نفسَه، وإلّا صار الاختبارُ يتكلّم
     بلسانين. */
  const code = RIASEC_DIMS.filter((d) => dims[d] !== null)
    .sort((a, b) => (dims[b] ?? 0) - (dims[a] ?? 0) || RIASEC_DIMS.indexOf(a) - RIASEC_DIMS.indexOf(b))
    .slice(0, 3)

  return {
    dims,
    code,
    readiness,
    answered: items.filter((it) => typeof answers[it.id] === 'number').length,
    total: items.length,
  }
}

/** أسماءُ الأبعاد للعرض — ولا تُعرض الأسماءُ اللاتينيّة على زائرٍ عربيّ */
export const DIM_LABEL_AR: Record<RiasecDim, string> = {
  riasec_realistic: 'العمليّ',
  riasec_investigative: 'الباحث',
  riasec_artistic: 'المبدع',
  riasec_social: 'الاجتماعيّ',
  riasec_enterprising: 'المبادر',
  riasec_conventional: 'المنظّم',
}

export const READINESS_LABEL_AR: Record<ReadinessKey, string> = {
  goal_clarity: 'وضوحُ الهدف',
  application_readiness: 'الاستعدادُ للتطبيق',
  completion_pattern: 'الاستمرارُ حتّى الإنهاء',
}
