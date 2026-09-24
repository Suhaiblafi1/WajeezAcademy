/* ما يبلغ المتقدّمَ فعلا — وما سُحب من شاشته لأنّه لا يبلغه شيئا.

   أربعةُ قراراتٍ لصاحب المنصّة في ٢٤ سبتمبر ٢٠٢٦، وعلّتُها واحدة: **شاشةٌ
   تقول، ولا شيءَ يصل**.

   ① طلبُ الدرس التجريبيّ كان يقلب الحالةَ ولا يُرسل حرفا — فننتظر درسا لم
      نطلبه، وينتظر هو طلبا لم يصله. «يجب أن يكون بإرسال إيميل وليس فقط
      تغيير حالته».
   ② و«عدّل طلبك» يفتح استمارةً فارغة — «لا داعي له».
   ③ وشاشةُ ما بعد الإرسال تقول ما قالته قبل سطرَين — «كلام كثير لا داعي له».
   ④ ورسالةُ الاطمئنان تردّه إلى حسابه قبل التقويم — «يجب أن يأخذه حجزُ
      الموعد على كلندلي مباشرةً».

   ═══ ولمَ يُفحص الأثرُ لا النصّ ═══

   الحارسُ هنا لا يسأل «أفيه هذه الكلمة؟» بل «أيخرج هذا الفعل؟»: أيُستدعى
   البريدُ في فرع القرار، وإلى أين يشير الزرّ، وأبقي الزرُّ المسحوب. فنصٌّ
   يُبدَّل لا يُحمّر شيئا، وفعلٌ يسقط يُحمّره. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { demoRequestMail, noShowFollowupMail } from '../../../server/services/trainer-decision-mail'
import { NO_SHOW_FOLLOWUPS } from '@/application/trainer/no-show-followup'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8')

/* ═══ وما يُقاس هو ما يُعرض — لا ما يُكتب في تعليق ═══

   وقع في كتابة هذا الملفّ: «لا قسمَ ‹وفي أثناء ذلك›» سقط لأنّ التعليقَ الذي
   يشرح حذفَه يذكر اسمَه. وهو العطبُ الذي يحذّر منه المستودَع بعينه — أن
   يُطابَق حرفٌ في تعليقٍ بدل البنية.

   فتُجرَّد التعليقاتُ قبل الفحص — الكتلةُ في JSX، والكتلةُ العاديّة، والسطر
   المسبوق بشرطتَين. وما بقي بعدها شيفرةٌ تُصيَّر فعلا. */
const noComments = (src: string) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

const REF = 'WJ-TR-2026-00211'
const NAME = 'صهيب الخوالدة'

describe('① طلبُ الدرس التجريبيّ يصل بريدا لا حالةً وحدَها', () => {
  it('⚠️ والقرارُ يُرسلها — لا يقلب الحالةَ ويسكت', () => {
    /* العطبُ الأوّل: `request_demo` لم يكن له فرعٌ يُرسل. والفحصُ على الفرع
       نفسِه لا على وجود الدالّة — دالّةٌ تُكتب ولا تُنادى هي الصمتُ عينُه. */
    const src = code('server/services/trainer-review.service.ts')
    const i = src.indexOf("if (action === 'request_demo')")
    expect(i, 'لا فرعَ يُرسل عند طلب الدرس — الحالةُ تنقلب في صمت').toBeGreaterThan(-1)
    const branch = src.slice(i, i + 400)
    expect(branch, 'الفرعُ لا يبني الرسالة').toContain('demoRequestMail(')
    expect(branch, 'الرسالةُ تُبنى ولا تُرسَل').toContain('sendDirectEmail(')
  })

  it('⚠️ وتقول كيف يُرسل الدرسَ — وإلّا فهي طلبٌ بلا طريق', () => {
    /* لا بابَ رفعٍ في المنصّة لهذا. فرسالةٌ تطلب درسا ولا تقول أين يضعه
       تترك صاحبَها حيث كان: يعرف أنّنا ننتظر، ولا يعرف ماذا يفعل. */
    const body = JSON.stringify(demoRequestMail({ fullName: NAME, reference: REF }).doc)
    expect(body, 'لا يُقال له كيف يُرسل').toMatch(/ردَّ على هذه الرسالة|ردّ على هذه الرسالة/)
  })

  it('⚠️ وملاحظةُ المراجع تسافر معها — موضوعا ومدّةً وشرطا', () => {
    const asked = 'درسٌ في تجويد سورة الفاتحة، عشر دقائق'
    const body = JSON.stringify(demoRequestMail({ fullName: NAME, reference: REF, noteAr: asked }).doc)
    expect(body, 'ما طلبه المراجعُ لم يخرج إليه').toContain(asked)
  })

  it('وبلا ملاحظةٍ تقول شيئا محدّدا — لا «درسا» مجرّدة', () => {
    const body = JSON.stringify(demoRequestMail({ fullName: NAME, reference: REF }).doc)
    expect(body, 'لا مدّةَ ولا موضوعَ حين لا يكتب المراجعُ شيئا').toMatch(/دقائق|موضوعا/)
  })

  it('⚠️ ولا نجومَ في متنها — القالبُ يُهرّب ولا يترجم `**`', () => {
    /* `richHtml` تُهرّب النصَّ ولا تحوّل `**` إلى خطٍّ عريض، فما كُتب بها
       يصل إلى القارئ نجوما. والنقضُ: تُكتب نجمتان فيسقط هذا. */
    const doc = demoRequestMail({ fullName: NAME, reference: REF, noteAr: 'شيء' }).doc
    for (const b of doc.blocks) {
      const text = (b as { text?: unknown }).text
      if (typeof text === 'string') {
        expect(text, `نجومٌ تصل القارئَ كما هي: «${text.slice(0, 40)}…»`).not.toContain('**')
      }
    }
  })
})

