/* دوراتٌ يقترحها المدرّبُ — من طلبِه، ثمّ بيدِه، ثمّ تُصنَّف (ح-٢ · ح-٤).

   ═══ ما يُحرَس ═══

   ① **الجدولُ يُبذَر من الطلب ولا يُفرِّغه** — العمودُ في `TrainerApplication`
      سجلُّ ما قدّمه المتقدّمُ يومَ تقدّم، وقد قرأه من اعتمده. فلو نُقل أو
      فُرِّغ لأعاد كتابةَ ما قرأه المعتمِد.
   ② **ولا يُبذَر مرّتَين** — `ensureProfile` تُعاد على ملفٍّ قائم، فبذرةٌ بلا
      شرطٍ تُضاعف اقتراحاتِه كلّما أُعيد اعتمادُه.
   ③ **وما بُتّ فيه لا يُعدَّل ولا يُحذف** — اقتراحٌ صار دورةً في الكتالوج لا
      يُحذف من تحت قرارِ من اعتمده، وإلّا بقيت الدورةُ بلا أصل.
   ④ **والربطُ لا يُنشئ إصدارا** — «نسخةٌ من رمزٍ قائم» تربط ولا تكتب: إنشاءُ
      الإصدار آليّا يضع في فم المدرّب عنوانا ومحاورَ لم يكتبها.
   ⑤ **والرفضُ بسببٍ يلزم في الخادم** — لا في الشاشة وحدَها.
   ⑥ **ولا نموذجَ إنشاءٍ ثانٍ** — الدورةُ الجديدةُ تُنشأ في `CourseWizard`
      نفسِه، فلا تتخلّف نسخةٌ أنحفُ عنه.

   والفحصُ **بنيويٌّ لا نصّيّ**: على الشرط الذي يمنع البذرَ الثاني، وعلى
   المجموعة التي تحكم ما يُعدَّل، وعلى ما تكتبه دالّةُ الربط فعلا. */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DECIDED_PROPOSAL, OPEN_PROPOSAL } from '../../../server/services/course-proposal.service'

