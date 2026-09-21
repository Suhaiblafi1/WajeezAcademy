/* ألسنةُ شاشة طلبات المدربين — من يراها، ومتى تُرسَم أصلا.

   ═══ السؤالُ الذي كُتبت له (٢١ سبتمبر ٢٠٢٦) ═══

   «لماذا يوجد لسانا التأهيل والإسناد واقتراحات التعديل؟ هل نستطيع الوصولَ
   لهما من خلال حساب كلّ مدرّب؟ فلماذا هما هنا إذًا؟».

   والجوابُ أنّهما طابورا **قرارٍ**: المدرّبُ يطلب ولا يقرّر. غير أنّ تحت
   السؤال عطبَين حقيقيّين:

   ① **لسانٌ يُعرض لمن يُردّ عند أوّل نقرة.** بابُ الشاشة
      `trainer.applications.view`، ونداءَا «التأهيل والإسناد» كلاهما
      يشترطان `trainer.qualify` — فالمنسّقُ الأكاديميُّ ومديرُ العمليّات
      يريان اللسانَ ويُردّان عند التحميل نفسِه.

      وحُرس أوّلا بصلاحيّته، ثمّ سأل صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦):
      «لماذا التأهيل والإسناد موجود هنا؟» — فالحراسةُ عالجت الردَّ ولم
      تعالج الموضع. فخرج إلى شاشته `/admin/trainer-run` في «المدرّبون —
      التشغيل»، وهو عرفُ «أتعاب المدربين» نفسُه: نقلُ البابِ لا توسيعُ
      المفتاح.

   ② **ولسانٌ لا يدخله شيء.** «اقتراحات تعديل الدورات» طابورُ قرارٍ بلا
      بريد: مسالكُ الإرسال من جانب المدرّب حُذفت (٨ سبتمبر ٢٠٢٦) وقناةُ
      اسم الدورة أُغلقت بقرار صاحب المنصّة (١٧ سبتمبر).

   ═══ وما يُحرَس ═══

   ① **لا لسانَ بلا شرط** — «التأهيل والإسناد» بصلاحيّة نداءَيه أنفسِهما،
      و«اقتراحات التعديل» بوجود ما ينتظر فيه.
   ② **والشرطُ هو شرطُ الخادم** — `trainer.qualify` لا حبّةٌ أخرى تشبهها،
      وتُقرأ من المسار نفسِه لا من ذاكرة كاتب.
   ③ **ولا شريطَ للسانٍ واحد** — زرٌّ مختارٌ أبدا إطارٌ حول عنوان.
   ④ **ومن اختار لسانا ثمّ لم يعد يُعرض لا يُترك في فراغ.**
   ⑤ **ولا يُحال قارئٌ إلى بابٍ لا وجودَ له** — «تصل من بوابة المدرب ←
      اقتراحاتي» كانت تقول ما ليس كذلك. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
const ROUTES = 'server/http/routes/admin-trainer.routes.ts'

/** الحبّةُ التي يشترطها مسارٌ بعينه في الخادم — تُقرأ منه لا تُكتب هنا */
function permissionOf(path: string): string | null {
  const routes = read(ROUTES)
  const at = routes.indexOf(`app.get('${path}'`)
  if (at === -1) return null
  return /requirePermission\('([^']+)'\)/.exec(routes.slice(at, at + 400))?.[1] ?? null
}

