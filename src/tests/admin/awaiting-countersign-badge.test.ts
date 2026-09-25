/* ما ينتظر ختمَنا يبقى منظورا — لا إشعارا يمضي.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * العقدُ الموقَّعُ يقف حتّى تختمه الأكاديميّة، وبه يُفعَّل حسابُ المدرّب
 * وتُعتمَد موادُّه. وكان الإشعارُ وحدَه يُرسَل ساعةَ التوقيع ثمّ يمضي — فمن
 * لم يقرأه ساعتَه لا يجد بعده ما يناديه، ويبقى المدرّبُ ينتظر اعتمادا
 * نسيناه.
 */

import { describe, expect, it } from 'vitest'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** جسمُ دالّةٍ بعينها لا إلى آخر الملفّ */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`async ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\n  async ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('العدُّ يقع على ما ينتظرنا وحدَه', () => {
  const svc = bare('server/services/trainer-review.service.ts')

  it('يعدّ الموقَّعَ الذي لم يُختَم — لا المرسَلَ ولا المختوم', () => {
    const body = fnBody(svc, 'countAwaitingCountersign')
    expect(body, 'لا دالّةَ عدّ').not.toBe('')
    expect(body, 'لا يُقيَّد بالحالة — فيُعَدّ ما لا ينتظرنا').toContain("status: 'signed'")
    /* وما بعده تمّ، وما قبله لا ينتظرنا */
    expect(body, 'عُدَّ المختومُ وقد تمّ').not.toContain('countersigned')
    expect(body, 'عُدَّ المرسَلُ ولمّا يُوقَّع').not.toMatch(/'sent'/)
  })

  /* والنافذةُ محدودةٌ بتسجيل المسار نفسِه لا بعددٍ من الأحرف: كُتبت أوّلا
     أربعَمئةِ حرفٍ بعد الاسم، فبلغت المسارَ التالي — وهو محروسٌ بالصلاحيّة
     نفسِها. فنُقض الحارسُ عن مسارنا ومرّ الفحصُ على جارِه. */
  it('والمسارُ محروسٌ بصلاحيّة إدارة العقود', () => {
    const routes = bare('server/http/routes/admin-trainer.routes.ts')
    const at = routes.indexOf('awaiting-countersign-count')
    expect(at, 'لا مسارَ للعدّ').toBeGreaterThan(-1)
    const next = routes.slice(at).search(/\n {2}app\.(get|post|put|patch|delete)\(/)
    const block = routes.slice(at, next < 0 ? routes.length : at + next)
    expect(block, 'مسارٌ بلا حارسِ صلاحيّة').toContain("requirePermission('trainer.contract.manage')")
  })

  /* ═══ ولا يلتقطه المسارُ ذو المعرّف ═══

     `:contractId` يقع على كلّ ما بعد الشرطة، فيُخشى أن يُقرأ
     «awaiting-countersign-count» معرّفَ عقدٍ فيُردَّ «غير موجود».

     وكتبتُ الحارسَ أوّلا على **ترتيب التسجيل** في الملفّ — أن يُسجَّل
     الثابتُ قبل ذي المعرّف. فسقط: الثابتُ مسجَّلٌ بعده فعلا. والاعتقادُ
     كان خاطئا لا الشيفرة — `find-my-way` شجرةٌ جذريّةٌ تقدّم المقطعَ
     الثابتَ على المعلَّم مهما كان ترتيبُ التسجيل، وذاك شأنُ Express لا
     Fastify.

     فصار المقيسُ **التوجيهَ الواقعَ** لا ترتيبَ أسطر: يُسجَّل المساران
     كما في الخادم ثمّ يُحقَن نداءٌ، ويُنظَر أيُّهما ردّ. */
  it('ولا يلتقطه المسارُ ذو المعرّف — بالتوجيه لا بترتيب الأسطر', async () => {
    const app = Fastify()
    /* بالترتيب الواقع في الخادم: ذو المعرّف أوّلا */
    app.get('/api/admin/trainer-contracts/:contractId/body', async () => ({ hit: 'param' }))
    app.get('/api/admin/trainer-contracts/awaiting-countersign-count', async () => ({ hit: 'fixed' }))
    const r = await app.inject({ method: 'GET', url: '/api/admin/trainer-contracts/awaiting-countersign-count' })
    expect(r.json(), 'التُقط مسارُ العدّ معرّفَ عقد').toEqual({ hit: 'fixed' })
    /* ويبقى ذو المعرّف يعمل لما هو له */
    const p = await app.inject({ method: 'GET', url: '/api/admin/trainer-contracts/abc123/body' })
    expect(p.json(), 'كُسر المسارُ ذو المعرّف').toEqual({ hit: 'param' })
    await app.close()
  })
})

describe('والشارةُ تُعرَض حيث ينتظر العمل', () => {
  const nav = bare('src/pages/admin/nav-map.ts')
  const layout = bare('src/pages/admin/AdminLayout.tsx')

  it('بندُ «العقود» وحدَه يحمل الشارة', () => {
    const at = nav.indexOf('/admin/trainer-contracts')
    expect(at, 'لا بندَ للعقود').toBeGreaterThan(-1)
    /* حدُّ البند: من مساره إلى قوس إغلاقه */
    const item = nav.slice(at, nav.indexOf('},', at))
    expect(item, 'بندُ العقود بلا شارة').toContain('awaitingCountersign')
    /* ولا تُعلَّق على كلّ بند: شارةٌ في كلّ سطرٍ لا تدلّ على شيء */
    expect((nav.match(/badge: "awaitingCountersign"/g) ?? []).length, 'الشارةُ على أكثرَ من بند').toBe(1)
  })

  it('والإطارُ يجلب العددَ ويعرضه', () => {
    expect(layout, 'لا يُجلَب العدد').toContain('awaiting-countersign-count')
    expect(layout, 'لا تُعرَض الشارةُ في البند').toMatch(/t\.badge/)
  })

  /* ═══ والصفرُ لا يُعرَض ═══
     شارةٌ تقول «٠» تُقرأ عملا ينتظر، ومن رآها فتح الشاشةَ فلم يجد شيئا.
     ومن تكرّر عليه ذلك كفّ عن النظر إليها — فتموت وهي حيّة. */
  it('ولا شارةَ عند الصفر', () => {
    expect(layout, 'تُعرَض الشارةُ ولو كان العددُ صفرا')
      .toMatch(/badges\[t\.badge\]\s*>\s*0/)
  })

  /* ورقمٌ عارٍ لا يقول ماذا يعدّ لمن يسمعه بقارئ شاشة */
  it('ويُقرأ بلسانه لا رقما عاريا', () => {
    expect(layout, 'الشارةُ رقمٌ بلا نصٍّ يقرؤه قارئُ الشاشة').toContain('sr-only')
    expect(layout, 'لا يُقال ماذا يُنتظَر').toMatch(/ينتظر ختمَك/)
  })

  /* ولا يسقط الإطارُ كلُّه لمن لا صلاحيّةَ له: نداؤه يُردّ، فتُبتلَع */
  it('وردُّ النداء لا يكسر الإطار', () => {
    const at = layout.indexOf('awaiting-countersign-count')
    expect(layout.slice(at, at + 400), 'نداءٌ بلا التقاطِ خطأ').toContain('.catch(')
  })
})
