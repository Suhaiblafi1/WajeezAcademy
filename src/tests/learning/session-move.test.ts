/* من طلب نقلَ اللقاء ولماذا — نصوصُه لكلّ قارئ (٢٨ أكتوبر ٢٠٢٦، `session-move.ts`).

   محضةٌ بلا قاعدة. وما يقع بها على قاعدةٍ حقيقيّة — من يصله وفي أيّ رسالة — في
   `server/tests/learning/session-move-reasons.test.ts`. */

import { describe, expect, it } from 'vitest'
import { MOVE_UNDONE, approvedMoveWhy, doneWhyAr, moveWhy, readMoveWhy } from '../../application/learning/session-move'
import { CLASH_REASON_PREFIX } from '../../application/terms/schedule-clash'
import { PROPOSAL_TAIL_AR } from '../../application/trainer/schedule-proposal'

describe('ما كتبه المدرّب', () => {
  it('⚠️ للمتعلّم «نقله مدرّبك، وكتب» — وللمدرّب «نقلته بطلبك» — بين علامتَي التنصيص كما كتبه', () => {
    expect(moveWhy('trainer', '  سفر طارئ ')).toEqual({
      learnerAr: 'نقله مدرّبك، وكتب: «سفر طارئ».',
      trainerAr: 'نقلته بطلبك، وكتبت لطلابك: «سفر طارئ».',
    })
  })

  it('ونقطتُه في آخره لا تلي نقطةً بعد علامة التنصيص', () => {
    expect(moveWhy('trainer', 'سفر طارئ.').learnerAr).toBe('نقله مدرّبك، وكتب: «سفر طارئ».')
    expect(moveWhy('trainer', 'سفر طارئ،').trainerAr).toBe('نقلته بطلبك، وكتبت لطلابك: «سفر طارئ».')
  })
})

describe('ما كتبته الإدارة', () => {
  it('⚠️ للمتعلّم «نقلته إدارة الأكاديمية» — وللمدرّب أقبلها أم نقلتها الإدارةُ بنفسها', () => {
    expect(moveWhy('accepted', 'يوافق عطلة رسمية')).toEqual({
      learnerAr: 'نقلته إدارة الأكاديمية: يوافق عطلة رسمية.',
      trainerAr: 'نقل بطلب الإدارة وقبلته: يوافق عطلة رسمية.',
    })
    expect(moveWhy('staff', 'نجمع شعب المسار في فصل واحد.').trainerAr).toBe('نقلته الإدارة: نجمع شعب المسار في فصل واحد.')
  })

  it('⚠️ وسببُ البطاقة كما يُقرأ بعد أن وقع — بلا «نقترح» وذيلِها، والتعارضُ «كان»', () => {
    const why = `${CLASH_REASON_PREFIX} مع «تحليل البيانات» وهي من المسار نفسه`
    const reason = `${why}${PROPOSAL_TAIL_AR}الأحد 19:00 كلّ أسبوع: ينتقل لقاءان من 4.`
    expect(doneWhyAr(reason)).toBe('كان موعدها يتعارض مع «تحليل البيانات» وهي من المسار نفسه')
    expect(moveWhy('accepted', reason).learnerAr).toBe('نقلته إدارة الأكاديمية: كان موعدها يتعارض مع «تحليل البيانات» وهي من المسار نفسه.')
    /* وما لا ذيلَ له ولا تعارضَ فيه يبقى كما كُتب */
    expect(doneWhyAr('من لقاءاتك اليوم ما يقع في عطلة رسميّة')).toBe('من لقاءاتك اليوم ما يقع في عطلة رسميّة')
  })

  it('والجدولُ الذي سقط نصفُه فعاد — لا يُنسب نقلُه إلى أحد', () => {
    expect(MOVE_UNDONE.learnerAr).not.toMatch(/مدرّبك|الإدارة/)
    expect(MOVE_UNDONE.learnerAr).toContain('عاد هذا اللقاء إلى موعده')
  })
})

describe('ونقلٌ عاد ينتظر الإدارة ثمّ اعتمدته (٣١ أكتوبر ٢٠٢٦)', () => {
  it('⚠️ سببُه كما كُتب ومعه أنّه اعتُمد — لكلٍّ بلغته', () => {
    expect(approvedMoveWhy(moveWhy('trainer', 'سفر طارئ'))).toEqual({
      learnerAr: 'نقله مدرّبك، وكتب: «سفر طارئ». واعتمدته الإدارة.',
      trainerAr: 'نقلته بطلبك، وكتبت لطلابك: «سفر طارئ». واعتمدته الإدارة.',
    })
  })

  it('⚠️ وما حُفظ على اللقاء يُقرأ — وما لا يُقرأ لا يُختلَق', () => {
    const why = moveWhy('trainer', 'سفر طارئ')
    expect(readMoveWhy(JSON.parse(JSON.stringify(why)))).toEqual(why)
    for (const bad of [null, undefined, 'نص', { learnerAr: 'وحده' }, { learnerAr: '', trainerAr: 'x' }, { learnerAr: 1, trainerAr: 2 }]) {
      expect(readMoveWhy(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})
