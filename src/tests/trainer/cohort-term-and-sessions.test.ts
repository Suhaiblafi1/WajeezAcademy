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

      وكان الشرطُ «لقاءٌ واحدٌ فأكثر»: ثمانيةُ محاورَ تمرّ بلقاءٍ واحد. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('① الهُويّة: اسمٌ وحدَه — والفصلُ صفٌّ باسم فاعله', () => {
  const termless = { cohort: { title: 'الدفعة الأولى', termId: null } }

  it('⚠️ شعبةٌ لم تُسمَّ فصلُها: الهُويّةُ تتمّ باسمها — ولا يُكتب «لم يتمّ» على عملٍ أتمّه', () => {
    expect(item('identity', termless).done, 'حُوسب المدرّبُ على بابٍ ليس في يده').toBe(true)
  })

  it('⚠️ والفصلُ صفٌّ قائمٌ بذاته، يتبع تسميةَ الإدارة لا شيئا سواها', () => {
    const row = item('term', termless)
    expect(row, 'لا صفَّ للفصل أصلا — فلا يعرف المدرّبُ لماذا وقف').toBeTruthy()
    expect(row.done, 'شعبةٌ بلا فصلٍ عُدَّت مفتوحة').toBe(false)
    expect(item('term').done, 'سُمّي فصلُها وبقي الصفُّ أحمر').toBe(true)
  })

  it('واسمُ الصفّ يسمّي فاعلَه — لا يُقرأ أمرا للمدرّب', () => {
    /* «لم يتمّ» أمامَ سطرٍ بصيغة الأمر تهمةٌ؛ وأمامَ سطرٍ فاعلُه الإدارةُ خبر */
    expect(item('term', termless).labelAr, 'سطرُ الفصل لا يقول من يفعله').toContain('الإدارة')
  })

  it('والاسمُ القصيرُ لا يمرّ — «شعبة» لا تصف دفعة', () => {
    expect(item('identity', { cohort: { title: 'أ', termId: 'T-winter' } }).done).toBe(false)
  })

  it('ولا مواعيدَ تُكتب بيد — الحقولُ المشطوبةُ ليست في التوقيع أصلا', () => {
    expect(item('identity').done, 'اسمٌ لم يكفِ').toBe(true)
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

/* ═══ ③ ولا بابَ للمدرّب إلى الفصل ═══

   القاعدةُ أعلاه تُقرأ من القائمة، والقائمةُ لا تمنع أحدا من إعادة فتح
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
