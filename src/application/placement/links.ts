/* روابطُ اختبار تحديد المستوى — من خطّة الإنجليزيّة إليه، ومنه إلى الخطّة.

   الرابطُ يحمل المستوى الذي وصفه المتعلّمُ (`from`) لتقابل صفحةُ النتيجة ما قاله
   بما قاسه الاختبار، فتعرض الخيارين وأثرَ كلٍّ: «حدّث خطّتي بمستوى الاختبار» أو
   «أبقِ مستواي الموصوف» — والقرارُ له (قاعدةُ صاحب المنصّة: لا إجبارَ على فعل).
   والتحديثُ هو بابُ «غيّر مستواي» نفسُه (`reviseLevelHref`): يعيد بناءَ الخطّة من
   الجهاز بالجواب الجديد، بلا إعادة الأسئلة. */

import { Q } from '../../domain/diagnostic/v2_1/maps'
import { ENGLISH_LEVELS, type EnglishLevel } from '../../domain/diagnostic/v2_1/english'
import { reviseLevelHref } from '../diagnostic/level-summary'

export const PLACEMENT_PATH = '/placement/english'

export function placementHref(statedLevel?: EnglishLevel | null): string {
  return statedLevel ? `${PLACEMENT_PATH}?from=${statedLevel}` : PLACEMENT_PATH
}

/** المستوى الموصوف من الرابط — وما ليس مستوى يُتجاهَل */
export function statedLevelOf(params: { get(name: string): string | null }): EnglishLevel | null {
  const v = params.get('from')
  return ENGLISH_LEVELS.some((l) => l.code === v) ? (v as EnglishLevel) : null
}

/** رابطُ تحديث الخطّة بمستوى الاختبار — خيارُ سؤال المستوى المقابل له */
export function applyPlacementHref(level: EnglishLevel): string {
  const i = ENGLISH_LEVELS.findIndex((l) => l.code === level)
  return reviseLevelHref(Q.ENGLISH_LEVEL, `o${i + 1}`)
}
