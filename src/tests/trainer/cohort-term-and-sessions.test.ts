/* ═══ الفصلُ يحكم الشعبة، واللقاءاتُ تُقاس بالمحاور ═══

   قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦):

   ① «يجب أن يكون هنا تحديدُ الفصل أوّلا، ويتمّ تقييدُ المدرّب بتحديد الأوقات
      ضمنَ أشهر الفصل نفسِه. اشطب كلَّ شيءٍ بالخانة الأولى واترك فقط تغييرَ
      اسم الدورة والنبذةَ عنها — والباقي لا داعيَ له، لأنّ الدورةَ ستكون
      متاحةً للطلاب طيلةَ فصل الشتاء».

      فمرحلةُ الهُويّة تتمّ باسمٍ وفصل. وكانت تشترط بدءا وأيّامَ أسبوعٍ
      وساعةً — حقولا شُطبت من الشاشة. وشرطٌ على حقلٍ لا بابَ إليه يحبس
      المدرّبَ خارجَ الاعتماد بلا أن يقول لماذا.

      ── ثمّ صحّح (١٧ سبتمبر ٢٠٢٦) قراءةَ «تحديد الفصل» ──

      «القصدُ كان لدينا في الإدارة نكون قد اعتمدنا الدورةَ في فصلٍ معيّن»،
      «وعندما نقوم بإسناد دورةٍ لمدرّب نحدّد لأيّ فصلٍ ستكون». فالفصلُ ليس
      خانةً في نموذجه: هو حقيقةٌ إداريّةٌ سابقةٌ عليه.

      وكان بقاؤه شرطا في صفّ «سمِّ الشعبة» يكتب «لم يتمّ» على عملٍ أتمّه:
      كتب الاسمَ فبقي الصفُّ أحمرَ، ولا بابَ في يده يفتحه — والشرطُ نفسُه
      الذي أُزيل عن حقلٍ لا بابَ إليه عاد في صورةٍ أخرى. فصار للفصل صفٌّ
      يسمّي فاعلَه، ورجعت الهُويّةُ إلى ما يملكه: اسمُها.

   ② «عددُ الجلسات يجب أن يكون بحدٍّ أدنى لا يقلّ عن عدد المحاور للجلسة،
      ويحقّ له الزيادةُ كما يشاء موزّعةً على الفصل كاملا».

      وكان الشرطُ «لقاءٌ واحدٌ فأكثر»: ثمانيةُ محاورَ تمرّ بلقاءٍ واحد.

   ── ثمّ انقلب ① (٢٧ سبتمبر ٢٠٢٦) ──

   صارت مدّةُ الشعبة للمدرّب يحدّدها في خطوتها الأولى، ولقاءاتُه داخلها،
   والفصلُ يُشتقّ من تاريخ البدء عند الاعتماد. فالهُويّةُ اسمٌ ومدّة، ولا صفَّ
   للفصل — والشرحُ عند وصف ① أدناه. و② باقٍ، وزاد عليه: اللقاءُ داخلَ المدّة. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import { MIN_MODULE_BODY } from '@/application/trainer/plan-overlay'

const body = 'ن'.repeat(MIN_MODULE_BODY)
const mods = (n: number) => Array.from({ length: n }, (_, i) => ({ moduleId: `M${i}`, titleAr: `محور ${i}`, bodyAr: body }))
/* مدّةُ الشعبة كما يحدّدها مدرّبُها (٢٧ سبتمبر ٢٠٢٦) — واللقاءاتُ في وسطها */
const PERIOD = { startsOn: '2027-02-07', endsOn: '2027-03-14' }
const inside = (i: number) => new Date(Date.UTC(2027, 1, 9 + i, 15))
const sessions = (n: number) => Array.from({ length: n }, (_, i) => ({ startsAt: inside(i), recordings: [] as unknown[] }))

const build = (over: Partial<Parameters<typeof buildChecklist>[0]> = {}) => buildChecklist({
  cohort: { title: 'الدفعة الأولى' },
  period: PERIOD,
  content: { kind: 'trainer', modules: mods(1), resources: [{ title: 'ك', url: 'https://x.test/a' }] } as never,
  sessions: sessions(1),
  assessmentsCount: 0,
  planStatus: 'draft',
  ...over,
})
const item = (key: string, over?: Partial<Parameters<typeof buildChecklist>[0]>) =>
  build(over).find((c) => c.key === key)!

