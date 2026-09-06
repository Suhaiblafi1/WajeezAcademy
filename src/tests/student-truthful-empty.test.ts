/* أربعةُ أعطابٍ في أوّل شاشةٍ يراها الطالب — وحرسُها.

   كلُّها في الحالة التي لم تُجرَّب: **حسابٌ بلا صفِّ تسجيل**. وحساباتُ الديمو
   مسجَّلةٌ كلُّها، فلم تظهر في أيّ جولة.

   ① **«حسابك جاهز — بقيت أوّل شعبة» لمن سجّل فعلا.** الشرطُ يفحص إشارةً
      واحدةً (هل يوجد تسجيل؟) وهي أضيقُ أربعٍ متاحة. فطالبٌ **دفع للتوّ**
      وعنده مقعدٌ محجوزٌ يقرأها، ومن اعتمد خطّةً بعد تشخيصه يقرأها.

   ② **الخطّةُ تضيع عند إنشاء الحساب.** تُعتمد قبل الحساب فيُردّ رفعُها بـ٤٠١
      ويُبتلع الفشلُ عمدا، **ولا شيءَ يعيد الرفعَ بعد الدخول**.

   ③ **النصُّ يصف مسارا أُلغي**: «اطلب التسجيل؛ عند موافقة العمليّات تصلك
      فاتورتك» — والقرارُ المسجَّل أنّ الشراءَ مباشر. ومعه رابطٌ إلى تحويلٍ
      ينتهي إلى رسالةِ فراغٍ ثانيةٍ مختلفة.

   ④ **شاشةُ «تفقّد بريدك» تَعِد برسالةٍ لا تُرسَل**، وزرُّها كان **لا يفعل
      شيئا** ثمّ تقول الشاشةُ «أُعيد إرسال الرسالة».

   والمقيسُ هنا بنيةُ الشيفرة لا مظهرُها: هذه شاشاتٌ تُقرأ بالعين، والحارسُ
   يمنع عودةَ السبب لا يرسم الشكل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const dashboard = read('src/pages/student/Dashboard.tsx')
const auth = read('src/services/auth.ts')
const gate = read('src/components/AuthGate.tsx')
const portal = read('src/pages/student/PortalLayout.tsx')
const journey = read('src/pages/student/Journey.tsx')
const inbox = read('src/pages/student/Inbox.tsx')
const rate = read('src/pages/student/RateMyLearning.tsx')

describe('① حالةُ اللوحة تُشتقّ من أربعة مصادر لا من واحد', () => {
  it('تقرأ المقاعدَ المحجوزةَ والطلباتِ والخطّة — لا التسجيلاتِ وحدَها', () => {
    for (const path of ['/api/learner/held-seats', '/api/learner/orders', '/api/learner/plan']) {
      expect(dashboard, `اللوحةُ لا تقرأ ${path}`).toContain(path)
    }
  })

  it('ولكلّ حالةٍ شاشتُها — لا رسالةٌ واحدةٌ للجميع', () => {
    expect(dashboard).toContain('مقعدُك محجوز')
    expect(dashboard).toContain('لم يكتمل دفعُه')
    expect(dashboard).toContain('خطّتُك جاهزة')
  })

  it('وفشلُ إشارةٍ لا يُفرِّغ اللوحة — لكلٍّ التقاطُها', () => {
    /* ثلاثةُ `catch` على الأقلّ: واحدٌ لكلّ نداءٍ إضافيّ */
    const catches = dashboard.match(/\.catch\(\(\) =>/g) ?? []
    expect(catches.length).toBeGreaterThanOrEqual(3)
  })
})

describe('② الخطّةُ تُرفَع فورَ الدخول', () => {
  it('`signIn` ينادي رفعَ الخطّة المحفوظة', () => {
    expect(auth, 'لا رفعَ بعد الدخول — تبقى الخطّةُ في المتصفّح وحدَه').toContain('syncPendingPlan')
  })

  it('ولا يُسقط الدخولَ عند فشله — أفضلُ جهد', () => {
    expect(auth).toMatch(/void syncPendingPlan\(\)/)
  })
})

describe('③ النصُّ يصف الشراءَ المباشر، والروابطُ تذهب إلى وجهتها', () => {
  it('لا ذكرَ لموافقة العمليّات في لوحة البداية', () => {
    expect(dashboard, 'ما زالت توجّه إلى المسار الذي أُلغي').not.toContain('موافقة العمليات')
  })

  /* يُقاس هدفُ الرابط لا نصُّ الشرح: `to="/student/pathway"` و`to: "/student/pathway"`
     هما الشكلان اللذان يصنعان تحويلا، أمّا ذكرُ المسار في تعليقٍ فلا يحوّل أحدا. */
  it('ولا رابطَ إلى `/student/pathway` — وهو تحويلٌ ينتهي إلى رسالةِ فراغٍ ثانية', () => {
    for (const [name, source] of [
      ['لوحة البداية', dashboard],
      ['صندوق الرسائل', inbox],
      ['تقييم تعلّمي', rate],
    ] as const) {
      expect(source, `${name} ما زالت تحيل إلى تحويل`).not.toMatch(/to[:=]\s*"\/student\/pathway"/)
    }
  })

  it('ولا مسارَ طلبٍ منافسٍ في شاشة الرحلة — الشراءُ في بطاقة المرحلة', () => {
    expect(journey, 'زرُّ «اطلب تسجيلك» يفتح المسارَ الذي يُنتج «لم تُدفع»')
      .not.toContain('/api/learner/plan/enrollment-request')
  })
})

describe('④ لا وعدَ برسالةٍ لا تُرسَل', () => {
  it('شاشةُ «تفقّد بريدك» مشروطةٌ بخروج الرسالة فعلا', () => {
    expect(gate).toContain('result.verificationSent')
  })

  it('وزرُّ إعادة الإرسال ينادي الخادمَ ويعرض ردَّه — لا تأكيدا تكتبه الشاشة', () => {
    expect(auth, 'الدالّةُ ما زالت لا تفعل شيئا').toContain('/api/auth/email/verify/request')
    expect(gate).not.toContain('أُعيد إرسال الرسالة — تفقد بريدك')
  })

  it('وشريطُ التوثيق لا يُعرض والقناةُ مغلقة — الحاجزُ غيرُ مفروضٍ حينها', () => {
    expect(portal).toContain('emailChannel !== false')
  })
})