describe('② «عدّل طلبك» سُحب — والمسوّدةُ وحدَها تُكمَل', () => {
  const page = () => code('src/pages/ApplicantStatus.tsx')

  it('⚠️ لا زرَّ تعديلٍ لطلبٍ أُرسل', () => {
    /* والفحصُ على الشرط: لو عاد `EDITABLE_STATUSES.includes` لَعاد الزرُّ
       لكلّ حالةٍ حيّة — وهو ما سُحب. */
    const src = page()
    expect(src, 'عاد الزرُّ إلى كلّ حالةٍ قابلةٍ للتعديل')
      .not.toMatch(/EDITABLE_STATUSES\.includes\(mine\.status\)/)
    expect(noComments(src), 'ما زال يُعرض نصُّ «عدّل طلبك» زرّا').not.toMatch(/>\s*عدّل طلبك/)
  })

  it('والمسوّدةُ تُكمَل — فنصفُ طلبٍ لا يُترك بلا باب', () => {
    const src = page()
    const i = src.indexOf('mine.status === "draft" && (')
    expect(i, 'سُحب بابُ المسوّدة معه — ولا طريقَ لها إلى الإرسال').toBeGreaterThan(-1)
    expect(src.slice(i, i + 400), 'لا زرَّ إكمالٍ في فرع المسوّدة').toContain('أكمل طلبك')
  })

  it('⚠️ ومن طُلبت منه إضافةٌ لا يُحال إلى زرٍّ ليس هناك', () => {
    /* أخطرُ ما يبقى بعد سحب زرّ: سطرٌ يقول «من الزرّ أعلاه». */
    const src = page()
    const i = src.indexOf('mine.status === "information_requested"')
    expect(i, 'لا فرعَ لطلب المعلومات').toBeGreaterThan(-1)
    const block = src.slice(i, i + 1400)
    expect(noComments(block), 'يُحيل إلى زرّ «عدّل طلبك» وقد سُحب').not.toMatch(/زرّ «عدّل طلبك»|الزرّ أعلاه/)
    expect(block, 'لا يُقال له بأيّ طريقٍ يُجيب').toMatch(/ردَّ على رسالتنا|ردّ على رسالتنا/)
  })

  it('وإذنُ الخادم بالتعديل لم يُمَسّ — المسحوبُ زرٌّ لا صلاحيّة', () => {
    /* لو سُحبت الحالةُ من `EDITABLE_STATUSES` لانحرف معها بابُ طلب
       المعلومات كلُّه (`info-request-reach`) — والمقصودُ الشاشةُ وحدَها. */
    const opts = code('src/application/trainer/application-options.ts')
    const block = /export const EDITABLE_STATUSES[^=]*=\s*\[([\s\S]*?)\]/.exec(opts)?.[1] ?? ''
    expect(block, 'لم يُقرأ متنُ القائمة — تعطّل الفحص').not.toBe('')
    expect(block, 'خرجت «طُلبت منه معلومات» من قائمة التعديل').toContain('information_requested')
  })
})