/* ═══ ① ثمّ صارت المدّةُ للمدرّب (٢٧ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «في تعديل المعلومات الأساسيّة اجعله أن يعتمد متى تبدأ
   الشعبةُ ومتى تنتهي… واضحٌ له أنّ اللقاءات بيده ويجب أن تكون ضمن فترة
   الشعبة نفسها التي وضعها بنفسه».

   فانقلب ما كان هنا ولم يُحذف: كانت الهُويّةُ «اسمٌ وحدَه» والفصلُ صفٌّ
   يسمّي فاعلَه (الإدارة). وصارت الهُويّةُ **اسما ومدّةً صالحة** — والمدّةُ
   عملُه لا بابٌ مغلقٌ دونه — وسقط صفُّ الفصل: يُشتقّ من تاريخ البدء عند
   الاعتماد. والمحروسُ الأصليُّ باقٍ بنصّه: **لا يُكتب «لم يتمّ» على ما ليس
   بيده** — وما بقي في الصفّ كلُّه بيده. */
describe('① الهُويّة: اسمٌ ومدّة — ولا صفَّ للفصل', () => {
  it('⚠️ اسمٌ ومدّةٌ صالحةٌ تُتمّانها — ولا فصلَ يُنتظر', () => {
    expect(item('identity').done, 'اسمٌ ومدّةٌ لم يكفيا').toBe(true)
    expect(build().map((c) => c.key), 'عاد صفُّ الفصل بيد الإدارة').not.toContain('term')
  })

  it('⚠️ وبلا مدّةٍ لا تتمّ — فهي قرارُه الأوّل', () => {
    expect(item('identity', { period: null }).done, 'تمّت الهُويّةُ بلا مدّة').toBe(false)
  })

  it('والمدّةُ الفاسدةُ كالغائبة — نهايةٌ قبل البداية لا تُتمّ شيئا', () => {
    expect(item('identity', { period: { startsOn: '2027-03-14', endsOn: '2027-02-07' } }).done).toBe(false)
  })

  it('والاسمُ القصيرُ لا يمرّ — «شعبة» لا تصف دفعة', () => {
    expect(item('identity', { cohort: { title: 'أ' } }).done).toBe(false)
  })

  it('واسمُ الصفّ يقول ما يُطلب — الاسمَ والمدّة', () => {
    expect(item('identity').labelAr).toContain('مدّتها')
  })
})

/* ═══ ② ثمّ صار «لقاءٌ لكلّ محورٍ في موعده» (٢٧ سبتمبر ٢٠٢٦) ═══

   كان الحكمُ على العدد وحدَه: لقاءاتٌ بعدد المحاور فأكثر. وصار كلُّ لقاءٍ
   مربوطا بمحوره أو محوريه، والحكمُ على الربط: لكلّ محورٍ لقاءٌ مباشرٌ داخلَ
   موعده — «ولكلّ لقاءٍ محورٌ أو محوران».

   والعددُ باقٍ حكما لما اعتُمد قبل المواعيد: شعبةٌ جاريةٌ لا يُكتب عليها
   «لم يتمّ» لأنّ قاعدةً وُلدت بعدها. فحرّاسُه باقون تحت حالته. */
const res = [{ title: 'ك', url: 'https://x.test/a' }]
/** ثلاثةُ محاورَ في ثلاثة مواعيدَ متتابعة داخلَ المدّة — أو بما يُمرَّر */
const slotted = (n: number, groups?: string[][]) => ({
  kind: 'trainer', modules: mods(n), resources: res,
  slots: (groups ?? Array.from({ length: n }, (_, i) => [`M${i}`])).map((ids, i) => ({
    startsOn: `2027-02-${String(7 + i * 7).padStart(2, '0')}`,
    endsOn: `2027-02-${String(13 + i * 7).padStart(2, '0')}`,
    moduleIds: ids, workbook: { url: 'https://x.test/wb' },
  })),
})
/** لقاءٌ في اليوم الثاني من الموعد رقم `slot` (من صفر)، مربوطٌ بما يُمرَّر */
const meet = (slot: number, moduleIds: string[]) =>
  ({ startsAt: new Date(Date.UTC(2027, 1, 8 + slot * 7, 15)), endsAt: new Date(Date.UTC(2027, 1, 8 + slot * 7, 17)), recordings: [] as unknown[], moduleIds })

