/* البند ٤٠ · «مرآة وجيز» — أربعةٌ وعشرون بندا بلا تسجيل.
 *
 * ما يُحرَس هنا ثلاثةُ أشياءَ تنكسر صامتة:
 *
 *   ① **البنودُ الثمانيةَ عشرَ تُقرأ من البنك.** ولو اختفى بندٌ منها لَشرَحت
 *     المرآةُ بُعدا من بندَين وهي تقول ثلاثة — ولا شيءَ يحمرّ. فالعددُ يُفحص.
 *
 *   ② **البُعدُ متوسّطُ بنوده لا آخِرُ جواب.** كان `interestVector[key] = score`
 *     إسنادا يمحو ما قبله، فبذرُ ثمانيةَ عشرَ بندا كان سيُنتج ستّةَ أبعادٍ
 *     محسوبةٍ من ستّةِ بنود. وهذا هو الفرقُ كلُّه بين مرآةٍ تزيد الثباتَ
 *     ثلاثةَ أضعافٍ ومرآةٍ لا تزيد شيئا.
 *
 *   ③ **ما لا يُبذَر لا يُبذَر.** `application_readiness` متقاعدٌ لأنّ أثرَه
 *     المبرمَجَ عقوبة، و`completion_pattern` تقرؤه صفرُ مواضع. وبذرُهما من
 *     المرآة يُحيي عقوبةً من بابٍ خلفيّ — فالنفيُ مفحوصٌ لا موصوف. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { questionById } from '../../domain/diagnostic/catalog'
import { RIASEC_DIMS } from '../../domain/diagnostic/v2_1/maps'
import { RIASEC_ITEM_IDS, mirrorItems } from '../../domain/diagnostic/mirror/items'
import { scoreMirror } from '../../domain/diagnostic/mirror/score'
import { clarityBand, mirrorFacts, mirrorInterestVector } from '../../domain/diagnostic/mirror/bridge'

describe('٤٠ · بنودُ المرآة', () => {
  it('أربعةٌ وعشرون بندا — ثمانيةَ عشرَ من البنك وستّةٌ مؤلَّفة', () => {
    const items = mirrorItems()
    expect(items).toHaveLength(24)
    expect(items.filter((i) => i.block === 'interest')).toHaveLength(18)
    expect(items.filter((i) => i.block === 'readiness')).toHaveLength(6)
  })

  it('وثلاثةٌ لكلّ بُعدٍ موجودةٌ في البنك فعلا — ولا يُخترَع نصُّ بندٍ غائب', () => {
    for (const dim of RIASEC_DIMS) {
      const ids = RIASEC_ITEM_IDS[dim]
      expect(ids, `«${dim}» بلا ثلاثة بنود`).toHaveLength(3)
      for (const id of ids) {
        const q = questionById.get(id)
        expect(q, `${id} غائبٌ عن البنك — فالمرآةُ تعرض بُعدا ناقصا صامتةً`).toBeTruthy()
        expect(q!.measures, `${id} لم يعد يقيس «${dim}»`).toContain(dim)
        expect(q!.answer_type, `${id} ليس ليكرت — فالمسطرةُ تختلف`).toBe('likert_5')
      }
    }
  })
})

describe('٤٠ · التصحيحُ حتميٌّ ومتوسّط', () => {
  const full = () => {
    const a: Record<string, number> = {}
    for (const it of mirrorItems()) a[it.id] = 3
    return a
  }

  it('البُعدُ متوسّطُ بنوده الثلاثة — لا آخِرُها', () => {
    const a = full()
    const [i1, i2, i3] = RIASEC_ITEM_IDS.riasec_social
    a[i1] = 5
    a[i2] = 5
    a[i3] = 2
    /* آخِرُ جوابٍ ٢، والمتوسّطُ ٤ — والفرقُ هو ما يقيسه هذا التوكيد */
    expect(scoreMirror(a).dims.riasec_social).toBeCloseTo(4, 5)
  })

  it('والتعادلُ يُحسم بترتيبٍ ثابت — زائران بالإجابات نفسِها يريان الرمزَ نفسَه', () => {
    const a = full()
    expect(scoreMirror(a).code).toEqual(scoreMirror({ ...a }).code)
    expect(scoreMirror(a).code).toHaveLength(3)
  })

  it('والرمزُ أعلى ثلاثةِ أبعاد', () => {
    const a = full()
    for (const id of RIASEC_ITEM_IDS.riasec_artistic) a[id] = 5
    expect(scoreMirror(a).code[0]).toBe('riasec_artistic')
  })
})