describe('③ شاشةُ ما بعد الإرسال — ما حُذف لا يعود', () => {
  const join = () => code('src/pages/JoinTrainer.tsx')

  it('⚠️ لا قسمَ «وفي أثناء ذلك» — كان يُعيد ما فوقَه', () => {
    expect(noComments(join()), 'عاد القسمُ الذي حُذف').not.toContain('وفي أثناء ذلك')
  })

  it('⚠️ وبطاقةُ الحساب زرٌّ بلا فقرةٍ تشرحه', () => {
    const src = join()
    const i = src.indexOf('to="/auth"')
    expect(i, 'لا زرَّ دخولٍ في شاشة ما بعد الإرسال').toBeGreaterThan(-1)
    expect(noComments(src), 'عاد العنوانُ والفقرةُ فوق الزرّ').not.toContain('تابع حالة طلبك من حسابك')
    expect(src, 'عادت الفقرةُ التي تصف ما يراه بعد الدخول')
      .not.toContain('سترى حالة طلبك في كل مرحلة')
  })

  it('⚠️ وبطاقةُ التوثيق سطرٌ واحدٌ وفعلان — لا أربعُ فقرات', () => {
    const card = code('src/components/EmailVerifyStatus.tsx')
    expect(noComments(card), 'عاد شرحُ أنّ البطاقة تتحدّث وحدَها').not.toContain('تتحدّث هذه البطاقةُ')
    expect(noComments(card), 'عاد سطرُ مجلّد الرسائل غير المرغوبة').not.toContain('Spam')
    /* والفعلان يبقيان: هما عملٌ لا شرح، وحذفُهما يترك صاحبَه بلا طريق */
    expect(card, 'سُحب زرُّ تحديث الحالة').toContain('وثّقتُ بريدي')
    expect(card, 'سُحب زرُّ إعادة الإرسال').toContain('أعد الإرسال')
  })

  it('⚠️ وصفحةُ الحالة مثلُها — «كل الصفحات المشابهة»', () => {
    expect(noComments(code('src/pages/ApplicantStatus.tsx')), 'بقيت فقرةُ التوثيق الطويلةُ هنا')
      .not.toContain('فعلى هذا البريد وحدَه نتواصل معك')
  })

  it('ولم تُمَسّ بطاقةُ حجز الموعد — «لا تلمس ما يخصّ حجز الموعد»', () => {
    /* شرطُ صاحب المنصّة صراحةً: التقليمُ لا يطال الحجز، فبابُه مقفولٌ عند
       التقديم مفتوحٌ عند الدعوة — وذاك قرارٌ قائمٌ بذاته. */
    /* ═══ وتُعَدّ المركّباتُ لا يُبحث عن واحدة ═══

       وقع في كتابة هذا الحارس مرّتان: `toContain('<BookInterview')` يمرّ على
       `<BookInterviewX`؛ ثمّ شُدّ إلى الوسم بحدّه فمرّ كذلك، لأنّ الشاشةَ
       تركّبها **مرّتَين** (ما بعد الإرسال، ومتابعةُ الطلب) — فبُدّلت واحدةٌ
       وبقيت أختُها تُرضي الحارس.

       فالمقيسُ العدد: من أسقط إحداهما أسقط الحارسَ معها. */
    const mounts = noComments(join()).match(/<BookInterview[\s/>]/g) ?? []
    expect(mounts.length, 'سقطت بطاقةُ الحجز — أو إحدى موضعَيها — مع ما قُلّم').toBe(2)
  })
})

describe('④ رسالةُ الاطمئنان تأخذه إلى التقويم مباشرةً', () => {
  const invite = NO_SHOW_FOLLOWUPS.find((f) => f.ctaAr)!
  const base = {
    followup: invite, fullName: NAME, reference: REF,
    bodyAr: 'أتمنّى أن تكون بخير.\n\nنحبّ أن نلتقيك في وقتٍ آخر.',
    statusUrl: 'https://x.test/join-trainer/status',
  }
  const ctaOf = (doc: { blocks: readonly unknown[] }) =>
    doc.blocks.find((b): b is { kind: 'cta'; href: string } =>
      typeof b === 'object' && b !== null && (b as { kind?: string }).kind === 'cta')

  it('⚠️ الزرُّ إلى كلندلي حين يُمرَّر تقويمُه والحجزُ مفتوح', () => {
    const cta = ctaOf(noShowFollowupMail({
      ...base, paused: false, bookingUrl: 'https://calendly.com/hadeel-7/wajeez-academy?name=x',
    }).doc)
    expect(cta?.href, 'يردّه إلى حسابه بدل التقويم').toContain('calendly.com')
    expect(cta?.href, 'يمرّ بصفحة الحالة — وهو حاجزٌ ثانٍ أمام من تخلّف مرّة')
      .not.toContain('/status')
  })

  it('⚠️ ويسقط إلى صفحة الحالة بلا رابط — لا زرٌّ بلا وجهة', () => {
    expect(ctaOf(noShowFollowupMail({ ...base, paused: false }).doc)?.href).toBe(base.statusUrl)
  })

  it('⚠️ والوقفُ يردّه إليها وإن مُرِّر الرابط', () => {
    const cta = ctaOf(noShowFollowupMail({
      ...base, paused: true, bookingUrl: 'https://calendly.com/hadeel-7/wajeez-academy',
    }).doc)
    expect(cta?.href).toBe(base.statusUrl)
  })

  it('⚠️ والخدمةُ تمرّر التقويمَ بحاضريه — وإلّا بقي الزرُّ على حاله', () => {
    const src = code('server/services/trainer-review.service.ts')
    const i = src.indexOf('noShowFollowupMail({')
    expect(i, 'لا استدعاءَ لرسالة المتابعة').toBeGreaterThan(-1)
    expect(src.slice(i, i + 420), 'الرسالةُ تُبنى بلا تقويم').toMatch(/bookingUrl:\s*await this\.bookingLink/)
  })
})
