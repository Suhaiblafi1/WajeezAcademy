/* من لا عملَ له لا يُوعَد بترقية — حارسُ حسمِ الهدف بحالة العمل.

   ─────────── العطبُ الذي وُضع له هذا الحارس ───────────

   حسمُ `employment_advancement` كان ثنائيّا: `first_job` لمن كان طالبا أو في
   أوّل الطريق ولا يعمل، و`promotion` **لكلّ من سواه** ما دامت حالةُ عمله
   معروفة. فمن وصف نفسه بمرحلته («موظّف في بداية مساري» · «مدير») ثمّ قال «لا
   أعمل حاليًا» — وهو من بين وظيفتَين، وحالٌ شائعةٌ يعرفها `contradictions.ts`
   نفسُه — كان يُحسم هدفُه «ترقية»، فتقول له الشاشة:

       «هدفك: ترقية في عملك الحالي.»

   ولا عملَ له. ثمّ يُساق إلى مسارات الترقية دون مسارات الجاهزية للتوظيف، وهي
   ما يحتاجه فعلا. وقياسُ فضاء الإجابات: ٢٣ جلسةً من ٧٥٠ (٣٫١٪) في سبع مراحلَ
   من عشر.

   ─────────── والجذرُ واحدٌ لعطبَين ───────────

   البنكان يسمّيان جوابا واحدا باسمين: «أبحث عن عمل» في `QB-M1-003` (V2)
   يختزل `not_working`، وفي `QC-S1-002` (V2.1) يختزل `job_seeking`. فلمّا جاء
   V2.1 برمزٍ جديدٍ لم يُعلَّمه مستهلكوه: قاعدةُ الهدف لم تعرف إلّا الأوّل،
   واشتقاقُ الشخصيّة مثلُها — فخرّيجٌ يقول «أبحث عن عمل» حرفا لم يكن يُعدّ
   باحثا عن عمل، ويُعدُّه من قال «لا أعمل حاليًا».

   فالمقيسُ هنا **حالةُ العمل** لا المرحلة: من لا عملَ له لا يُنسب إليه عملٌ
   لا يملكه، بأيّ لفظٍ قالها وفي أيّ بنكٍ سُئل. */

import { describe, expect, it } from 'vitest'
import { applyDerivedRules } from '../../domain/diagnostic/facts'
import { derivePersona } from '../../domain/diagnostic/v2/personas'
import type { FactBag, FactValue } from '../../domain/diagnostic/types'

/** حقيقةٌ بأقلّ ما يلزم — والنصُّ الخامُ (`raw`) يلزم لاشتقاق الشخصيّة.

    ومبنيّةٌ بالنوع لا بحيلةِ `as`: أوّلُ صياغةٍ لهذا الملفّ كتبت `questionId`
    و`confidence` — وهما ليسا من `FactValue` في شيء — فمرّ على `as` صامتا،
    وأمسكه `tsc` وحدَه. فحقيقةٌ مصنوعةٌ بأسماءٍ غيرِ أسماء الإنتاج تحرس وهما. */
const f = (value: string, raw?: string): FactValue => ({
  value,
  sourceQuestionId: 'q-اختبار',
  evidenceQuality: 1,
  ...(raw ? { raw } : {}),
})

const bag = (persona: string, emp?: string, goal = 'employment_advancement'): FactBag => ({
  persona_type: f(persona),
  primary_goal: f(goal),
  ...(emp ? { employment_state: f(emp) } : {}),
})

/** كلُّ ما يعنيه «لا عملَ له» في البنكَين — ولا ثالثَ لهما */
const JOBLESS = ['not_working', 'job_seeking'] as const
/** المراحلُ التي تجاوزت أوّلَ الطريق — وهي التي كانت تُحسم «ترقية» */
const SENIOR = ['employee', 'manager', 'trainer'] as const

