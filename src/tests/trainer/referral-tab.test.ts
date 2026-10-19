/* «دعوتي» تبويبٌ قائمٌ بنفسه (ب-٥ · ف-١).

   كان رابطُ المدرّب بطاقةً في «الرئيسية» بين طابور العمل وجلساتِه القادمة،
   فيراه مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة
   (١٣ سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به **بعد «ما قيل عنّي» مباشرةً**.

   والمحروسُ ثلاثةٌ لا واحد:
   · الموضعُ في الشريط — «بعده مباشرةً» طلبٌ صريحٌ لا تفصيلُ تصميم.
   · وأنّه **نُقل** لا نُسخ: بطاقتان تفترقان يوما، ويُقرأ الرقمُ فيهما
     مختلفا — وهو رقمُ مالٍ يُدفع عليه.
   · وأنّ الرقمَ لا يُكتب في الصفحة: أجرُ الإحالة مصدرُه «مستحقاتي» لكلّ
     شعبةٍ بعينها، ورقمٌ منسوخٌ هنا يُقرأ وعدا لا يُوفى. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('«دعوتي» لها تبويبها', () => {
  /* ═══ وصار قسما في «مستحقاتي» لا لسانا (الخطوة G، ١٩ أكتوبر ٢٠٢٦) ═══
     درس صاحبُ المنصّة جانبَ المدرّب واختار القائمةَ ثمانيةَ ألسنة: «دعوتي» و«عقدي» في «مستحقاتي»،
     و«ما قيل عنّي» في «الرئيسية». فنُسخ «بعد «ما قيل عنّي» مباشرةً» (١٣ سبتمبر) بقرارٍ أحدث. والمحروسُ
     الباقي هو هو: بابٌ يبلغه، ومسارُه القديمُ لا يقود إلى «لا شيء»، ونُقل ولم يُنسخ، ولا رقمَ فيه. */
  it('⚠️ قسمٌ في «مستحقاتي» يبلغه لسانُها', () => {
    const earnings = code('src/pages/trainer/Earnings.tsx')
    expect(earnings).toMatch(/\{ id: "referral", label: "دعوتي" \}/)
    expect(earnings).toMatch(/section === "referral" && <Referral \/>/)
    expect(code('src/pages/trainer/TrainerLayout.tsx')).toMatch(/to: "\/trainer\/earnings", label: "مستحقاتي"/)
  })

  it('⚠️ والمسار القديم يُحال إلى قسمه — وإلّا فرابطٌ في رسالةٍ يقود إلى «لا شيء»', () => {
    expect(code('src/App.tsx')).toMatch(/path="\/trainer\/referral" element=\{<Navigate to="\/trainer\/earnings\?tab=referral" replace \/>\}/)
  })

  it('⚠️ ونقل ولم ينسخ — لا بطاقة رابط ثانية في «الرئيسية»', () => {
    /* نسختان تفترقان يوما، والرقمُ فيهما رقمُ مالٍ يُدفع عليه. */
    const dash = code('src/pages/trainer/TrainerDashboard.tsx')
    expect(dash, 'بطاقة الرابط ما زالت في الرئيسية').not.toContain('انسخ الرابط')
    expect(dash, 'الرئيسية ما زالت تنادي الرابط').not.toContain('/api/trainer/me/referral')
  })

  it('⚠️ والصفحة تحيل أجر الإحالة إلى «مستحقاتي» ولا تكتب رقما', () => {
    /* ف-١ يقول «كما هو مبيَّنٌ في المستحقات» — والرقمُ يختلف بين شعبةٍ
       وأخرى (`referralRate` لكلّ اتّفاق)، فرقمٌ واحدٌ هنا كذبٌ على بعضها. */
    const page = read('src/pages/trainer/Referral.tsx')
    expect(page, 'لا إحالة إلى مستحقاتي').toContain('/trainer/earnings')
    expect(code('src/pages/trainer/Referral.tsx'), 'رقم أجر مكتوب في الصفحة')
      .not.toMatch(/\d+\s*(٪|%|دينار|دولار)/)
  })

  it('وتفتتح بسؤال لا بشرح — وهو نصّ ف-١', () => {
    expect(read('src/pages/trainer/Referral.tsx')).toContain('ما الذي توصي به من يتابعك؟')
  })
})
