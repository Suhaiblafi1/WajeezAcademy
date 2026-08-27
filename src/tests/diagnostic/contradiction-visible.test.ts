/* التناقض الذي كان يُقاس ولا يُقال.
 *
 * في مراجعة التجربة: أُجيب «موظف في بداية مساري» ثم «لا أعمل حاليًا»، فمضى
 * التشخيص بلا تنبيه — ثم سأل من قال إنه لا يعمل عن قطاعه الوظيفي، وبعدها عن
 * تعامله بالمشتريات والعطاءات. والمحرك كان يملك القاعدة والبنية: يكشف التناقض،
 * ويخفض به مكوّن «اتساق إجاباتك»، ويرفع ترتيب الأسئلة التي تحسمه — ولا يعرض
 * منه حرفا واحدا. ونصّ كل قاعدة مكتوب للمتعلم أصلا وينتهي بسؤال موجّه إليه.
 *
 * فهنا شيئان يُحرسان: أن القاعدة تكشف الحالة ولا تتوسّع إلى ما ليس تناقضا،
 * وأن الأشدّ وحده يُرفع للعرض — لا كلّ ما اجتمع، فالتنبيهات المتراكمة تُقرأ
 * لوما لا مساعدة.
 */

import { describe, it, expect } from 'vitest'
import { detectContradictions } from '@/domain/diagnostic/contradictions'
import type { FactBag } from '@/domain/diagnostic/types'

const fact = (value: string) => ({ value, sourceQuestionId: 'T', evidenceQuality: 0.9 })
const facts = (stage: string, employment: string): FactBag =>
  ({ career_stage: fact(stage), employment_state: fact(employment) }) as unknown as FactBag

const has = (f: FactBag, id: string) => detectContradictions(f, [], {}).some((c) => c.id === id)
const RULE = 'employed_stage_not_working'

describe('تناقض «موظف» مع «لا أعمل»', () => {
  it('يُكشف لكل مرحلة تفترض عملا قائما', () => {
    for (const stage of ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld']) {
      expect(has(facts(stage, 'not_working'), RULE), `${stage} + لا أعمل: لم يُكشف`).toBe(true)
      expect(has(facts(stage, 'job_seeking'), RULE), `${stage} + أبحث عن عمل: لم يُكشف`).toBe(true)
    }
  })

  it('لا يُكشف حين يتّسق الوصفان — ولا نُزعج من لا تناقض عنده', () => {
    for (const s of ['employed', 'self_employed', 'business_owner']) {
      expect(has(facts('manager', s), RULE), `مدير + ${s}: تنبيه بلا سبب`).toBe(false)
    }
  })

  it('الطالب والخريج لا يعملان بحكم وصفهما — فلا تناقض', () => {
    for (const stage of ['university_student', 'fresh_graduate', 'other_unsure']) {
      expect(has(facts(stage, 'not_working'), RULE), `${stage}: تنبيه بلا سبب`).toBe(false)
      expect(has(facts(stage, 'job_seeking'), RULE), `${stage}: تنبيه بلا سبب`).toBe(false)
    }
  })

  it('لا يُكشف بحقيقة ناقصة — الغياب ليس تناقضا', () => {
    expect(has({ career_stage: fact('manager') } as unknown as FactBag, RULE)).toBe(false)
    expect(has({ employment_state: fact('not_working') } as unknown as FactBag, RULE)).toBe(false)
    expect(has({} as FactBag, RULE)).toBe(false)
  })

  it('نصّه سؤال موجّه للمتعلم لا وصفا داخليا', () => {
    const c = detectContradictions(facts('manager', 'not_working'), [], {}).find((x) => x.id === RULE)
    expect(c?.detail_ar).toContain('؟')
    expect(c?.detail_ar, 'تسرّبت مفردات داخلية إلى نصّ يُعرض').not.toMatch(
      /career_stage|employment_state|fact|rule/,
    )
  })

  it('التناقض المحسوم لا يُعاد رفعه', () => {
    const f = facts('manager', 'not_working')
    const resolved = detectContradictions(f, [], {}).map((c) => ({ ...c, resolved: true }))
    const again = detectContradictions(f, resolved, {}).find((c) => c.id === RULE)
    expect(again?.resolved, 'أُعيد فتح تناقض حسمه المتعلم').toBe(true)
  })
})