describe('٤٠ · ما يُبذَر وما لا يُبذَر', () => {
  const answers = () => {
    const a: Record<string, number> = {}
    for (const it of mirrorItems()) a[it.id] = 5
    return a
  }

  it('«وضوحُ الهدف» يُبذَر بمصدره وبدليلٍ أضعفَ من إجابةِ تشخيص', () => {
    const facts = mirrorFacts(scoreMirror(answers()))
    expect(facts['goal_clarity']?.value).toBe('high')
    expect(facts['goal_clarity']?.sourceQuestionId).toBe('MIRROR-goal-clarity')
    expect(facts['goal_clarity']?.evidenceQuality).toBeLessThan(0.9)
  })

  it('و«الاستعدادُ للتطبيق» و«الاستمرار» يُعرضان ولا يُبذَران', () => {
    const facts = mirrorFacts(scoreMirror(answers()))
    expect(
      facts['application_readiness'],
      'بُذر متقاعدٌ أثرُه المبرمَجُ عقوبة — عادت العقوبةُ من بابٍ خلفيّ',
    ).toBeUndefined()
    expect(facts['completion_pattern'], 'بُذرت حقيقةٌ تقرؤها صفرُ مواضع').toBeUndefined()
    /* ويبقيان معروضَين للمتعلّم — وإلّا فقد سُئل عنهما بلا مقابل */
    expect(scoreMirror(answers()).readiness.application_readiness).toBe(5)
    expect(scoreMirror(answers()).readiness.completion_pattern).toBe(5)
  })

  it('وحدُّ الميل ثلاثةٌ — والحيادُ ليس ميلا', () => {
    const a = answers()
    for (const id of RIASEC_ITEM_IDS.riasec_realistic) a[id] = 1
    const v = mirrorInterestVector(scoreMirror(a))
    expect(v['riasec_realistic']).toBeUndefined()
    expect(v['riasec_social']).toBe(5)
  })

  it('وحدودُ «وضوح الهدف» هي حدودُ السؤال الذي يقابله', () => {
    expect(clarityBand(5)).toBe('high')
    expect(clarityBand(3.5)).toBe('medium')
    expect(clarityBand(2)).toBe('low')
    expect(clarityBand(null)).toBeNull()
  })
})

describe('٤٠ · لوحُ «ما لا يقوله» شرطُ نشرٍ لا زينة', () => {
  const page = readFileSync('src/pages/Mirror.tsx', 'utf8')

  it('اللوحُ موجودٌ ويقول الثلاثةَ صراحة', () => {
    expect(page).toContain('ما لا يقوله هذا الاختبار')
    expect(page, 'لم يُقل إنّه يقيس الميلَ لا القدرة').toContain('لا ما تتقنه')
    expect(page, 'لم يُقل إنّ الميلَ يرجّح ولا يحسم').toContain('يرجّح ولا يحسم')
    expect(page, 'لم يُقل أيُّ المقاييس يصل إلى التشخيص').toContain('وضوحُ الهدف وحدَه')
  })

  it('وللمرآة بابٌ يصلها — صفحةٌ بلا رابطٍ صفحةٌ لا وجودَ لها', () => {
    const diag = readFileSync('src/pages/Diagnostic.tsx', 'utf8')
    expect(diag, 'لا رابطَ إلى المرآة من شاشة البدء').toMatch(/to="\/mirror"/)
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app, 'المسارُ غيرُ مسجَّل').toMatch(/path="\/mirror"/)
  })

  it('ولا يُطلب بريدٌ ولا حساب', () => {
    expect(page).toContain('بلا بريدٍ ولا حساب')
    expect(page, 'ظهر حقلُ بريدٍ في اختبارٍ يُنشر بلا تسجيل').not.toMatch(/type="email"/)
  })
})

describe('٤٠ · والمحرّكُ يقرأ البنودَ الثلاثةَ كلَّها', () => {
  it('متّجهُ الميول متوسّطٌ جارٍ — لا آخِرُ جوابٍ يمحو ما قبله', async () => {
    const { reduceAnswer } = await import('../../domain/diagnostic/facts')
    const vector: Record<string, number> = {}
    const facts = {}
    const raw: Record<string, string> = {}
    const skills: Record<string, number> = {}
    const ids = RIASEC_ITEM_IDS.riasec_social
    const scores = [5, 5, 2]
    ids.forEach((id, i) => {
      const q = questionById.get(id)!
      reduceAnswer(
        q,
        { questionId: id, value: q.options_ar[scores[i] - 1], optionIds: [q.active_option_ids?.[scores[i] - 1] ?? `o${scores[i]}`] },
        facts, raw, skills, vector,
      )
    })
    /* ٥ و٥ و٢ → المتوسّطُ ٤، وآخِرُ جوابٍ ٢ */
    expect(vector['riasec_social'], 'عاد الإسنادُ يمحو ما قبله').toBeCloseTo(4, 5)
  })
})
