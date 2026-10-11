/* رابطُ حجز جلسة التهيئة يصل في رسالة اعتماد التوقيع — قابلا للنقر.

   قرارُ صاحب المنصّة (٢٨ سبتمبر ٢٠٢٦): «once we approve their signature, the
   email they receive.. i need you add a link of my calendly so they can book a
   session if they need assistant in comleting their profile (materials)».

   ═══ ولمَ يُقاس على الرسالة المصيَّرة لا على الشيفرة ═══

   `richHtml` **لا يُلقِّم الروابطَ العارية**: النصُّ الخالصُ يُهرَّب
   (`esc`)، ولا يصير وسما `<a>` إلّا ما جاء جزءا `{ text, href }` أو رابطَ
   `note`/`cta`. فرابطٌ يُكتب في متن فقرةٍ نصّا يصل **حرفا ميّتا** لا يُنقر —
   وهو العطبُ نفسُه الذي أوصل `**` نجمتَين إلى ستّةَ عشرَ موضعا قبل أن يُقاس
   المطبوعُ لا المكتوب.

   فهذا الفحصُ يصيّر الرسالةَ ويسأل: أفي HTML وسمٌ يحمل الرابط؟ وأفي النصّ
   الخالص عنوانُه؟ (فمن يقرأ الرسالةَ نصّا بلا HTML يجده.) */

import { readFileSync as readRaw } from 'node:fs'
import { plainAr } from '@/application/text/plain-ar'
/* ما يُقرأ من الملفّات بلا تشكيلٍ إعرابيّ — بعضُها بعد «اللغة البيضاء» وبعضُها (العقود والخادم) قبلها */
function readFileSync(p: Parameters<typeof readRaw>[0]): Buffer
function readFileSync(p: Parameters<typeof readRaw>[0], e: BufferEncoding | { encoding: BufferEncoding }): string
function readFileSync(p: Parameters<typeof readRaw>[0], e?: BufferEncoding | { encoding: BufferEncoding }): string | Buffer {
  return e === undefined ? readRaw(p) : plainAr(String(readRaw(p, e)))
}
import { join } from 'node:path'
import { describe, expect as vexpect, it } from 'vitest'
/* ما يُفحص بلا تشكيلٍ إعرابيّ — بعضُ ما يُقرأ هنا بعد «اللغة البيضاء» وبعضُه (الخادمُ والعقودُ والتشخيص) قبلها */
const plainDeep = (v: unknown): unknown =>
  typeof v === 'string' ? plainAr(v) : Array.isArray(v) ? v.map(plainDeep)
    : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDeep(x)])) : v
