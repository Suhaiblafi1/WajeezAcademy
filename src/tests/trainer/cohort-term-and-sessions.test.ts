/* ═══ الفصلُ يحكم الشعبة، واللقاءاتُ تُقاس بالمحاور ═══

   قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦):

   ① «يجب أن يكون هنا تحديدُ الفصل أوّلا، ويتمّ تقييدُ المدرّب بتحديد الأوقات
      ضمنَ أشهر الفصل نفسِه. اشطب كلَّ شيءٍ بالخانة الأولى واترك فقط تغييرَ
      اسم الدورة والنبذةَ عنها — والباقي لا داعيَ له، لأنّ الدورةَ ستكون
      متاحةً للطلاب طيلةَ فصل الشتاء».

      فمرحلةُ الهُويّة تتمّ باسمٍ وفصل. وكانت تشترط بدءا وأيّامَ أسبوعٍ
      وساعةً — حقولا شُطبت من الشاشة. وشرطٌ على حقلٍ لا بابَ إليه يحبس
      المدرّبَ خارجَ الاعتماد بلا أن يقول لماذا.

   ② «عددُ الجلسات يجب أن يكون بحدٍّ أدنى لا يقلّ عن عدد المحاور للجلسة،
      ويحقّ له الزيادةُ كما يشاء موزّعةً على الفصل كاملا».

      وكان الشرطُ «لقاءٌ واحدٌ فأكثر»: ثمانيةُ محاورَ تمرّ بلقاءٍ واحد. */
import { describe, expect, it } from 'vitest'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import { MIN_MODULE_BODY } from '@/application/trainer/plan-overlay'

const body = 'ن'.repeat(MIN_MODULE_BODY)
const mods = (n: number) => Array.from({ length: n }, (_, i) => ({ moduleId: `M${i}`, titleAr: `محور ${i}`, bodyAr: body }))
const sessions = (n: number) => Array.from({ length: n }, () => ({ recordings: [] as unknown[] }))

const build = (over: Partial<Parameters<typeof buildChecklist>[0]> = {}) => buildChecklist({
  cohort: { title: 'الدفعة الأولى', termId: 'T-winter' },
  content: { kind: 'trainer', modules: mods(1), resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never,
  sessions: sessions(1),
  assessmentsCount: 0,
  planStatus: 'draft',
  ...over,
})
const item = (key: string, over?: Partial<Parameters<typeof buildChecklist>[0]>) =>
  build(over).find((c) => c.key === key)!

describe('① الهُويّة: اسمٌ وفصل — لا مواعيدُ تُكتب بيد', () => {
  it('⚠️ بلا فصلٍ لا تتمّ المرحلة', () => {
    expect(item('identity', { cohort: { title: 'الدفعة الأولى', termId: null } }).done,
      'مرّت شعبةٌ بلا فصل').toBe(false)
  })

  it('وباسمٍ وفصلٍ تتمّ — بلا أيّامِ أسبوعٍ ولا ساعةِ بدء', () => {
    /* الحقولُ المشطوبةُ ليست في التوقيع أصلا، فلو عادت شرطا لسقط هذا */
    expect(item('identity').done, 'اسمٌ وفصلٌ لم يكفيا').toBe(true)
  })

  it('والاسمُ القصيرُ لا يمرّ — «شعبة» لا تصف دفعة', () => {
    expect(item('identity', { cohort: { title: 'أ', termId: 'T-winter' } }).done).toBe(false)
  })
})

describe('② اللقاءات: لقاءٌ لكلّ محورٍ على الأقلّ', () => {
  it('⚠️ لقاءٌ واحدٌ لثلاثة محاورَ لا يكفي — وكان يكفي', () => {
    const three = { content: { kind: 'trainer', modules: mods(3), resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never }
    expect(item('sessions', { ...three, sessions: sessions(1) }).done, 'محورانِ بلا لقاء').toBe(false)
    expect(item('sessions', { ...three, sessions: sessions(2) }).done, 'محورٌ بلا لقاء').toBe(false)
    expect(item('sessions', { ...three, sessions: sessions(3) }).done, 'رُفض ما بلغ العددَ تماما').toBe(true)
  })

  it('والزيادةُ حقُّه — لا سقفَ من هذه القاعدة', () => {
    const two = { content: { kind: 'trainer', modules: mods(2), resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never }
    expect(item('sessions', { ...two, sessions: sessions(9) }).done, 'عوقب على الزيادة').toBe(true)
  })

  it('وبلا لقاءٍ أصلا لا تتمّ، ولو خلت الخطّةُ من المحاور', () => {
    const none = { content: { kind: 'trainer', modules: [], resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never }
    expect(item('sessions', { ...none, sessions: [] }).done, 'مرّت شعبةٌ بلا لقاءٍ واحد').toBe(false)
  })

  it('والعددُ المطلوبُ مكتوبٌ في السطر — لا يُترك يحزره', () => {
    const three = { content: { kind: 'trainer', modules: mods(3), resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never }
    expect(item('sessions', { ...three, sessions: sessions(1) }).labelAr).toContain('1/3')
  })
})
