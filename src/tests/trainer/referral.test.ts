/* رابطُ دعوة المدرّب — من الصفحة إلى الدفع إلى الكشف.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): سعرٌ واحدٌ للطالب، وأجران للمدرّب، ورابطٌ
   لكلّ شعبة، وعلامةٌ عند اسم كلّ طالبٍ تقول من أين جاء. والفحصُ على البنية —
   الشيفرةُ بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('رابطُ دعوة المدرّب', () => {
  it('صفحةُ الدورة تلتقط `?ref` وتحفظه للجلسة — والدفعُ يرسله', () => {
    expect(code('src/pages/CoursePath.tsx')).toMatch(/searchParams\.get\("ref"\)/)
    expect(code('src/pages/CoursePath.tsx')).toContain('sessionStorage.setItem(REFERRAL_KEY')
    const buy = code('src/components/BuyPanel.tsx')
    /* إلى إغلاق النداء نفسِه لا أوّلِ `})` — فوسطَه انتشاراتٌ تُغلق قبله */
    const post = /apiPost<CheckoutResult>\("\/api\/learner\/checkout", \{[\s\S]*?\n\s*\}\)/.exec(buy)?.[0] ?? ''
    expect(post, 'نداءُ الدفع مفقود').toBeTruthy()
    expect(post, 'الرمزُ لا يصل الدفع').toContain('referralCode')
  })

  it('والسعرُ على الطالب واحد — لا خصمَ بالرمز في التسعير', () => {
    const svc = code('server/services/commerce.service.ts')
    const checkout = /async checkout\([\s\S]*?\n {2}\}\n/.exec(svc)?.[0] ?? ''
    expect(checkout).toBeTruthy()
    expect(checkout, 'الرمزُ يدخل التسعير').not.toMatch(/priceFor\([^)]*referral/)
    expect(checkout, 'الرمزُ لا يُحمل مع الحجز').toContain('referralCode')
  })

  it('والمصدرُ يُختم على التسجيل ولا يُكتب فوقَه', () => {
    const svc = code('server/services/enrollment.service.ts')
    expect(svc).toContain('referralProfileId: referral.profileId')
    expect(svc, 'الختمُ الأوّل لا يُصان').toContain('existing.referralProfileId ? {} : stamp')
  })

  /* ⚠️ كان هذا الحارسُ أخضرَ لسببٍ خاطئ (١٥ سبتمبر ٢٠٢٦).

     كان يشترط ورودَ «عبر رابطك» في `CohortWorkspace` ويعدّه دليلا على أنّ
     المدرّبَ يرى العلامةَ عند اسم المتعلّم هناك. ولم تكن هناك علامةٌ قطّ:
     الحرفانِ كانا في **نثر بطاقة الدعوة** — «وتراه بعلامة عبر رابطك عند
     اسمه» — أي في وعدٍ بالعلامة لا في العلامة. والورشةُ لا تعرض قائمةَ
     متعلّمين أصلا منذ انتقلت إلى «طلبتي».

     فلمّا خرجت البطاقةُ إلى «دعوتي» سقط الحارسُ — وكشف أنّه كان يحرس نصًّا
     لا بنية. وهو بعينه ما نهى عنه `CLAUDE.md`: «الفحصُ على البنية لا على
     ورودِ حرفٍ في ملفّ».

     فصار على الموضع الذي تُصيَّر فيه العلامةُ فعلا — شارةٌ مشروطةٌ
     بـ`referredByMe` بجوار الاسم في «طلبتي». */
  it('والمدرّبُ يرى العلامةَ عند الاسم — شارةً مشروطةً لا نثرا يَعِد بها', () => {
    const learners = code('src/pages/trainer/MyLearners.tsx')
    expect(learners, 'العلامةُ لا تُصيَّر عند الاسم').toMatch(/\{r\.referredByMe && [\s\S]{0,160}عبر رابطك/)
    /* والخادمُ يُرسل الرايةَ التي تشترطها الشارة */
    expect(code('server/services/enrollment.service.ts')).toContain('referredByMe: e.referralProfileId === profile.id')
    /* ولا يخرج معرّفُ المدرّب — العلامةُ وحدَها */
    expect(code('server/services/enrollment.service.ts')).toContain('referralProfileId: undefined')
  })

  /* ═══ وموضعُ الروابط: «دعوتي» لا داخلَ كلّ شعبة (١٥ سبتمبر ٢٠٢٦) ═══

     كان رابطُ الشعبة بطاقةً في «مركز التواصل» داخلَ الشعبة، فلا يجمع
     المدرّبُ روابطَ شعبه إلّا بفتح كلِّ واحدةٍ على حدة. وقرارُ صاحب
     المنصّة: تُجمع في «دعوتي» — رابطُ ملفّه الكامل، ورابطٌ منفصلٌ لكلّ
     شعبةٍ مفتوحة.

     والفحصُ على الطرفين معا: لو نُقل ولم يُحذف لبقي رابطان لشيءٍ واحدٍ في
     شاشتين — يفترقان يوما، ولا يدري ناسخُ أحدِهما أيَّهما نسخ. */
  it('وروابطُ الشعب في «دعوتي» — خرجت من «مركز التواصل»', () => {
    const referralPage = code('src/pages/trainer/Referral.tsx')
    const workspace = code('src/pages/trainer/CohortWorkspace.tsx')

    expect(referralPage, 'روابطُ الشعب لا تُقرأ في «دعوتي»').toContain('/api/trainer/me/referral-links')
    expect(referralPage, 'الرابطُ العامُّ سقط مع النقل').toContain('/api/trainer/me/referral')

    expect(workspace, 'رابطُ الشعبة ما زال داخلَ الشعبة').not.toContain('referral-link')
    expect(workspace, 'بطاقةُ الدعوة ما زالت في مركز التواصل').not.toContain('رابطُ دعوتك لهذه الشعبة')

    /* والخادمُ يردّ الرمزَ نفسَه لا رمزا جديدا لكلّ فتحة — لو تغيّر ضاع ما نُشر */
    const svc = code('server/services/referral.service.ts')
    expect(svc).toMatch(/async cohortLinksFor\(/)
    expect(svc, 'روابطُ الشعب لا تقتصر على المفتوحة').toMatch(/status: \{ in: \['open', 'active', 'full'\] \}/)
  })

  it('والكشفُ بندان: عامٌّ وعبر الرابط — وأجرُ الإحالة يُضبط من الإدارة', () => {
    const earn = code('server/services/earnings.service.ts')
    expect(earn).toContain('cohort:${cohortId}:referral')
    expect(code('src/pages/admin/TrainerOps.tsx')).toContain('referralRate')
    expect(code('src/pages/trainer/Earnings.tsx')).toContain('عبر رابطك')
  })
})