const expect = Object.assign((v: unknown, m?: string) => vexpect(plainDeep(v), m), vexpect) as typeof vexpect
import { contractApprovedMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'
import {
  ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR,
} from '../../application/trainer/orientation-session'

const BASE = {
  legalName: 'سهيب الحسن',
  title: 'عقد تدريب — الفصل الشتويّ',
  approvedOnAr: '٢٨ سبتمبر ٢٠٢٦',
  portalUrl: 'https://www.wajeezacademy.com/trainer',
  guideUrl: 'https://www.wajeezacademy.com/trainer/guide',
}

/** العرضُ المشروطُ هو الحالُ التي تُفتح فيها البوّابةُ وتبدأ فيها المهلة */
const CONDITIONAL = { ...BASE, gatesActivation: true }
/** وبندٌ يُوثَّق على مدرّبٍ نشطٍ أصلا — لا بوّابةَ تُفتح ولا موادَّ تُنتظَر */
const PLAIN = { ...BASE, gatesActivation: false }

describe('رابط جلسة التهيئة في رسالة اعتماد التوقيع', () => {
  it('الرابط في الرسالة، و**وسما** ينقر لا حرفا ميّتا', () => {
    const { html } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(html, 'الرابط غائب عن الرسالة').toContain(ORIENTATION_BOOKING_URL)
    /* والوسمُ لا الحرف: `href="…"` يعني أنّه يُنقر */
    expect(html, 'الرابط نصّ لا ينقر — و`richHtml` لا يلقّم العاري')
      .toMatch(new RegExp(`<a[^>]+href="${ORIENTATION_BOOKING_URL.replace(/[/.]/g, '\\$&')}"`))
  })

  it('ويصل من يقرأ النصّ الخالص بلا HTML', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(text, 'لا عنوان في النسخة النصّيّة').toContain(ORIENTATION_BOOKING_URL)
  })

  it('ويقرأ عرضا لا واجبا — كما يقول البند 2-8', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(text).toContain('إن أردت')
    expect(text, 'الجلسة حقّ لا التزام — والنصّ يجب أن يقوله')
      .toMatch(/حقّ لك لا التزام عليك/)
  })

  it('واسم الزرّ من موضعه لا منسوخا — فلا نسختان تفترقان', () => {
    const { html } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(html).toContain(ORIENTATION_CTA_AR)
  })

  /* ولا يُعرَض على من لا موادَّ تُنتظَر منه: بندٌ يُوثَّق على مدرّبٍ نشطٍ
     أصلا لا بوّابةَ تُفتح له ولا مهلةَ تبدأ — فدعوةٌ إلى جلسةٍ عن «إعداد
     محاورك» تُقرأ عبثا، أو تُفهَم طلبا لعملٍ لا يُطلب منه. */
  it('ولا يدعى إليها من لا طور موادّ له', () => {
    const { html, text } = renderMail(contractApprovedMail(PLAIN).doc)
    expect(html, 'دعي إلى جلسة موادّ من لا موادّ عليه').not.toContain(ORIENTATION_BOOKING_URL)
    expect(text).not.toContain(ORIENTATION_BOOKING_URL)
  })

  it('وما كانت الرسالة تقوله يبقى — فالنقل لم يسقط شيئا', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    /* الحقائقُ الثلاثُ التي كانت في الكتلة قبل استخراجها */
    expect(text).toContain(BASE.title)
    expect(text).toContain(BASE.approvedOnAr)
    expect(text, 'سقطت الإحالة إلى «عقدي»').toContain('عقدي')
    expect(text, 'سقط تذكير البند الثاني: كون الدورة من دوراته لا يلزم بإسناد')
      .toContain('أن تكون الدورة من دوراتك لا يلزم الأكاديميّة بإسنادها إليك')
    expect(text, 'سقط زرّ البوّابة').toContain(BASE.portalUrl)
  })

  /* وعنوانُ العرض المشروط صار «اعتمدنا توقيعَك» لا «اعتُمد عقدُك» (١ أكتوبر
     ٢٠٢٦): اعتمادُ توقيعه لا يُنفذ عرضَه — نوقّعه حين نعتمد دوراتِه. */
  it('وعنوان الرسالة وترويستها', () => {
    const mail = contractApprovedMail(CONDITIONAL)
    expect(mail.subject).toContain('اعتمدنا توقيعك')
    expect(mail.subject, 'عنوان يقول إنّ عقده اعتمد ولم نوقّعه').not.toContain('اعتمد عقدك')
    expect(mail.subject).toContain(BASE.title)
    expect(mail.doc.heading).toContain('اعتمد توقيعك')
    expect(contractApprovedMail(PLAIN).subject).toContain('اعتمد عقدك')
    expect(contractApprovedMail(PLAIN).doc.heading).toBe('اعتمد عقدك')
  })
})

/* ═══ وفي «موادُّ دوراتك» أيضا (٣٠ سبتمبر ٢٠٢٦) ═══
   كان الرابطُ في الرسالة والدليل وحدَهما، فمن حذف الرسالةَ لم يجده. وقرارُ
   صاحب المنصّة: «أضِفه في موادّ دوراتك» — حيث يُكتب ما تُعين عليه الجلسة.
   ويغيب بعد إعلان الاكتمال: لا ما يُعان عليه. */
describe('رابط جلسة التهيئة في «موادّ دوراتك»', () => {
  const PANEL = readFileSync(join(process.cwd(), 'src/pages/trainer/CourseMaterialsPanel.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('زرّ ينقر إلى الرابط نفسه، باسمه ونصّه من موضعهما', () => {
    expect(PANEL).toMatch(/href=\{ORIENTATION_BOOKING_URL\}[^>]*target="_blank"/)
    expect(PANEL).toContain('{ORIENTATION_CTA_AR}')
    expect(PANEL).toContain('{ORIENTATION_INVITE_AR}')
  })

  it('ويعرض ما دامت الموادّ تكتب لا بعد إعلان اكتمالها', () => {
    /* ولمن في طور الإعداد وحدَه (٣ أكتوبر ٢٠٢٦): النشطُ يرى هنا دوراتِه المعتمَدةَ
       بلا شعبة، ولا يُدعى إلى جلسة تهيئةٍ عن طورٍ لم يعد فيه */
    expect(PANEL).toMatch(/\{inSetup && !underReview && \([\s\S]{0,300}?href=\{ORIENTATION_BOOKING_URL\}/)
  })
})

/* ═══ وفي الشعبة نفسِها (٣ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة («A»): التعبئةُ في «شعبي»، فرابطُ المساعدة هناك — ما دامت
   الخطّةُ بيده (مسوّدةً أو مردودة). */
describe('رابط جلسة التهيئة في الشعبة', () => {
  const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('زرّ ينقر إلى الرابط نفسه ما دامت الخطّة تعبّأ', () => {
    expect(WS).toMatch(/ws\.plan\.status === "changes_requested"\) && \([\s\S]{0,400}?href=\{ORIENTATION_BOOKING_URL\}[^>]*target="_blank"/)
    expect(WS).toContain('{ORIENTATION_CTA_AR}')
  })
})
