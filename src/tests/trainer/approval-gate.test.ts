/* ═══ مرحلةُ الاعتماد كانت تحجب نفسَها بنفسها ═══

   شكا صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «المرحلةُ الأخيرة لا تعمل، علما أنّي
   أنهيتُ كلَّ شيءٍ مطلوب، ولكنّ خيارَ الإرسال للاعتماد غير مفعّل».

   والعلّةُ في `buildChecklist`: صفُّ `approval` **إلزاميٌّ** (`optional:
   false`) و`done` فيه لا يصير صحيحا إلّا حين تصير الخطّةُ `approved` أو
   `published` — أي **بعد** الإرسال. ثمّ تحسب الشاشةُ `remaining` من
   الإلزاميّات كلِّها وتُطفئ الزرَّ على `remaining > 0`.

   فالمرحلةُ تعدّ نفسَها شرطا لنفسها: لا تتمّ حتّى تُرسَل، ولا تُرسَل حتّى
   تتمّ. و`remaining` لا يبلغ الصفرَ أبدا قبل الإرسال — فالزرُّ مطفأٌ **لكلّ
   مدرّبٍ في كلّ شعبة**، لا في شعبة الشاكي وحدَها. وهو ما يفسّر أنّ البلاغَ
   قال «بقي 1 من المراحل» والحلقاتُ الخمسُ كلُّها خضراء: الواحدُ الباقي هو
   الاعتمادُ نفسُه.

   والقاعدةُ تسكن موضعا واحدا (`plan-gate.ts`) يقرؤه الخادمُ والشاشةُ معا،
   وإلّا افترق زرٌّ مطفأٌ عن خادمٍ يقبل — أو عكسُه. */
import { describe, expect, it } from 'vitest'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import { blockingBeforeSubmit, readyToSubmit } from '@/application/trainer/plan-gate'
import { MIN_MODULE_BODY } from '@/application/trainer/plan-overlay'

const body = 'ن'.repeat(MIN_MODULE_BODY)

/** شعبةٌ أتمّ صاحبُها كلَّ ما يُطلب منه — ولم تُعتمَد بعد */
const complete = (over: Partial<Parameters<typeof buildChecklist>[0]> = {}) => buildChecklist({
  cohort: { title: 'الدفعة الأولى', termId: 'T-winter' },
  content: {
    kind: 'trainer',
    modules: [{ moduleId: 'M0', titleAr: 'محور', bodyAr: body }],
    resources: [{ title: 'كرّاسة', url: 'https://x.test/a' }],
  } as never,
  sessions: [{ recordings: [] }],
  assessmentsCount: 1,
  planStatus: 'draft',
  ...over,
})

describe('بوّابةُ الإرسال للاعتماد', () => {
  it('⚠️ الاعتمادُ لا يُعَدُّ شرطا لنفسه — وكان يُعَدّ فيطفئ الزرَّ أبدا', () => {
    const list = complete()
    const approval = list.find((c) => c.key === 'approval')!

    /* الصفُّ باقٍ ولم يُحذف: المرحلةُ تُعرض على الخطّ وتستقرّ «تمّ» بالاعتماد */
    expect(approval, 'صفُّ الاعتماد اختفى من القائمة').toBeTruthy()
    expect(approval.done, 'الاعتمادُ عُدَّ تامًّا قبل أن يُعتمَد').toBe(false)

    /* وهذا هو العطب بعينه: باقٍ واحدٌ هو الاعتمادُ نفسُه */
    expect(blockingBeforeSubmit(list), 'الاعتمادُ يحجب نفسَه').toEqual([])
    expect(readyToSubmit(list), 'شعبةٌ تامّةٌ ما زالت محجوبةً عن الإرسال').toBe(true)
  })

  it('وما نقص قبلَه يحجب فعلا — فالبوّابةُ لم تُفتح على مصراعيها', () => {
    const noModules = complete({ content: { kind: 'trainer', modules: [], resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never })
    expect(readyToSubmit(noModules), 'مرّت شعبةٌ بلا محاور').toBe(false)
    expect(blockingBeforeSubmit(noModules).map((c) => c.key)).toContain('modules')

    const noResources = complete({ content: { kind: 'trainer', modules: [{ moduleId: 'M0', titleAr: 'م', bodyAr: body }], resources: [] } as never })
    expect(readyToSubmit(noResources), 'مرّت شعبةٌ بلا مصادر').toBe(false)

    const noSessions = complete({ sessions: [] })
    expect(readyToSubmit(noSessions), 'مرّت شعبةٌ بلا لقاءات').toBe(false)
  })

  it('والاختياريُّ لا يحجب — التسجيلاتُ والمهامُّ تُؤلَّف أثناء الشعبة', () => {
    const noTasks = complete({ assessmentsCount: 0 })
    expect(readyToSubmit(noTasks), 'المهامُّ الاختياريّةُ حجبت الإرسال').toBe(true)
  })

  it('والمعتمَدةُ لا يُعاد إرسالُها من البوّابة نفسِها', () => {
    const approved = complete({ planStatus: 'approved' })
    expect(approved.find((c) => c.key === 'approval')!.done, 'المعتمَدةُ لم تستقرّ «تمّ»').toBe(true)
  })
})
