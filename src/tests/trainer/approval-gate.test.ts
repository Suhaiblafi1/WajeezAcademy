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
import { blockingBeforeSubmit, readyToSubmit, trainerOwned } from '@/application/trainer/plan-gate'
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

  /* ═══ نُقض بقرارٍ لا بتنازل: المهامُّ صارت تحجب (ق٨ · ١٧ سبتمبر ٢٠٢٦) ═══

     كان هنا: «التسجيلاتُ والمهامُّ تُؤلَّف أثناء الشعبة» فلا تحجبان. وقرارُ
     صاحب المنصّة أن تحجب المهامُّ: «كلُّ وحدةٍ تنتهي بمُخرَجٍ يقرؤه إنسانٌ
     مقابلَ مسطرةٍ مكتوبة»، و«لا تكون المحاضرةُ إلزاميّةً والمُخرَجُ
     اختياريّا». فشعبةٌ تُعتمَد بلا مهمّةٍ واحدةٍ تبيع حضورا لا حُكما.

     والتسجيلاتُ باقيةٌ اختياريّةً: تُنتَج **بعد** اللقاء، فاشتراطُها قبل
     الاعتماد يحبس الشعبةَ على شيءٍ لم يحن وقتُه. */
  it('⚠️ والمهامُّ تحجب — مهمّةٌ واحدةٌ على الأقلّ', () => {
    const noTasks = complete({ assessmentsCount: 0 })
    expect(readyToSubmit(noTasks), 'مرّت شعبةٌ بلا مهمّةٍ واحدة').toBe(false)
    expect(blockingBeforeSubmit(noTasks).map((c) => c.key)).toContain('assignments')
    /* وواحدةٌ تكفي — حدٌّ أدنى لا نطاق */
    expect(readyToSubmit(complete({ assessmentsCount: 1 })), 'واحدةٌ لم تكفِ').toBe(true)
  })

  it('والتسجيلاتُ لا تحجب — تُنتَج بعد اللقاء لا قبل الاعتماد', () => {
    const noRecordings = complete({ sessions: [{ recordings: [] }] })
    expect(blockingBeforeSubmit(noRecordings).map((c) => c.key), 'التسجيلاتُ حجبت الإرسال')
      .not.toContain('recordings')
  })

  it('والمعتمَدةُ لا يُعاد إرسالُها من البوّابة نفسِها', () => {
    const approved = complete({ planStatus: 'approved' })
    expect(approved.find((c) => c.key === 'approval')!.done, 'المعتمَدةُ لم تستقرّ «تمّ»').toBe(true)
  })
})

/* ═══ وما يحجب ليس بالضرورة ما يُعدُّ عليه ═══

   صفّانِ ليسا من عمل المدرّب: `approval` بيدِ المديرِ الأكاديميّ، و`term`
   تسمّيه الإدارةُ عند الإسناد (١٧ سبتمبر ٢٠٢٦). وخلطُهما بعمله أوقع عطبين
   من جنسٍ واحد:

     ① يحجبان الإرسالَ فيبقى الزرُّ مطفأً — وهو صوابٌ في الفصل (لا خطّةَ
       تُرفع بلا حدود) وخطأٌ في الاعتماد (يحجب نفسَه)، وقد فُصل ذاك.
     ② ويُعدّان في «أنجزتَ كذا من كذا» فلا يبلغ خطُّه التمامَ أبدا مهما
       أتمّ — وهو ما يقيسه هذا الوصف.

   والعدُّ قاعدةٌ في موضعٍ واحد (`trainerOwned`) يقرؤها خطُّ الشاشة وبطاقةُ
   «شعبي» معا؛ ولو حُسبت في كلٍّ بيدٍ لافترق الرقمان. */
describe('عدُّ التقدّم: ما بيدِ المدرّب وحدَه', () => {
  it('⚠️ شعبةٌ لم تُسمَّ فصلُها: الفصلُ يحجب الإرسالَ ولا يُعدُّ على صاحبها', () => {
    const list = complete({ cohort: { title: 'الدفعة الأولى', termId: null } })

    expect(blockingBeforeSubmit(list).map((c) => c.key), 'مرّت خطّةٌ بلا فصلٍ إلى الاعتماد').toContain('term')
    expect(readyToSubmit(list), 'أُرسلت شعبةٌ بلا حدودٍ تُشتقُّ منها').toBe(false)

    /* وهذا هو المقيس: الصفُّ ليس في مقام عمله فلا يُنقص عدَدَه */
    expect(trainerOwned(list).map((c) => c.key), 'عُدَّ الفصلُ من عمل المدرّب').not.toContain('term')
    const mine = trainerOwned(list).filter((c) => !c.optional)
    expect(mine.every((c) => c.done), 'بقي على المدرّب شيءٌ وقد أتمّ كلَّ ما يملكه').toBe(true)
  })

  it('⚠️ والاعتمادُ كذلك — وكانت البطاقةُ تقول «٥ من ٦» لشعبةٍ تامّة', () => {
    const list = complete()
    expect(trainerOwned(list).map((c) => c.key), 'عُدَّ الاعتمادُ من عمل المدرّب').not.toContain('approval')
    const mine = trainerOwned(list).filter((c) => !c.optional)
    expect(mine.length, 'خلا مقامُ عمله من كلّ شيء — فالعدُّ صارَ صفرا من صفر').toBeGreaterThan(0)
    expect(mine.filter((c) => c.done).length, 'شعبةٌ تامّةٌ لم يبلغ خطُّها تمامَه').toBe(mine.length)
  })

  it('وما هو عملُه يبقى معدودا عليه — لا يُعفى ممّا يملك', () => {
    const noModules = complete({ content: { kind: 'trainer', modules: [], resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never })
    const mine = trainerOwned(noModules).filter((c) => !c.optional)
    expect(mine.map((c) => c.key), 'سقط عملُه من عدَده').toContain('modules')
    expect(mine.every((c) => c.done), 'عُدَّت شعبةٌ بلا محاورَ تامّة').toBe(false)
  })
})
