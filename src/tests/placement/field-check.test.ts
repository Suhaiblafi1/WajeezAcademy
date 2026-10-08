/* فحوصُ المهارة في المجالات — البنكُ والسلّمُ والسطرُ المقيس.

   قراراتُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦): فحوصٌ قصيرةٌ اختياريّةٌ من صفحة النتيجة، في أربعة
   مجالات، و«تُفتح فورا وتُراجَع بعدُ». فيُحرس هنا:
     ١) البنكُ سليمُ البنية: أربعةُ مجالات × ثلاثةُ مستويات × أربعةُ أسئلة، وأربعةُ خياراتٍ
        بلا تكرار، والجوابُ الصحيحُ موزّعٌ في كلّ مجال — لا «الأوّلُ دائما».
     ٢) لكلّ فحصٍ احتياجٌ قائمٌ في التشخيص يُسأل فيه عن المستوى — وإلّا فلا سطرَ يقود إليه.
     ٣) السلّمُ: أعلى ما اجتيز وكلُّ ما دونه مجتاز، ومن لم يجتز الأساسيَّ «مبتدئ».
     ٤) النتيجةُ خيارٌ من سؤال المستوى: رابطُ التحديث يعيد الخيارَ المقابل بنصّه.
     ٥) والسطرُ يقول «فحص المهارة» حين طابق المقيسُ مستوى الخطّة في الاحتياج نفسِه وحدَه.

   ⚠ أُثبت سقوطُه: (أ) حُسب المستوى أعلى ما اجتيز بلا شرط ما دونه فسقط ٣،
   (ب) عُلِّم السطرُ مقيسا لأيّ احتياجٍ له قياسٌ فسقط ٥ — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import bank from '../../data/placement/field-checks.draft.v1.json'
import {
  CHECK_LEVELS,
  FIELD_CHECKS,
  fieldBankIsOpen,
  fieldCheckOfNeed,
  scoreFieldCheck,
  type FieldItem,
} from '../../domain/placement/field-check'
import { needByCode, Q } from '../../domain/diagnostic/v2_1/maps'
import { FIELD_LEVELS, fieldLevelAsks } from '../../domain/diagnostic/v2_1/focus'
import { levelLabelOf, levelLineText, levelSummaryOf, parseReviseRequest } from '../../application/diagnostic/level-summary'
import { applyFieldLevelHref } from '../../application/placement/links'

const items = (bank as { items: FieldItem[] }).items
const query = (href: string) => new URLSearchParams(href.split('?')[1] ?? '')

describe('١) البنك', () => {
  it('أربعةُ أسئلةٍ لكلّ مستوى في كلّ مجال، وأربعةُ خياراتٍ مختلفة، والمعرّفاتُ فريدة', () => {
    for (const c of FIELD_CHECKS) {
      for (const l of CHECK_LEVELS) {
        expect(items.filter((i) => i.subject === c.subject && i.level === l), `${c.subject}/${l}`).toHaveLength(4)
      }
      expect(fieldBankIsOpen(items.filter((i) => i.subject === c.subject))).toBe(true)
    }
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    for (const i of items) {
      expect(new Set(i.options).size, i.id).toBe(4)
      expect(i.answer_index).toBeGreaterThanOrEqual(0)
      expect(i.answer_index).toBeLessThan(4)
    }
  })

  it('والجوابُ الصحيحُ موزّعٌ على المواضع في كلّ مجال', () => {
    for (const c of FIELD_CHECKS) {
      const mine = items.filter((i) => i.subject === c.subject)
      for (const k of [0, 1, 2, 3]) expect(mine.filter((i) => i.answer_index === k).length, `${c.subject}@${k}`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('٢) لكلّ فحصٍ احتياجٌ يُسأل فيه عن المستوى', () => {
  it('الاحتياجُ قائم، والمستوى يُسأل فيه، والربطُ يُقرأ في الاتّجاهين', () => {
    for (const c of FIELD_CHECKS) {
      expect(needByCode(c.need), c.need).toBeTruthy()
      expect(fieldLevelAsks({ need_id: { value: c.need } } as never), c.need).toBe(true)
      expect(fieldCheckOfNeed(c.need)?.subject).toBe(c.subject)
    }
    expect(fieldCheckOfNeed('need_finance')).toBeNull()
  })
})

describe('٣) السلّم', () => {
  const data = items.filter((i) => i.subject === 'data')
  const answersFor = (pass: Record<string, number>) => {
    const out: Record<string, number> = {}
    for (const l of CHECK_LEVELS) {
      data.filter((i) => i.level === l).forEach((i, k) => {
        out[i.id] = k < (pass[l] ?? 0) ? i.answer_index : (i.answer_index + 1) % 4
      })
    }
    return out
  }

  it('ثلاثةٌ من أربعةٍ تجتاز المستوى، والمستوى أعلى ما اجتيز وكلُّ ما دونه مجتاز', () => {
    expect(scoreFieldCheck(data, answersFor({ basics: 4, independent: 3, lead: 1 })).level).toBe('independent')
    expect(scoreFieldCheck(data, answersFor({ basics: 4, independent: 4, lead: 4 })).level).toBe('lead')
    expect(scoreFieldCheck(data, answersFor({ basics: 2 })).level).toBe('none')
  })

  it('والقفزةُ صدفة: من أخفق في الأساسيّ لا يُحسب متقدّما', () => {
    expect(scoreFieldCheck(data, answersFor({ basics: 1, independent: 4, lead: 4 })).level).toBe('none')
  })
})

describe('٤) النتيجةُ خيارٌ من سؤال المستوى', () => {
  it('لكلّ مستوى: طلبُ تعديلٍ لسؤال المستوى في المجال بنصّ خياره هو', () => {
    for (const l of FIELD_LEVELS) {
      const req = parseReviseRequest(query(applyFieldLevelHref(l.code)))
      expect(req?.questionId).toBe(Q.FIELD_LEVEL)
      expect(levelLabelOf(req!.questionId, req!.optionId), l.code).toBe(l.label_ar)
    }
  })
})

describe('٥) السطرُ المقيس', () => {
  const facts = { need_id: { value: 'need_data' }, field_level: { value: 'basics' } }

  it('طابق المقيسُ مستوى الخطّة في الاحتياج نفسِه: «بناءً على فحص المهارة»', () => {
    const s = levelSummaryOf(facts, null, { need_data: 'basics' })!
    expect(s.measured).toBe(true)
    expect(s.need_id).toBe('need_data')
    expect(levelLineText(s).why_ar).toBe('بناءً على فحص المهارة المجانيّ')
  })

  it('وخالفه، أو قيس احتياجٌ آخر: السطرُ على جوابه', () => {
    for (const m of [{ need_data: 'lead' }, { need_cyber: 'basics' }, {}] as Record<string, string>[]) {
      const s = levelSummaryOf(facts, null, m)!
      expect(s.measured, JSON.stringify(m)).toBeUndefined()
      expect(levelLineText(s).why_ar).toContain(FIELD_LEVELS[1].label_ar)
    }
  })
})
