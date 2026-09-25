/* متى يُشترَط العقدُ — والمقياسُ اعتمادُ الموادّ لا حالةُ الحساب.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * كان المقياسُ `app.status !== 'active'`: يُشترَط عقدُ من لم يُفعَّل حسابُه.
 * وهو يسأل سؤالا غيرَ الذي يُراد، ويفترقان في مسارٍ واقع: **من قبل الدعوةَ
 * وأنشأ حسابَه قبل أن يُركَّب عقدُه** صار `active`، فيخرج عقدُه بلا شرطٍ
 * ولا خَتم — لا بندَ 2-6 في متنه، ولا طورَ ثانٍ يُعتمَد فيه بعد رفع
 * موادّه. ويفوته الطورُ كلُّه بلا أن يُنبَّه أحد.
 *
 * وهذا ما وقع فعلا في عقدٍ رآه صاحبُ المنصّة: خرج «اتفاقية» لا «عرضا
 * مشروطا».
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { offerGatesActivation, materialsEverApproved } from '@/application/trainer/conditional-offer'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) => readFileSync(join(root, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('الشرطُ يُقاس باعتماد الموادّ', () => {
  it('مرشّحٌ لا عقدَ له — يُشترَط', () => {
    expect(offerGatesActivation([])).toBe(true)
  })

  it('ومن له عقودٌ لم يُختَم منها شيء — يُشترَط', () => {
    expect(offerGatesActivation([null, null])).toBe(true)
  })

  /* ═══ وهذه الصورةُ بعينها هي التي كانت تسقط ═══
     عقدٌ قائمٌ لم يُعتمَد بعد، وحسابٌ صار نشطا لأنّه قبل الدعوة. */
  it('وعقدٌ قائمٌ بلا ختمٍ يُشترَط ولو نشط حسابُه', () => {
    expect(offerGatesActivation([null])).toBe(true)
  })

  it('ومن اعتُمدت موادُّه مرّةً لا يُعاد اشتراطُه', () => {
    expect(offerGatesActivation([new Date('2026-09-01')])).toBe(false)
    /* ولو كان الأحدثُ مسوّدةً لم تُختَم بعد — فالعبرةُ بأيِّ عقدٍ اعتُمد */
    expect(offerGatesActivation([null, new Date('2026-09-01')])).toBe(false)
  })

  /* والتواريخُ تصل نصّا من JSON أحيانا، فلا يُقاس النوعُ بل الوجود */
  it('ويُقرأ التاريخُ نصّا كما يُقرأ تاريخا', () => {
    expect(materialsEverApproved(['2026-09-01T00:00:00Z'])).toBe(true)
    expect(materialsEverApproved([undefined, null])).toBe(false)
  })
})