const root = process.cwd()
const raw = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) =>
  raw(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const SVC = 'server/services/course-proposal.service.ts'
const REVIEW = 'server/services/trainer-review.service.ts'
const QUEUE = 'src/pages/admin/CourseProposals.tsx'
const MINE = 'src/pages/trainer/MyCourseProposals.tsx'

describe('ح-٢ · ح-٤ — الاقتراحُ يصير سجلّا ثمّ يُصنَّف', () => {
  const svc = code(SVC)

  it('الحالتان قسمةٌ لا تتداخل — وما بُتّ فيه ليس مفتوحا', () => {
    /* لو تقاطعتا لصار اقتراحٌ مبتوتٌ فيه قابلا للحذف، وهو ③ */
    const open = new Set<string>(OPEN_PROPOSAL)
    for (const s of DECIDED_PROPOSAL) expect(open.has(s), `${s} في الحالتَين معا`).toBe(false)
    expect(OPEN_PROPOSAL.length + DECIDED_PROPOSAL.length).toBeGreaterThanOrEqual(5)
  })

  it('① البذرةُ تقرأ العمودَ ولا تكتب فيه — فسجلُّ ما قُدّم يبقى', () => {
    /* الفحصُ على **الكتابة** لا على ورودِ الاسم: قراءةُ العمود مطلوبةٌ،
       وكتابتُه أو تفريغُه هو العطب. */
    const writes = /(?:prisma|tx)\s*\.\s*trainerApplication\s*\.\s*(update|updateMany|upsert|delete|deleteMany)/
    expect(writes.test(svc), 'البذرةُ تكتب في طلبِ المتقدّم').toBe(false)

    /* ولا يُفرَّغ العمودُ من أيّ موضعٍ في الخادم: `null` أو `[]` عليه محوٌ
       لسجلِّ ما قُدّم. والإدخالُ الأوّلُ (أ-٣) يكتبه قيمةً حقيقيّةً وهو حقُّه. */
    for (const f of ['server/services', 'server/http/routes']) {
      for (const file of readdirSync(join(root, f))) {
        if (!file.endsWith('.ts')) continue
        const src = code(`${f}/${file}`)
        expect(
          /teachableProposals\s*:\s*(null|\[\s*\]|undefined)/.test(src),
          `\`${f}/${file}\` يفرّغ سجلَّ ما قدّمه المتقدّم`,
        ).toBe(false)
      }
    }

    const review = code(REVIEW)
    expect(review, 'لا تُقرأ الاقتراحاتُ من الطلب عند ميلاد الملفّ').toMatch(/teachableProposals:\s*true/)
    expect(review, 'الملفُّ يُنشأ ولا تُبذَر اقتراحاتُه').toMatch(/seedProposalsFromApplication\(\s*tx,/)
    /* والبذرُ داخلَ المعاملة نفسِها: ملفٌّ يُنشأ ثمّ تسقط البذرةُ يترك
       مدرّبا بلا اقتراحاتِه ولا شيءَ يُعيدها. */
    const block = review.slice(review.indexOf('trainerProfile.create'))
    expect(block.indexOf('seedProposalsFromApplication'), 'البذرُ خارجَ معاملة الإنشاء').toBeGreaterThan(0)
  })

  it('② ولا تُبذَر مرّتَين — والشرطُ على عددِ ما في الجدول لا على شيءٍ آخر', () => {
    expect(svc).toMatch(/trainerCourseProposal\s*\.\s*count\(\{\s*where:\s*\{\s*profileId\s*\}/)
    expect(svc, 'يُبذَر ولو كان في الجدول صفوف').toMatch(/if\s*\(already\s*>\s*0\)\s*return\s*0/)
  })

  it('③ وما بُتّ فيه لا يُعدَّل ولا يُحذف — والحارسُ في التعديل والحذف كليهما', () => {
    expect(svc).toMatch(/OPEN_PROPOSAL as readonly string\[\]\)\.includes\(status\)/)
    /* ولا يكفي وجودُ الحارس: يجب أن يُنادى في البابَين */
    const edit = svc.slice(svc.indexOf('async edit('), svc.indexOf('async remove('))
    const remove = svc.slice(svc.indexOf('async remove('), svc.indexOf('/* ═══ جانبُ الإدارة'))
    expect(edit, 'التعديلُ بلا حارسٍ على الحالة').toContain('this.assertOpen(')
    expect(remove, 'الحذفُ بلا حارسٍ على الحالة').toContain('this.assertOpen(')
  })

  it('④ والربطُ يربط ولا يُنشئ إصدارا ولا نسخةَ دورة', () => {
    const link = svc.slice(svc.indexOf('async linkToCourse('), svc.indexOf('async markBecameCourse('))
    expect(link, 'الربطُ لا يكتب الحالةَ `linked`').toMatch(/status:\s*'linked'/)
    /* وهذا هو الحارسُ الحقيقيّ: لا كتابةَ في الكتالوج من هنا البتّة */
    for (const model of ['courseVersion', 'course', 'trainerChangeRequest']) {
      const w = new RegExp(`(?:prisma|tx)\\s*\\.\\s*${model}\\s*\\.\\s*(create|createMany|update|updateMany|upsert)`)
      expect(w.test(link), `الربطُ يكتب في \`${model}\` — والإصدارُ بيدِ المدرّب (ح-٣)`).toBe(false)
    }
  })

  it('⑤ والرفضُ بسببٍ يُردّ في الخادم لا في الشاشة وحدَها', () => {
    const rej = svc.slice(svc.indexOf('async reject('))
    expect(rej, 'يُقبل رفضٌ بلا سبب').toMatch(/reason\.length\s*<\s*5/)
    expect(rej).toMatch(/status:\s*'rejected'/)
  })

  it('⑥ ولا نموذجَ إنشاءٍ ثانٍ في شاشة الطابور — بل إحالةٌ إلى القائم', () => {
    const q = code(QUEUE)
    expect(q, 'الطابورُ يُنشئ الدورةَ بنفسه').not.toMatch(/apiPost\(\s*["'`]\/api\/admin\/catalog\/courses/)
    expect(q, 'لا إحالةَ إلى نموذج الكتالوج').toMatch(/\/admin\/catalog\?proposalId=/)
    /* ويعود النموذجُ فيربط ما أُنشئ — وإلّا بقي الاقتراحُ معلّقا بلا دورة */
    expect(code('src/pages/admin/CatalogAdmin.tsx')).toMatch(/course-proposals\/\$\{fromProposal\}\/became-course/)
    /* والربطُ بعد التمام لا قبله: `courseId` شرطٌ لا زينة */
    expect(code('src/pages/admin/CatalogAdmin.tsx')).toMatch(/if\s*\(fromProposal\s*&&\s*courseId\)/)
  })

  it('وشاشةُ المدرّب تُخفي أزرارَ التعديل عمّا بُتّ فيه — لا تعرضها فتُردّ', () => {
    const m = code(MINE)
    /* ═══ ولا تُطابَق القائمةُ حرفا ═══

       كان الحارسُ يطابق `["draft", "submitted"]` نصّا. فلمّا زِيدت
       `info_requested` في الخادم سقط — **وهو الصواب**: الشاشةُ كانت ستمنع
       التعديلَ على اقتراحٍ سُئل صاحبُه ليعدّله.

       لكنّ النصَّ الحرفيَّ يحرس نسخةً بعينها لا القاعدة: من زاد حالةً في
       الخادم ونسي الشاشةَ **يمرّ** ما دام النصُّ لم يتغيّر. فالفحصُ صار على
       أنّ الشاشةَ تحمل كلَّ ما يحمله `OPEN_PROPOSAL` — تعريفٌ واحدٌ لا
       نسختان تتباعدان. */
    for (const st of OPEN_PROPOSAL) {
      expect(m, `الشاشةُ لا تعدّ «${st}» مفتوحا — والخادمُ يعدّه`).toMatch(
        new RegExp(`const OPEN = \\[[^\\]]*"${st}"`),
      )
    }
    for (const st of DECIDED_PROPOSAL) {
      expect(m, `الشاشةُ تعدّ «${st}» مفتوحا — وقد بُتّ فيه`).not.toMatch(
        new RegExp(`const OPEN = \\[[^\\]]*"${st}"`),
      )
    }
    expect(m, 'الأزرارُ معروضةٌ دائما').toMatch(/const open = OPEN\.includes\(p\.status\)/)
    expect(m).toMatch(/\{open \?/)
  })

  /* ═══ والسؤالُ له موضعُ جوابه ═══

     سؤالٌ يُعرض بلا حقلٍ يُجاب فيه يترك صاحبَه يبحث عن بابٍ لا يجده، فيبقى
     الاقتراحُ معلّقا على جوابٍ لا سبيلَ إليه. وحقلٌ يُعرض بلا سؤالٍ مفتوحٍ
     يُرسِل جوابا يُردّ بـ٤٠٩. */
  it('⑦ وحقلُ الجواب يظهر على المسؤول عنه وحدَه — لا على كلّ اقتراح', () => {
    const m = code(MINE)
    const call = m.search(/course-proposals\/\$\{p\.id\}\/answer/)
    expect(call, 'لا بابَ للجواب في شاشة المدرّب').toBeGreaterThan(-1)

    /* ═══ ولا يكفي ورودُ الاسم في الملفّ ═══

       أوّلُ صياغةٍ طابقت `p.status === "info_requested"` في الملفّ كلِّه —
       **وهي موجودةٌ في `stateOf` أصلا** لتسمية الحالة. فلمّا رُفع الشرطُ عن
       الحقل وصار يُعرض على كلّ اقتراح، بقي الحارسُ أخضرَ لأنّ النصَّ لم يزل.
       وهو الخضارُ لسببٍ خاطئ بعينه.

       فالفحصُ على **موضع** الشرط من النداء: بوّابةُ التصيير تسبق نداءَ
       الإرسال، فمن رفعها كشف الحقلَ لمن لا سؤالَ عليه — ويُردّ بـ٤٠٩. */
    const gate = m.search(/p\.status === "info_requested"\s*\?\s*\(/)
    expect(gate, 'حقلُ الجواب بلا بوّابةِ سؤالٍ مفتوح').toBeGreaterThan(-1)
    expect(gate, 'نداءُ الجواب خارجَ بوّابته').toBeLessThan(call)
  })

  it('⑧ وطابورُ الإدارة يفتح بابَ السؤال ويعرض ترشيحَ أقربِ رمز', () => {
    const q = code(QUEUE)
    expect(q, 'لا بابَ لسؤال المدرّب من الطابور').toMatch(/course-proposals\/\$\{r\.id\}\/ask/)
    /* والترشيحُ يُقرأ من الحمولة لا يُحسب في المتصفّح: حسابُه هنا يعني تحميلَ
       الكتالوج كلِّه إلى كلّ من يفتح الشاشة. */
    expect(q, 'الطابورُ لا يعرض ترشيحا').toMatch(/r\.suggestedCourses/)
    expect(q, 'رُشّح بلا سببٍ يُعرض').toMatch(/sharedAr/)
  })

  it('وتقول له إنّ اقتراحَه ليس دورةً بعد — فلا ينتظر طلّابا لا يأتون', () => {
    expect(raw(MINE)).toContain('لا يظهر في «الدورات» ولا يُحسب في التشخيص المهنيّ')
  })

  it('وبابُ الطابور محروسٌ بصلاحيّةِ مراجعةِ اقتراحات المدرّبين', () => {
    expect(code('src/pages/admin/AdminLayout.tsx'))
      .toMatch(/to: "\/admin\/course-proposals"[^}]*need: "trainer\.change\.review"/)
    expect(code('src/App.tsx'), 'لا مسارَ لشاشة الطابور').toContain('/admin/course-proposals')
    expect(code('src/App.tsx'), 'لا مسارَ لشاشة المدرّب').toContain('/trainer/course-proposals')
  })

  it('ومسارُ الخادم محروسٌ بها هو الآخر — لا بالشاشة وحدَها', () => {
    const routes = code('server/http/routes/admin-trainer.routes.ts')
    const seg = routes.slice(routes.indexOf("'/api/admin/course-proposals'"))
    expect(seg.slice(0, 400)).toContain("requirePermission('trainer.change.review')")
    for (const door of ['link', 'became-course', 'reject']) {
      const at = routes.indexOf(`/api/admin/course-proposals/:id/${door}`)
      expect(at, `لا مسارَ لـ${door}`).toBeGreaterThan(0)
      expect(routes.slice(at, at + 300), `بابُ ${door} بلا حارس`)
        .toContain("requirePermission('trainer.change.review')")
    }
  })
})
