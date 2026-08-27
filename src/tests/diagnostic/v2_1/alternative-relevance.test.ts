/* البديل يُنتقى بالصلة لا بالملاءمة الخام.
   الحادثة التي أنتجت هذا الاختبار: مؤسس حاجته «التواصل والتأثير» عُرض عليه
   قالب «مدير أمن سيبراني» (ملاءمة 0.847) بديلا، بينما PW-NEG-001 «التفاوض
   والتأثير» (0.822) أقرب إليه. القالب يمرّ البوابة لأنه يشمل
   communication_influence، لكن نصفه cyber_risk لم يطلبه المتعلم قط. */

import { describe, it, expect } from 'vitest'
import { createEngineV21 } from '../../../domain/diagnostic/v2_1'
import type { Answer } from '../../../domain/diagnostic/types'

function run(sessionId: string, script: Record<string, string>) {
  const e = createEngineV21(sessionId)
  for (let i = 0; i < 25; i++) {
    const n = e.nextQuestion()
    if (!n.question) break
    const q = n.question
    const want = script[q.question_id]
    let v: Answer['value']
    if (want !== undefined) {
      const k = q.options_ar.indexOf(want)
      /* عنوان غير موجود يعني أن النصّ بالٍ — نفشل بصوت لا نسقط لأول خيار بصمت */
      expect(k, `«${want}» ليس خيارا في ${q.question_id}`).toBeGreaterThanOrEqual(0)
      v = q.options_ar[k]
    } else v = q.options_ar.length ? q.options_ar[0] : 'لا ينطبق'
    e.answer({ questionId: q.question_id, value: v })
  }
  return e.recommend() as unknown as {
    primaryPathway: { pathwayId: string } | null
    alternatives: { pathwayId: string }[]
  }
}

const FOUNDER = {
  'QC-S1-001': 'مؤسس / صاحب عمل',
  'QC-S1-002': 'لدي مشروعي الخاص',
  'QC-N3-001': 'التواصل والعرض والتأثير',
  'QB-M2-005': 'متوسط',
  'QB-M2-015': 'حاسمة',
}

describe('انتقاء البديل — بالصلة لا بالملاءمة الخام', () => {
  it('مؤسس حاجته التواصل: لا يُعرض عليه قالب أمن سيبراني ولو فاق ملاءمةً', () => {
    const rec = run('alt-founder', FOUNDER)
    expect(rec.primaryPathway?.pathwayId).toBe('PW-COM-001')
    const alt = rec.alternatives[0]?.pathwayId
    expect(alt).toBeDefined()
    expect(alt).not.toBe('TPL-CYBER-MANAGER-001')
    expect(alt).toBe('PW-NEG-001')
  })

  it('البديل ليس الفائز نفسه، وواحد لا أكثر', () => {
    const rec = run('alt-count', FOUNDER)
    expect(rec.alternatives.length).toBeLessThanOrEqual(1)
    if (rec.alternatives[0]) expect(rec.alternatives[0].pathwayId).not.toBe(rec.primaryPathway?.pathwayId)
  })

  it('حتمي: نفس الإجابات تعطي نفس البديل', () => {
    expect(run('alt-d1', FOUNDER).alternatives[0]?.pathwayId).toBe(run('alt-d2', FOUNDER).alternatives[0]?.pathwayId)
  })
})