describe('والخادمُ يقيس بهذا لا بحالة الحساب', () => {
  const svc = bare('server/services/trainer-review.service.ts')

  it('`contractPrefill` تسأل عن اعتماد الموادّ', () => {
    const at = svc.indexOf('async contractPrefill(')
    expect(at, 'لا `contractPrefill`').toBeGreaterThan(-1)
    const next = svc.indexOf('\n  async ', at + 1)
    const body = svc.slice(at, next < 0 ? svc.length : next)
    expect(body, 'لا تُسأل قاعدةُ الاشتراط').toContain('offerGatesActivation(')

    /* ═══ ومن عقوده كلِّها لا من أحدثِها ═══

       العقودُ مرتَّبةٌ بالأحدث، فأخذُ `[0]` يقرأ آخرَ عقدٍ رُكِّب. ومن
       اعتُمدت موادُّه في عقدٍ قديمٍ ثمّ رُكّبت له مسوّدةٌ جديدةٌ يُقرأ
       ختمُها `null` — فيُعاد اشتراطُه وقد اعتُمد. */
    const call = body.slice(body.indexOf('offerGatesActivation('))
    const arg = call.slice(0, call.indexOf('),\n'))
    expect(arg, 'لا يُقرأ الختمُ أصلا').toContain('conditionMetAt')
    expect(arg, 'تُمَرُّ العقودُ مرورا لا يُقرأ منها إلّا واحد').toContain('.map(')
    expect(arg, 'يُؤخَذ أحدثُ عقدٍ وحدَه — ومن اعتُمد قديما يُشترَط ثانيةً')
      .not.toMatch(/\[0\]/)
  })

  /* والمقياسُ القديمُ لا يعود: `status !== 'active'` يسأل عن الحساب */
  it('ولا يعود المقياسُ إلى حالة الحساب', () => {
    expect(svc, 'عاد قياسُ الشرط بحالة الحساب')
      .not.toMatch(/gatesActivation:\s*app\.status/)
  })

  /* ═══ ومصدرٌ واحدٌ للشاشة وللتركيب ═══
     الشاشةُ تقول للموظّف قبل أن ينقر، والمركِّبُ يطبع المتن. فلو حُسبت
     مرّتين لَقالت الشاشةُ شيئا وطبع المتنُ غيرَه. */
  it('والشاشةُ والمركِّبُ يقرآن من موضعٍ واحد', () => {
    expect((svc.match(/offerGatesActivation\(/g) ?? []).length, 'حُسب الاشتراطُ في أكثرَ من موضع').toBe(1)
    expect((svc.match(/const pre = await this\.contractPrefill\(/g) ?? []).length,
      'لا يقرأ المركِّبُ من `contractPrefill`').toBeGreaterThanOrEqual(2)
  })
})

/* ═══ وأين يُصدَر الخصم — سطرٌ يبقى ولو لم يكن ثَمّ خصم ═══

   سأل صاحبُ المنصّة عن «الكود الذي يُنشئه في قسم مستحقّاته»، وموضعُ
   إصداره «دعوتي». والعلّةُ أنّ اللوحةَ التي تذكره في «مستحقّاتي» لا
   تُعرَض إلّا حين ينتظر خصمٌ حسمَه — فمن لم يُصدر شيئا قطّ لا يجد ما
   يدلّه. */
describe('ومستحقّاتي تدلّ على دعوتي', () => {
  const page = bare('src/pages/trainer/Earnings.tsx')

  it('سطرٌ يدلّ على موضع الإصدار', () => {
    expect(page, 'لا دلالةَ على «دعوتي»').toContain('«دعوتي»')
    expect(page, 'الدلالةُ بلا رابطٍ يُنقَر').toContain('to="/trainer/referral"')
    /* ومن سطوح المنصّة لا بصيغٍ مكتوبةٍ بيدها — وإلّا زاد دَينُ التلويم */
    expect(page, 'رُسم السطحُ باليد لا بـ`Inset`').toMatch(/<Inset[\s\S]{0,120}to="\/trainer\/referral"/)
  })

  /* ═══ وأهمُّ ما فيه: أن يبقى ═══

     فلو عُلّق على وجود خصمٍ عاد العطبُ نفسُه: من لم يُصدر شيئا قطّ — وهو
     من يحتاج الدلالةَ أكثر — لا يراها.

     وكُتب الحارسُ أوّلا على ثلاثمئةِ حرفٍ قبل الرابط يُفتَّش فيها عن
     `awaitingDiscounts`. فسقط: تلك الأحرفُ ذيلُ اللوحة **التي قبله** لا
     شرطٌ يلفّه. فصار المقيسُ ما يسبق الوسمَ مباشرةً: فتحُ شرطٍ
     (`&& (` أو `? (`) يعني أنّه بداخله. */
  it('ولا يُعلَّق على وجود خصمٍ ينتظر', () => {
    /* والسطحُ المقصودُ لا أوّلَ سطحٍ في الملفّ: `Inset` مستعمَلةٌ في هذه
       الشاشة قبله، فـ`indexOf` يقع على غيره ويُفحَص ما ليس المقصود. */
    const link = page.indexOf('to="/trainer/referral"')
    expect(link, 'لا رابطَ للدلالة').toBeGreaterThan(-1)
    const at = page.lastIndexOf('<Inset', link)
    expect(at, 'الرابطُ ليس على سطحٍ من سطوح المنصّة').toBeGreaterThan(-1)
    const before = page.slice(0, at).trimEnd()
    for (const opener of ['&& (', '? (', '&&(']) {
      expect(before.endsWith(opener), `الدلالةُ داخلَ شرطٍ يُفتَح بـ«${opener}»`).toBe(false)
    }
  })

  it('ويقول أين يُحسَم كما يقول أين يُصدَر', () => {
    const at = page.indexOf('to="/trainer/referral"')
    const block = page.slice(at, at + 700)
    expect(block, 'لا يُقال أين يُحسَم').toMatch(/تُحسم من كشفك/)
    expect(block, 'لا إحالةَ إلى بند العقد').toContain('4-10')
  })
})
