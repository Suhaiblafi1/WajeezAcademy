/* ما بعدَ الدفع — ثلاثةُ أشياءٍ قالها القرار، ولكلٍّ موضعُه.

   «اجعل عمليّة الشراء تتمّ قبل نقله لمنصّته، وبعد الدفع يذهب للمنصّة **يرى ما
   دفع** ويختار الشعب التي يريد وتكون تلقائيا أوّل شعبة متاحة إلّا إذا قرّر أن
   يغيّرها. **لا يحقّ له تغيير مساره بعد الدفع**، فقط التنقّل بين الشعب ما
   دامت لم تبدأ بالفعل.»

   والقيودُ الحقيقيّة كلُّها في الخادم — تحرسها اختباراتُه على قاعدةٍ حيّة
   (`switch-cohort.test.ts` و`plan-locked-after-purchase.test.ts`). وما يُحرَس
   هنا هو **ما يراه المتعلّم**: أن يجد الرقمَ الذي دُفع، وأن يجد باب تبديل
   الموعد، وألّا يُترك أمام رفضٍ بلا سبب. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('«يرى ما دفع» — لا شكرا مجرّدة', () => {
  const ML = read('src/pages/student/Journey.tsx')

  /* كانت البطاقةُ تشكره وتحيله إلى «الفواتير»: نقرةٌ أخرى ليعرف عن ماذا خرج
     مالُه، في اللحظة التي يكون فيها أكثرَ ما يكون حاجةً إلى اليقين. */
  it('الطلبُ يُقرأ برقمه من الرابط ويُعرض في مكانه', () => {
    expect(ML).toMatch(/\/api\/learner\/orders/)
    expect(ML, 'الطلبُ يُقرأ ولا يُطابَق برقم الرابط').toMatch(/orders\.find\(\(o\) => o\.id === paidOrder\)/)
  })

  it('وببنوده ومجموعه ورقم فاتورته', () => {
    expect(ML).toMatch(/paid\.items\.map/)
    expect(ML).toMatch(/paid\.invoice/)
    expect(ML).toMatch(/paid\.total/)
  })

  it('والهديّةُ تُقرأ هديّةً لا صفرا — صفرٌ في فاتورة يُقرأ عطبا', () => {
    expect(ML).toMatch(/Number\(it\.unitPrice\) === 0 \? "هديّة"/)
  })

  it('ولا يُعرض شيءٌ من ذلك لمن ألغى دفعتَه', () => {
    expect(ML).toMatch(/if \(!paidOrder \|\| cancelledOrder\)/)
  })
})

describe('التنقّل بين الشعب — بابٌ ظاهر', () => {
  const SW = read('src/components/SwitchCohort.tsx')

  it('البابُ في لوح عمل المرحلة — حيث يقرأ شعبتَه', () => {
    /* موضعُه انتقل من بطاقة «دوراتي» إلى لوح المرحلة، والشرطُ نفسُه:
       يقرأ موعدَ البدء وإلّا لم يعرف أيُبدَّل أم لا. */
    const SWK = read('src/components/journey/StageWork.tsx')
    expect(SWK).toMatch(/<SwitchCohort\b/)
    expect(SWK, 'اللوحُ لا يقرأ موعد البدء فلا يعرف أيُبدَّل أم لا').toMatch(/startsAt=\{detail\.cohort\.startsAt\}/)
  })

  it('ولا يظهر بعد أن تبدأ الشعبة — القيدُ نصُّ القرار', () => {
    expect(SW).toMatch(/const started =/)
    expect(SW).toMatch(/if \(started \|\| options\.length === 0\) return null/)
  })

  it('ولا يُعرض إلّا شعبُ الدورة نفسِها — فلا يُغيَّر المسار من هذا الباب', () => {
    expect(SW).toMatch(/cohorts\.get\(courseId\)/)
    expect(SW).toMatch(/c\.id !== cohortId/)
  })

  it('والنداءُ إلى بابٍ واحد في الخادم — وهو حاملُ القيود لا هذه الشاشة', () => {
    expect(SW).toMatch(/\/api\/learner\/enrollments\/\$\{enrollmentId\}\/switch-cohort/)
  })
})

describe('رفضُ تبديل المسار — سببُه يُقرأ ولو لم يُقل في اللوح', () => {
  const SYNC = read('src/application/plan/adopted-plan.ts')

  /* كان `syncAdoptedPlan` يعيد `res.ok` وحدَه، فكلُّ فشلٍ عنده سواء: انقطاعُ
     شبكةٍ ومنعٌ متعمَّد. ومنذ صار الخادمُ يمنع تبديل المسار بعد الشراء صار من
     الرفض ما هو قرارٌ يستحقّ أن يُقرأ برمجيّا — ولو لم يُعرض نصّا اليوم. */
  it('الرفضُ ٤٠٩ يُقرأ سببُه لا حالتُه فقط', () => {
    expect(SYNC).toMatch(/res\.status === 409/)
    expect(SYNC).toMatch(/message_ar/)
  })

  /* كان السببُ يصل لوح الشراء ويُعرض جملةً ذهبيّة أعلاه («لا يُغيَّر المسار
     بعد الشراء…»). وقد نُقض هذا القرارُ بصريح طلب صاحب المنصّة بعد أن رآه
     حاجزا تقنيّا فوق شاشة الدفع لا معلومةً تعنيه — فحُذف العرضُ (`note` في
     BuyPanel وPathway.tsx)، وبقي المنعُ نفسُه في الخادم (السطر أعلاه) يحمي
     من فقد الشراء صامتا حتى بلا رسالة. */
  it('ولم يعد يُعرض في لوح الشراء — قرارٌ صريحٌ من صاحب المنصّة', () => {
    const BP = read('src/components/BuyPanel.tsx')
    const PW = read('src/pages/Pathway.tsx')
    expect(BP).not.toMatch(/note\?:/)
    expect(PW).not.toMatch(/planNote/)
  })
})
