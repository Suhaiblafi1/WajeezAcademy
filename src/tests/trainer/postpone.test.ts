/* نقلُ لقاءٍ معتمَدٍ داخلَ موعد محوره يبقى معتمَدا — القاعدةُ بحدودها (٢٩ سبتمبر ٢٠٢٦).

   كان هذا الملفُّ يحرس «التأجيلَ القريب» وحده (٣ج): ما بعده أقلُّ من ثمانٍ وأربعين
   ساعةً يُؤجَّل فيبقى معتمَدا، وما عداه — البعيدُ والمقدَّم — يرجع إلى الانتظار. ثمّ
   قال صاحبُ المنصّة في النقل: «free it, keep it inside the axis window» — فتغيّر
   القرارُ فتغيّر حارسُه. والتأجيلُ القريبُ باقٍ حيث لا موعدَ معروفا للمحور (③).

   العلّةُ كاملةً في رأس `application/trainer/postpone.ts`. وأثرُها في الخادم —
   يبقى معتمَدا، ويُنقل اجتماعُه، ويُبلَّغ مسجَّلوه — في
   `server/tests/learning/postpone-near-meeting.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POSTPONE_WINDOW_MS, keepsApprovalOnMove } from '@/application/trainer/postpone'

const SCREEN = readFileSync(join(process.cwd(), 'src/pages/trainer/SessionsAndAttendance.tsx'), 'utf8')

const H = 3_600_000
const now = new Date('2027-02-10T09:00:00.000Z')
/* موعدُ المحور: الأحد ٧ إلى السبت ١٣ فبراير بعمّان — من ٦ فبراير ٢١:٠٠ بغرينتش إلى ١٣ فبراير ٢٠:٥٩:٥٩ */
const slot = { startsOn: '2027-02-07', endsOn: '2027-02-13' }
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * H)
const base = { approved: true, startsAt: at(24), newStartsAt: at(48), newEndsAt: at(50), now, slot }
const to = (iso: string, hours = 2) => ({ newStartsAt: new Date(iso), newEndsAt: new Date(new Date(iso).getTime() + hours * H) })

describe('① داخل موعد محوره يبقى معتمدا — مقدّما أو مؤجّلا، قريبا أو بعيدا', () => {
  it('⚠️ تأجيل لقاء قريب يوما في موعده', () => {
    expect(keepsApprovalOnMove(base)).toBe(true)
  })

  it('⚠️ وتأجيل لقاء بعيد — وكان يرجع إلى الانتظار قبل القرار', () => {
    expect(keepsApprovalOnMove({ ...base, startsAt: at(60), ...to('2027-02-13T15:00:00.000Z') })).toBe(true)
  })

  it('⚠️ والتقديم كذلك — وكان يرجع إلى الانتظار ولو كان قريبا', () => {
    expect(keepsApprovalOnMove({ ...base, ...to('2027-02-10T12:00:00.000Z') })).toBe(true)
    expect(keepsApprovalOnMove({ ...base, startsAt: at(80), ...to('2027-02-08T15:00:00.000Z') })).toBe(true)
  })

  it('ولقاء بدأ أو مضى يعاد إلى موعد في موعد محوره — لا حدّ قرب هنا', () => {
    expect(keepsApprovalOnMove({ ...base, startsAt: at(-2), ...to('2027-02-12T15:00:00.000Z') })).toBe(true)
  })

  it('وحدّا الموعد بعمّان داخله: أوّل لحظة فيه، وآخر لحظة ينتهي فيها', () => {
    expect(keepsApprovalOnMove({ ...base, newStartsAt: new Date('2027-02-06T21:00:00.000Z'), newEndsAt: new Date('2027-02-06T23:00:00.000Z') })).toBe(true)
    expect(keepsApprovalOnMove({ ...base, newStartsAt: new Date('2027-02-13T18:59:59.999Z'), newEndsAt: new Date('2027-02-13T20:59:59.999Z') })).toBe(true)
  })
})