describe('① ولا لسانَ بلا شرط', () => {
  const screen = code(SCREEN)

  it('الألسنةُ تُحسب في قائمةٍ لكلٍّ منها `show` — لا ثلاثةٌ مرسومةٌ دائما', () => {
    expect(screen, 'الألسنةُ مكتوبةٌ في الرسم بلا شرط').toMatch(/const tabs = \(\[/)
    expect(screen, 'لا تُرشَّح القائمةُ بشرطها').toContain('.filter((t) => t.show)')
  })

  it('و«اقتراحات التعديل» بوجود ما ينتظر — ولا لسانَ للتأهيل هنا أصلا', () => {
    const list = /const tabs = \(\[([\s\S]*?)\] as const\)/.exec(screen)?.[1] ?? ''
    expect(list, 'قائمةُ الألسنة مفقودة').toBeTruthy()
    expect(list, 'لسانُ الاقتراحات يُعرض فارغا').toMatch(/key: "changes",[\s\S]*?show: openChanges > 0/)
    /* والعددُ مكتوبٌ عليه: لسانٌ يظهر فجأةً بلا رقمٍ لا يقول كم ينتظر */
    expect(list, 'اللسانُ بلا عددٍ مكتوب').toContain('${openChanges}')
    /* وعاد «التأهيل والإسناد» لسانا بعد أن صار شاشةً — والسؤالُ يعود معه */
    expect(list, 'عاد لسانُ التأهيل إلى شاشة الطلبات').not.toContain('key: "run"')
    expect(screen, 'شاشةُ الطلبات ما زالت تصيّر سلسلةَ التشغيل')
      .not.toContain('TrainerRunOps')
  })
})

describe('② والشرطُ هو شرطُ الخادم لا حبّةٌ تشبهه', () => {
  it('نداءَا «التأهيل والإسناد» كلاهما يشترطان `trainer.qualify`', () => {
    for (const path of ['/api/admin/trainers/ops', '/api/admin/qualification-requests']) {
      expect(permissionOf(path), `${path}: لا حارسَ له في الخادم`).toBe('trainer.qualify')
    }
  })

  it('وبابُها في الشريط محروسٌ بها بعينها — فلا يراه من يُردّ عندها', () => {
    const nav = code('src/pages/admin/nav-map.ts')
    const entry = /\{[^{}]*to: "\/admin\/trainer-run"[\s\S]*?\}/.exec(nav)?.[0] ?? ''
    expect(entry, 'لا بابَ لسلسلة التشغيل في الشريط — فلا مدخلَ لها بعد خروجها').toBeTruthy()
    expect(entry, 'البابُ محروسٌ بحبّةٍ غيرِ التي يشترطها نداؤه')
      .toContain('need: "trainer.qualify"')
  })

  it('وللشاشة مسارٌ مسجَّلٌ ومكوّنٌ يلفّها بسقالة الإدارة', () => {
    expect(code('src/App.tsx'), 'بابٌ في الشريط بلا مسارٍ يفتحه')
      .toContain('path="/admin/trainer-run"')
    const page = code('src/pages/admin/TrainerRun.tsx')
    expect(page, 'الشاشةُ لا تصيّر سلسلةَ التشغيل').toContain('<TrainerRunOps />')
    expect(page, 'شاشةٌ بلا سقالةِ إدارةٍ — لا شريطَ فيها ولا عنوان').toContain('<AdminLayout')
  })

  it('وعددُ المنتظِر محروسٌ بحبّة المراجعة — ولا يُنادى من لا يملكها', () => {
    expect(permissionOf('/api/admin/trainer-change-requests/open-count'))
      .toBe('trainer.change.review')
    const screen = code(SCREEN)
    expect(screen, 'الشاشةُ لا تقرأ حبّةَ المراجعة')
      .toContain('user?.permissions?.includes("trainer.change.review")')
    expect(screen, 'يُنادى العدُّ لمن يُردّ — ٤٠٣ في كلّ فتحةِ شاشة')
      .toMatch(/if \(!canReviewChanges\) \{ setOpenChanges\(0\); return; \}/)
  })

  it('والعددُ يُطلب عددا لا قائمةً تُعَدّ في المتصفّح', () => {
    const screen = code(SCREEN)
    expect(screen, 'تُجلَب القائمةُ كلُّها لقراءة رقمٍ منها')
      .toContain('"/api/admin/trainer-change-requests/open-count"')
    expect(screen, 'الشاشةُ تجلب طابورَ الاقتراحات لتعدَّه')
      .not.toMatch(/apiGet<[^>]*>\("\/api\/admin\/trainer-change-requests"\)/)
  })
})

describe('③④ والشريطُ لا يُرسَم للسانٍ واحد، ولا يُترك أحدٌ في فراغ', () => {
  const screen = code(SCREEN)

  it('شريطُ الألسنة مشروطٌ بأكثرَ من لسان', () => {
    expect(screen, 'يُرسَم إطارٌ حول عنوانٍ واحد').toContain('tabs.length > 1 &&')
  })

  it('واللسانُ المعروضُ يتبع المتاحَ لا الحالةَ وحدَها', () => {
    expect(screen, 'لا مخرجَ لمن كان في لسانٍ لم يعد يُعرض')
      .toContain('tabs.some((t) => t.key === mode) ? mode : "apps"')
    /* والرسمُ كلُّه يقرأ `shown` — ولو بقي موضعٌ يقرأ `mode` لَرسم شاشةً بيضاء */
    expect(screen.match(/\{mode === /g), 'بقي موضعٌ يرسم من `mode` لا من المعروض').toBeNull()
  })
})

describe('⑤ ولا يُحال قارئٌ إلى بابٍ لا وجودَ له', () => {
  it('طابورُ الاقتراحات لا يقول إنّ الجديدَ يصل من بوابة المدرّب', () => {
    /* بلا التعليقات: ذِكرُ ما حُذف في شرحٍ يقول ما كان ليس عودةً له */
    const ops = code('src/pages/admin/TrainerOps.tsx')
    const empty = ops.slice(ops.indexOf('export function TrainerChangeRequests'))
    expect(empty, 'مكوّنُ الطابور مفقود').toBeTruthy()
    expect(empty, 'البابُ الموعودُ لا وجودَ له منذ ٨ سبتمبر ٢٠٢٦')
      .not.toContain('تصل من بوابة المدرب')
    /* ولا يُترك الفراغُ صامتا: من فتحه يقرأ لماذا لا يصله جديد */
    expect(empty, 'الفراغُ لا يقول لماذا — فيُظنّ عطبا أو يُنتظَر ما لا يأتي')
      .toContain('مغلقة')
  })

  it('والبابُ مغلقٌ فعلا في الخادم — فالنصُّ يصف واقعا لا ظنّا', () => {
    const portal = code('server/http/routes/trainer-portal.routes.ts')
    expect(portal, 'عاد مسلكُ إرسال اقتراح التعديل من جانب المدرّب')
      .not.toContain("'/api/trainer/change-requests'")
  })
})