describe('② اللقاءات: لقاءٌ لكلّ محورٍ في موعده', () => {
  it('⚠️ لكلّ محورٍ لقاؤه — ولقاءٌ واحدٌ لثلاثة محاورَ لا يكفي', () => {
    const content = slotted(3) as never
    expect(item('sessions', { content, sessions: [meet(0, ['M0'])] }).done, 'محورانِ بلا لقاء').toBe(false)
    expect(item('sessions', { content, sessions: [meet(0, ['M0']), meet(1, ['M1'])] }).done, 'محورٌ بلا لقاء').toBe(false)
    expect(item('sessions', { content, sessions: [meet(0, ['M0']), meet(1, ['M1']), meet(2, ['M2'])] }).done, 'رُفض ما غطّى كلَّ محور').toBe(true)
  })

  it('⚠️ والعددُ وحدَه لا يكفي بعد اليوم — لقاءاتٌ بعدد المحاور بلا ربطٍ لا تُتمّها', () => {
    const content = slotted(3) as never
    expect(item('sessions', { content, sessions: sessions(3) }).done, 'تمّت بلقاءاتٍ لا يُعرف محورُها').toBe(false)
  })

  it('واللقاءُ لمحورين من موعدٍ مجموعٍ يغطّيهما معا', () => {
    const content = slotted(4, [['M0', 'M1'], ['M2'], ['M3']]) as never
    expect(item('sessions', { content, sessions: [meet(0, ['M0', 'M1']), meet(1, ['M2']), meet(2, ['M3'])] }).done).toBe(true)
  })

  it('⚠️ واللقاءُ خارجَ موعد محوره لا يُتمّها — وإن كان داخلَ المدّة', () => {
    const content = slotted(3) as never
    expect(item('sessions', { content, sessions: [meet(1, ['M0']), meet(1, ['M1']), meet(2, ['M2'])] }).done, 'مرّ لقاءُ المحور الأوّل في موعد الثاني').toBe(false)
  })

  it('والزيادةُ حقُّه — لا سقفَ من هذه القاعدة', () => {
    const content = slotted(2) as never
    const many = [meet(0, ['M0']), meet(0, ['M0']), meet(1, ['M1']), meet(1, ['M1']), meet(1, ['M1'])]
    expect(item('sessions', { content, sessions: many }).done, 'عوقب على الزيادة').toBe(true)
  })

  it('وبلا لقاءٍ أصلا لا تتمّ، ولو خلت الخطّةُ من المحاور', () => {
    const none = { content: { kind: 'trainer', modules: [], resources: res } as never }
    expect(item('sessions', { ...none, sessions: [] }).done, 'مرّت شعبةٌ بلا لقاءٍ واحد').toBe(false)
  })

  /* «ويجب أن تكون ضمن فترة الشعبة نفسها» (٢٧ سبتمبر ٢٠٢٦). ومن غيّر المدّةَ
     بعد أن جدول صار في يده لقاءٌ خارجَها — فتعود الخطوةُ «لم تتمّ» وتسمّي كم. */
  it('⚠️ ولقاءٌ خارجَ مدّة الشعبة لا يُعَدّ تمامًا — ويُسمّى في السطر', () => {
    const content = slotted(1) as never
    const late = { startsAt: new Date('2027-03-20T15:00:00.000Z'), recordings: [] as unknown[], moduleIds: ['M0'] }
    const row = item('sessions', { content, sessions: [meet(0, ['M0']), late] })
    expect(row.done, 'تمّت اللقاءاتُ ولقاءٌ خارجَ المدّة').toBe(false)
    expect(row.labelAr, 'السطرُ لا يقول إنّ لقاءً خرج').toContain('خارجَ مدّة الشعبة')
    expect(item('sessions', { content, sessions: [meet(0, ['M0'])] }).done, 'رُدّ لقاءٌ داخلَ المدّة').toBe(true)
  })

  it('والمغطّى من المحاور مكتوبٌ في السطر — لا يُترك يحزره', () => {
    expect(item('sessions', { content: slotted(3) as never, sessions: [meet(0, ['M0'])] }).labelAr).toContain('1/3')
  })

  it('⚠️ وما اعتُمد قبل المواعيد يُحكم بالعدد كما اعتُمد — لا يُكتب عليه «لم يتمّ»', () => {
    const three = { content: { kind: 'trainer', modules: mods(3), resources: res } as never, planStatus: 'approved' as const }
    expect(item('sessions', { ...three, sessions: sessions(2) }).done, 'محورٌ بلا لقاءٍ في المعتمَد القديم').toBe(false)
    expect(item('sessions', { ...three, sessions: sessions(3) }).done, 'رُدّ المعتمَدُ القديمُ بعد اكتماله').toBe(true)
    expect(item('sessions', { ...three, sessions: sessions(1) }).labelAr).toContain('1/3')
    /* والمسودّةُ بلا مواعيدَ لا تُعفى: صارت على القاعدة الجديدة */
    expect(item('sessions', { content: three.content, sessions: sessions(3) }).done, 'أُعفيت مسودّةٌ بلا مواعيد').toBe(false)
  })
})