describe('② وما خرج عنه يرجع إلى الانتظار — بقاعدة الإرسال نفسها', () => {
  it('⚠️ بدءا قبله أو بعده', () => {
    expect(keepsApprovalOnMove({ ...base, ...to('2027-02-13T21:00:00.000Z') }), 'بدأ بعد آخر الموعد').toBe(false)
    expect(keepsApprovalOnMove({ ...base, ...to('2027-02-06T20:00:00.000Z') }), 'بدأ قبل أوّل الموعد').toBe(false)
  })

  it('⚠️ أو نهاية بعده', () => {
    expect(keepsApprovalOnMove({
      ...base, newStartsAt: new Date('2027-02-13T19:00:00.000Z'), newEndsAt: new Date('2027-02-13T21:30:00.000Z'),
    }), 'نهايته خارج موعده ومرّ').toBe(false)
  })

  it('⚠️ وبلا نهاية مكتوبة تحسب أدنى مدّة اللقاء — كما يحسبها الإرسال', () => {
    expect(keepsApprovalOnMove({ ...base, newStartsAt: new Date('2027-02-13T20:30:00.000Z'), newEndsAt: null }), 'لقاء بلا نهاية عدّ لحظة').toBe(false)
  })

  it('⚠️ والمنتظر لا اعتماد يحفظ له', () => {
    expect(keepsApprovalOnMove({ ...base, approved: false })).toBe(false)
  })
})

describe('③ وحيث لا موعد معروفا لمحوره — التأجيل القريب كما كان (٣ج)', () => {
  const legacy = { ...base, slot: null }

  it('⚠️ تأجيل قبل ثمان وأربعين ساعة — ما دونها لا ما بلغها', () => {
    expect(keepsApprovalOnMove(legacy)).toBe(true)
    const lead = (ms: number) => ({ ...legacy, startsAt: new Date(now.getTime() + ms), newStartsAt: new Date(now.getTime() + ms + H) })
    expect(keepsApprovalOnMove(lead(POSTPONE_WINDOW_MS - 1))).toBe(true)
    expect(keepsApprovalOnMove(lead(POSTPONE_WINDOW_MS))).toBe(false)
  })

  it('⚠️ والتقديم، والنقل إلى الموعد نفسه، ولقاء بدأ — يرجع إلى الانتظار', () => {
    expect(keepsApprovalOnMove({ ...legacy, newStartsAt: at(20) })).toBe(false)
    expect(keepsApprovalOnMove({ ...legacy, newStartsAt: legacy.startsAt })).toBe(false)
    expect(keepsApprovalOnMove({ ...legacy, startsAt: at(-2), newStartsAt: at(5) })).toBe(false)
  })

  it('وموعد معطوب كلا موعد', () => {
    expect(keepsApprovalOnMove({ ...base, slot: { startsOn: '2027-02-31', endsOn: 'x' } }), 'موعد معطوب حكم به').toBe(true)
    expect(keepsApprovalOnMove({ ...base, startsAt: at(60), slot: { startsOn: '2027-02-31', endsOn: 'x' } })).toBe(false)
  })
})

describe('وشاشة المدرّب تقول ما حكم به الخادم', () => {
  /* الشاشةُ لا تحكم بالقاعدة — لا تعرف موعدَ المحور في الخطّة المعتمَدة — فتقرأ
     حالَ اللقاء كما عاد من النقل. ولو ثبتت رسالتُها لقالت «يعود للاعتماد» عن
     لقاءٍ بقي معتمَدا ووصل متعلّميه */
  it('⚠️ رسالة النقل من حال اللقاء العائد — لا نصّ واحد ثابت', () => {
    /* والمتنُ يحمل سببَ النقل منذ ٢٨ أكتوبر ٢٠٢٦ (`reasonAr`) — فاتّسع ما بين القوسين */
    expect(SCREEN).toMatch(/const moved = \(await apiPatch\(`\/api\/trainer\/sessions\/\$\{sessionId\}`, \{[\s\S]{0,400}\}\)\) as \{ approvalState\?: string \};/)
    /* وكانت «أُجِّل الموعد» — والمنقولُ داخلَ موعده قد يُقدَّم */
    expect(SCREEN).toMatch(/\}, \(r\) => \(\(r as \{ approvalState\?: string \} \| null\)\?\.approvalState === "approved"\s*\? "نقل الموعد وبقي معتمدا/)
  })

  it('⚠️ ولوحة النقل تقول القاعدة قبل الضغط: داخل موعد محوره يبقى، وخارجه يعود', () => {
    expect(SCREEN).toMatch(/وما تنقله <b>داخل موعد محوره<\/b> يبقى معتمدا/)
    expect(SCREEN).toMatch(/وما تنقله خارجه <b>يعود لانتظار الإدارة<\/b>/)
    expect(SCREEN, 'عادت اللوحة تقول إنّ التأجيل القريب وحده يبقى').not.toMatch(/تأجيل لقاء معتمد يبدأ خلال يومين/)
  })
})
