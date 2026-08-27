/* كشف التناقضات بين الحقائق — قواعد حتمية موثقة */

import type { Contradiction, FactBag } from './types'

interface Rule {
  id: string
  factKeys: string[]
  severity: 'low' | 'medium' | 'high'
  check: (facts: FactBag, skillVector?: Record<string, number>) => boolean
  detail_ar: string
}

/* قاعدة urgent_goal_low_time حُذفت مع تقاعد سؤال الوقت الأسبوعي: شرطها الثاني
   (weekly_load = lt_3) لم يعد قابلًا للتحقق، فكانت قاعدة لا تُطلق أبدًا. */
const RULES: Rule[] = [
  {
    id: 'high_self_no_evidence',
    factKeys: ['skill_vector', 'evidence_strength'],
    severity: 'high',
    check: (f, skillVector = {}) => {
      const highSelf = Object.values(skillVector).filter((v) => v >= 4).length
      const ev = f['evidence_strength']?.value
      const evidenceLow = ev === 'low' || (typeof ev === 'number' && ev <= 2)
      return highSelf >= 2 && evidenceLow
    },
    detail_ar: 'تقييم ذاتي مرتفع لمهارات عدة دون دليل تطبيق — نتحقق قبل تخطي المواد الأساسية.',
  },
  {
    id: 'clear_goal_but_unknown',
    factKeys: ['goal_clarity', 'primary_goal'],
    severity: 'medium',
    check: (f) => f['goal_clarity']?.value === 'high' && f['primary_goal']?.value === 'explore',
    detail_ar: 'صرّحت أن هدفك واضح ثم اخترت «لا أعرف بعد» — أي الوصفين أقرب لواقعك اليوم؟',
  },
  {
    /* «موظف في بداية مساري» ثم «لا أعمل حاليًا» — رُصد في مراجعة التجربة: مضى
       التشخيص بلا تنبيه، ثم سأل من قال إنه لا يعمل عن قطاعه الوظيفي وعن تعامله
       بالمشتريات والعطاءات. والوصفان قد يجتمعان بلا كذب (منقطع عن عمل حديث،
       أو نقرة خاطئة)، فلا يُرفض أحدهما — لكن ترك التناقض بلا حسم يُضعف ست
       إجابات تالية ويُشعر المتعلم بأن النظام لا يستمع. */
    id: 'employed_stage_not_working',
    factKeys: ['career_stage', 'employment_state'],
    severity: 'medium',
    check: (f) => {
      const stage = f['career_stage']?.value
      const employed = ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld']
      const idle = f['employment_state']?.value
      return (
        typeof stage === 'string' &&
        employed.includes(stage) &&
        (idle === 'not_working' || idle === 'job_seeking')
      )
    },
    detail_ar: 'وصفت نفسك موظفا ثم أنك لا تعمل حاليا — أي الوصفين أقرب لواقعك اليوم؟',
  },
  {
    id: 'family_branch_business_goal',
    factKeys: ['persona_branch', 'primary_goal'],
    severity: 'low',
    check: (f) => f['persona_branch']?.value === 'family' && f['primary_goal']?.value === 'business_launch',
    detail_ar: 'السياق الأسري مع هدف مشروع تجاري — نضبط عبء المسار ليناسب المسؤوليات.',
  },
]

export function detectContradictions(
  facts: FactBag,
  existing: Contradiction[],
  skillVector: Record<string, number> = {},
): Contradiction[] {
  const known = new Map(existing.map((c) => [c.id, c]))
  const out: Contradiction[] = []
  for (const rule of RULES) {
    if (rule.check(facts, skillVector)) {
      out.push(
        known.get(rule.id) ?? {
          id: rule.id,
          factKeys: rule.factKeys,
          detail_ar: rule.detail_ar,
          severity: rule.severity,
          resolved: false,
        },
      )
    }
  }
  return out
}
