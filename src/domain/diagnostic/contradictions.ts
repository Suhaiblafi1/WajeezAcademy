/* كشف التناقضات بين الحقائق — قواعد حتمية موثقة */

import type { Contradiction, FactBag } from './types'

interface Rule {
  id: string
  factKeys: string[]
  severity: 'low' | 'medium' | 'high'
  check: (facts: FactBag, skillVector?: Record<string, number>) => boolean
  detail_ar: string
}

const RULES: Rule[] = [
  {
    id: 'urgent_goal_low_time',
    factKeys: ['goal_urgency', 'weekly_load'],
    severity: 'medium',
    check: (f) => f['goal_urgency']?.value === 'urgent' && f['weekly_load']?.value === 'lt_3',
    detail_ar: 'هدف مستعجل مع وقت أسبوعي أقل من 3 ساعات — التوقعات الزمنية تحتاج ضبطا.',
  },
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