/* ═══ ③ ولا بابَ للمدرّب إلى الفصل — وإن صارت المدّةُ له ═══

   المدّةُ في خطّته (٢٧ سبتمبر ٢٠٢٦)، والفصلُ يُشتقّ من تاريخ بدئها عند
   الاعتماد — لا يُسأل عنه ولا يكتبه. فالبابُ المغلقُ هنا باقٍ مغلقا.

   والقاعدةُ أعلاه تُقرأ من القائمة، والقائمةُ لا تمنع أحدا من إعادة فتح
   البابِ الذي أُغلق: مسلكٌ في مسارات المدرّب أو نداءُ كتابةٍ من شاشته
   يعيد الحلقةَ كلَّها — يختار فصلا فتتحرّك حدودُ شعبته ونافذتُها بلا
   قرارٍ إداريّ، وهو ما أُلغي.

   والفحصُ بنيويٌّ على **نداء الكتابة** لا على ورودِ كلمة: هذا الملفُّ
   نفسُه يذكر «term» في شرحه، ولو فُحص الخامُ لأسقط نفسَه. */
describe('③ بابُ المدرّب إلى الفصل مغلقٌ في الشيفرة لا في النيّة', () => {
  const PORTAL = 'server/http/routes/learning-portal.routes.ts'
  const WS = 'src/pages/trainer/CohortWorkspace.tsx'
  const code = (p: string) =>
    readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ لا مسلكَ فصلٍ في مسارات المدرّب — لا قراءةً ولا كتابة', () => {
    const portal = code(PORTAL)
    const termRoutes = [...portal.matchAll(/app\.(get|post|patch|put|delete)\(\s*'([^']+)'/g)]
      .map((m) => m[2])
      .filter((url) => /\/terms?$/.test(url))
    expect(termRoutes, 'عاد للمدرّب مسلكٌ إلى الفصل').toEqual([])
  })

  it('⚠️ ولا نداءَ كتابةٍ إلى الفصل من شاشة الشعبة', () => {
    const ws = code(WS)
    const writes = [...ws.matchAll(/api(?:Post|Put|Patch|Delete)\(\s*`([^`]+)`/g)]
      .map((m) => m[1])
      .filter((url) => /term/i.test(url))
    expect(writes, 'الشاشةُ ما زالت تكتب الفصلَ بيد المدرّب').toEqual([])
  })

  it('والإدارةُ بابُها موصولٌ فعلا — لا قاعدةٌ بلا مسلك', () => {
    const admin = code('server/http/routes/admin-learning.routes.ts')
    const urls = [...admin.matchAll(/app\.(get|post)\(\s*'([^']+)'/g)].map((m) => m[2])
    for (const u of ['/api/admin/cohorts/open-for-trainer', '/api/admin/cohorts/:id/term', '/api/admin/cohorts/without-term']) {
      expect(urls, `مسلكُ الإدارة ${u} غيرُ موصول`).toContain(u)
    }
  })
})
