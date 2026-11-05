/* سطرُ موعد الشعبة — تاريخُ أوّل لقاءٍ لا تاريخُ بدئها (٥ نوفمبر ٢٠٢٦).

   كان السطرُ «15 ديسمبر · الأربعاء»: تاريخُ بدء الشعبة ثمّ يومُ لقائها الأسبوعيّ — وبدؤها ليس يومَ لقاء. فيُقرأ أنّ
   الخامسَ عشرَ أربعاء، وهو ثلاثاء وأوّلُ لقاءٍ في السادسَ عشر. وأبعدُ منه «1 ديسمبر · الأحد» وأوّلُ لقاءٍ في السادس.
   وقرارُ صاحب المنصّة («أ»): يُعرض تاريخُ أوّل لقاءٍ بيومه. ولا يُمسّ موعدُ الشعبة نفسُه.

   وأوّلُ لقاءٍ أبكرُ لقاءاتها المعلنة — وهي فارغةٌ حتّى يُعتمَد جدولُ مدرّبها، فيبقى تاريخُ البدء كما كان.
   والحارس: `src/tests/catalog/cohort-when.test.ts`. */

import { cohortDayAr } from '../learning/cohort-gate'

export interface CohortWhenInput {
  startsAt: string | null
  sessions?: readonly { startsAt: string }[] | null
}

/** متى يُقال إنّها تبدأ — أوّلُ لقاءٍ إن عُرف، وإلّا بدءُ الشعبة. و`at` ما يُحسب منه «بعد كذا» */
export function cohortWhen(c: CohortWhenInput): { labelAr: string; at: string | null } {
  const first = (c.sessions ?? [])
    .map((s) => s.startsAt)
    .filter((s) => !Number.isNaN(new Date(s).getTime()))
    .sort()[0]
  if (first) {
    return { labelAr: `أول لقاء ${cohortDayAr(first, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, at: first }
  }
  return { labelAr: cohortDayAr(c.startsAt), at: c.startsAt }
}