describe('من لا عملَ له لا يُحسم هدفُه «ترقية»', () => {
  it('لا واحدةَ من حالات انعدام العمل تُنتج «ترقية» في أيّ مرحلة', () => {
    for (const emp of JOBLESS) {
      for (const persona of [...SENIOR, 'student', 'early_career'] as const) {
        const facts = bag(persona, emp)
        applyDerivedRules(facts)
        expect(
          facts['primary_goal']?.value,
          `${persona} + ${emp}: وُعد بترقيةٍ في عملٍ لا يملكه`,
        ).not.toBe('promotion')
      }
    }
  })

  it('ومن جاوز أوّلَ الطريق يبقى على جوابه «وظيفة أو ترقية» — لا يُنسب إليه عملٌ ولا يُقال له «أوّل فرصة»', () => {
    for (const emp of JOBLESS) {
      for (const persona of SENIOR) {
        const facts = bag(persona, emp)
        applyDerivedRules(facts)
        expect(facts['primary_goal']?.value, `${persona} + ${emp}`).toBe('employment_advancement')
      }
    }
  })

  it('ومن كان في أوّله فهدفُه أوّلُ وظيفة — بأيّ اللفظَين قالها', () => {
    for (const emp of JOBLESS) {
      for (const persona of ['student', 'early_career'] as const) {
        const facts = bag(persona, emp)
        applyDerivedRules(facts)
        expect(facts['primary_goal']?.value, `${persona} + ${emp}`).toBe('first_job')
      }
    }
  })

  /* ولا يُنقَض المكسبُ بإسقاط الحسم الصحيح: من يعمل **يُحسم** ترقيةً */
  it('ومن له عملٌ قائمٌ يُحسم «ترقية» كما كان — الإصلاحُ لا يلغي القاعدة', () => {
    for (const emp of ['employed', 'self_employed', 'business_owner']) {
      const facts = bag('employee', emp)
      applyDerivedRules(facts)
      expect(facts['primary_goal']?.value, `employee + ${emp}`).toBe('promotion')
    }
  })

  it('وبلا دليلِ حالةِ عملٍ لا يُحسم شيء — إلّا الطالبَ فأوّلُ وظيفة', () => {
    const open = bag('employee')
    applyDerivedRules(open)
    expect(open['primary_goal']?.value, 'حُسم بلا دليل').toBe('employment_advancement')

    const student = bag('student')
    applyDerivedRules(student)
    expect(student['primary_goal']?.value).toBe('first_job')
  })

  /* والقاعدةُ توصف بأنّها idempotent — فتُشغَّل مرّتين ويُقارَن */
  it('والقاعدةُ ثابتةٌ على التكرار — تشغيلُها مرّتين كتشغيلها مرّة', () => {
    for (const emp of [...JOBLESS, 'employed', undefined]) {
      for (const persona of [...SENIOR, 'student', 'early_career'] as const) {
        const once = bag(persona, emp)
        applyDerivedRules(once)
        const twice = bag(persona, emp)
        applyDerivedRules(twice)
        applyDerivedRules(twice)
        expect(twice['primary_goal']?.value, `${persona} + ${emp}: تغيّر بالتكرار`).toBe(
          once['primary_goal']?.value,
        )
      }
    }
  })
})

describe('ومن قال «أبحث عن عمل» يُعدّ باحثا عن عمل — في البنكَين', () => {
  it('خرّيجٌ باحثٌ عن عمل شخصيّتُه `job_seeker` بأيّ رمزٍ اختُزل جوابُه', () => {
    for (const emp of JOBLESS) {
      const facts: FactBag = {
        persona_type: f('early_career', 'خريج حديث — أبحث عن فرصتي الأولى'),
        employment_state: f(emp),
      }
      expect(derivePersona(facts).key, `خرّيج + ${emp}: لم يُعدّ باحثا عن عمل`).toBe('job_seeker')
    }
  })

  it('ومن له عملٌ يبقى خرّيجا لا باحثا — لا يُوسَّع الشرطُ على عواهنه', () => {
    const facts: FactBag = {
      persona_type: f('early_career', 'خريج حديث — أبحث عن فرصتي الأولى'),
      employment_state: f('employed'),
    }
    expect(derivePersona(facts).key).toBe('graduate')
  })
})
