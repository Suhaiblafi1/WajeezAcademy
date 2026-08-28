/* حارس ضد عودة المحاكاة إلى البوابات.
   ------------------------------------------------------------------
   كانت البوابة تعمل على متجرٍ محليّ (`src/data/student.ts`) يبذر تسجيلات
   وإشعاراتٍ منها «وصلت فاتورتك وتأكيد الدفع على بريدك»، ويسكّ شهادةً برقم
   عشوائي، ويعتمد الواجب آليا بعد ١٢ ثانية بدرجة ٨٨ وملاحظةٍ منسوبةٍ إلى
   المدرّب، ويخترع اختبارا وجلستَي زووم لكل دورة. ومثلُه `src/data/advisor.ts`
   يولّد للمستشار قائمةَ طلبةٍ وأخطارَهم في المتصفّح.
   حُذف الملفّان وصفحاتُهما. وهذا الحارس يجعل عودتهما حمراء لا صامتة. */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** كل ملفات .ts/.tsx تحت مجلّد */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return filesUnder(p)
    return /\.tsx?$/.test(e.name) ? [p] : []
  })
}

describe('لا محاكاة في البوابات', () => {
  it('ملفّات المحاكاة محذوفة ولم تعد', () => {
    for (const f of [
      'data/student.ts', 'data/advisor.ts', 'data/trainer.ts', 'data/admin.ts',
      'data/admin-extras.ts', 'data/billing.ts', 'data/cv.ts', 'data/showcase.ts',
      'components/SimulationNote.tsx', 'components/StripeCheckout.tsx',
      'components/PrototypeBanner.tsx', 'components/DemoRoleSwitcher.tsx',
      'pages/advisor/advisor-identity.ts', 'pages/trainer/trainer-identity.ts',
      'services/access.ts',
      /* كتب وجيز كانت مكتبةً مخترعة: عناوين منسوبة إلى «فريق وجيز» بمدد
         استماعٍ واختباراتٍ مولَّدة، وجزيرةٌ لا تستوردها صفحة. المكتبة الحقيقية
         (١د) تقرأ من مصدر الكتالوج وتفتح روابط خارجية. */
      'services/wajeezBooks.ts', 'services/courseResources.ts',
      'components/BookSummaryCard.tsx', 'components/CourseResources.tsx',
      'components/PathwayResources.tsx', 'components/AudioPlayer.tsx',
    ]) {
      expect(existsSync(join(SRC, f)), `${f} عاد إلى المستودع`).toBe(false)
    }
  })

  it('لا صفحة تستورد متجر محاكاة', () => {
    const offenders: string[] = []
    for (const f of [...filesUnder(join(SRC, 'pages')), ...filesUnder(join(SRC, 'components'))]) {
      const body = readFileSync(f, 'utf8')
      for (const bad of [
        'data/student', 'data/advisor', 'data/trainer', 'data/admin', 'data/billing',
        'data/cv', 'data/showcase', 'SimulationNote', 'StripeCheckout', 'PrototypeBanner',
        'services/access', 'wajeezBooks', 'courseResources', 'BookSummaryCard',
      ]) {
        /* `ComposedCourseView` وأمثالُه أسماءُ أنواعٍ لا استيراد وحدة */
        if (new RegExp(`from ["'][^"']*${bad}["']`).test(body)) offenders.push(`${f} ← ${bad}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('لا اعتماد آليّ ولا سكّ شهادة ولا جلسة مخترعة في أي صفحة', () => {
    const banned: [RegExp, string][] = [
      [/وصلت فاتورتك/, 'إشعار فاتورة مبذور'],
      [/تم تأكيد شعبتك/, 'إشعار تأكيد شعبة مبذور'],
      [/issueCertificate/, 'سكّ شهادة في المتصفّح'],
      [/7:00–8:30/, 'موعد جلسة ثابت مخترع'],
      [/محاكاة المراجعة البشرية/, 'اعتماد آليّ لواجب'],
      [/أ\. ريم القحطاني|د\. فيصل العتيبي|م\. سلطان الدوسري|م\. لينا الحربي/, 'اسم مدرّب مختلَق'],
      [/grantEnrollment/, 'استحقاق يُمنح من المتصفّح'],
      [/setTimeout\(\s*onSuccess/, 'نجاحُ عمليةٍ بمؤقّت لا بردّ خادم'],
    ]
    const offenders: string[] = []
    for (const f of filesUnder(join(SRC, 'pages'))) {
      const body = readFileSync(f, 'utf8')
      for (const [re, why] of banned) if (re.test(body)) offenders.push(`${f}: ${why}`)
    }
    expect(offenders).toEqual([])
  })
})
