/* شاشةُ المدرّب تبدأ لقاءه مضيفا (٢٩ سبتمبر ٢٠٢٦).

   الخادمُ يحرس الرابطَ (`server/tests/zoom/host-start.test.ts`)، وهنا ما تفعله
   الشاشةُ به: اجتماعُ المنصّة يُبدأ بطلبٍ لحظةَ الضغط لا برابط المشارك، والنافذةُ
   تُفتح قبل الطلب كي لا يحجبها المتصفّح، والرابطُ الملصَقُ بيدٍ يبقى كما هو.

   والشاشةُ تجلب لقاءاتِها في `useEffect` فلا تُرسَم ساكنةً بما فيها — فالفحصُ على
   بنيتها بلا تعليقاتها، كأخواتها في `buy-panel-fold.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = readFileSync(join(process.cwd(), 'src/pages/trainer/SessionsAndAttendance.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const startFn = code.slice(code.indexOf('const startAsHost'), code.indexOf('const removeSession'))

describe('ابدأ اللقاء مضيفا', () => {
  it('⚠️ يطلب رابطَ المضيف من الخادم لحظةَ الضغط — ولا يقرأ رابطا محفوظا', () => {
    expect(startFn.length, 'دالّةُ البدء غائبة').toBeGreaterThan(100)
    expect(startFn).toMatch(/apiPost<\{ startUrl: string \}>\(`\/api\/trainer\/sessions\/\$\{sessionId\}\/host-start`/)
    expect(startFn, 'يبدأ برابط المشارك').not.toMatch(/joinUrl/)
  })

  it('⚠️ والنافذةُ تُفتح قبل الطلب — وإلّا حجبها المتصفّحُ بعد انتظار الردّ', () => {
    const open = startFn.indexOf('window.open(')
    const ask = startFn.indexOf('apiPost')
    expect(open, 'لا نافذةَ تُفتح').toBeGreaterThan(-1)
    expect(open, 'النافذةُ تُفتح بعد الطلب').toBeLessThan(ask)
    /* وإن حُجبت على كلّ حال انتقلت الصفحةُ نفسُها — لا يبقى بلا باب */
    expect(startFn).toMatch(/else window\.location\.assign\(startUrl\)/)
    /* والنافذةُ المفتوحةُ تُغلق إن سقط الطلب — لا تبقى صفحةٌ فارغة */
    expect(startFn).toMatch(/catch[\s\S]*win\?\.close\(\)/)
  })

  it('⚠️ واجتماعُ المنصّة بزرّ البدء — ورابطُ المشارك للملصَق وحدَه', () => {
    expect(code).toMatch(/s\.zoom\?\.provider === "zoom_api" && s\.zoom\.meetingId \? \(/)
    expect(code).toMatch(/onClick=\{\(\) => void startAsHost\(s\.id\)\}/)
    /* رابطُ المشارك في الفرع الآخر من الشرط نفسِه لا قبله */
    expect(code).toMatch(/\) : s\.zoom && \(\s*<a href=\{s\.zoom\.joinUrl\}/)
  })

  it('والمنتظِرُ والمنعقدُ بلا زرّ — الخادمُ يردّ الأوّل، والثاني انتهى', () => {
    expect(code).toMatch(/\(s\.approvalState \?\? "approved"\) === "approved" && s\.status !== "done" && \(\s*<Button[\s\S]{0,200}startAsHost/)
  })
})
