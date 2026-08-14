import { describe, expect, it } from 'vitest'
import { FOUNDER_IDEA, GOV_EMPLOYEE, NEW_MANAGER, runSession, STUDENT_LOST } from './helpers'

describe('مطابقة المدرب', () => {
  it('لا مدرب يُسند آليا أبدا — ملف المدربين فارغ موثق', () => {
    for (const script of [GOV_EMPLOYEE, NEW_MANAGER, FOUNDER_IDEA, STUDENT_LOST]) {
      const { recommendation } = runSession(script)
      expect(recommendation.trainer.status).toBe('unassigned')
    }
  })

  it('حالة عدم الإسناد تحمل ملاحظة عربية واضحة', () => {
    const { recommendation } = runSession(GOV_EMPLOYEE)
    expect(recommendation.trainer.note_ar?.length ?? 0).toBeGreaterThan(0)
  })
})
