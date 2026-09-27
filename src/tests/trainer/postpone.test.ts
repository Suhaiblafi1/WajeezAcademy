/* تأجيلُ لقاءٍ قريب يبقى معتمَدا — القاعدةُ بحدودها (٣ج).

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
/* موعدُ المحور: الأحد ٧ إلى السبت ١٣ فبراير بعمّان — آخرُه ٢٠:٥٩:٥٩ يومَ ١٣ بغرينتش */
const slot = { startsOn: '2027-02-07', endsOn: '2027-02-13' }
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * H)
const base = { approved: true, startsAt: at(24), newStartsAt: at(48), now, slot }

describe('يبقى معتمَدا — تأجيلٌ قريبٌ داخلَ موعده', () => {
  it('⚠️ لقاءٌ بعد يومٍ يُؤجَّل يوما في موعده نفسِه', () => {
    expect(keepsApprovalOnMove(base)).toBe(true)
  })

  it('⚠️ والحدُّ ثمانٍ وأربعون ساعةً قبله — ما دونها لا ما بلغها', () => {
    const lead = (ms: number) => ({ ...base, startsAt: new Date(now.getTime() + ms), newStartsAt: new Date(now.getTime() + ms + H) })
    expect(keepsApprovalOnMove(lead(POSTPONE_WINDOW_MS - 1))).toBe(true)
    expect(keepsApprovalOnMove(lead(POSTPONE_WINDOW_MS))).toBe(false)
  })

  it('وما لا مواعيدَ له يُحكم بالقُرب والتأجيل وحدَهما', () => {
    expect(keepsApprovalOnMove({ ...base, slot: null })).toBe(true)
    expect(keepsApprovalOnMove({ ...base, slot: { startsOn: '2027-02-31', endsOn: 'x' } }), 'موعدٌ معطوبٌ حُكم به').toBe(true)
  })
})

describe('ويعود إلى الانتظار — ما عدا ذلك', () => {
  it('⚠️ التقديمُ لا التأجيل — ولا «نقلٌ» إلى الموعد نفسِه', () => {
    expect(keepsApprovalOnMove({ ...base, newStartsAt: at(20) })).toBe(false)
    expect(keepsApprovalOnMove({ ...base, newStartsAt: base.startsAt })).toBe(false)
  })

  it('⚠️ لقاءٌ بدأ أو مضى', () => {
    expect(keepsApprovalOnMove({ ...base, startsAt: now, newStartsAt: at(5) })).toBe(false)
    expect(keepsApprovalOnMove({ ...base, startsAt: at(-2), newStartsAt: at(5) })).toBe(false)
  })

  it('⚠️ خارجَ موعد محوره — بدءا أو نهاية', () => {
    /* آخرُ الموعد ٢٠:٥٩ بغرينتش يومَ ١٣ — و«بعد يومٍ» من ٩ صباحا يومَ ١٠ يقع يومَ ١١ */
    expect(keepsApprovalOnMove({ ...base, newStartsAt: new Date('2027-02-13T21:00:00.000Z') })).toBe(false)
    expect(keepsApprovalOnMove({
      ...base, newStartsAt: new Date('2027-02-13T19:00:00.000Z'), newEndsAt: new Date('2027-02-13T21:30:00.000Z'),
    }), 'نهايتُه خارجَ موعده ومرّ').toBe(false)
    expect(keepsApprovalOnMove({
      ...base, newStartsAt: new Date('2027-02-13T18:00:00.000Z'), newEndsAt: new Date('2027-02-13T20:00:00.000Z'),
    })).toBe(true)
  })

  it('⚠️ والمنتظِرُ لا اعتمادَ يُحفظ له', () => {
    expect(keepsApprovalOnMove({ ...base, approved: false })).toBe(false)
  })
})

describe('وشاشةُ المدرّب تقول ما حكم به الخادم', () => {
  /* الشاشةُ لا تحكم بالقاعدة — لا تعرف موعدَ المحور في الخطّة المعتمَدة — فتقرأ
     حالَ اللقاء كما عاد من النقل. ولو ثبتت رسالتُها لقالت «يعود للاعتماد» عن
     لقاءٍ بقي معتمَدا ووصل متعلّميه */
  it('⚠️ رسالةُ النقل من حال اللقاء العائد — لا نصٌّ واحدٌ ثابت', () => {
    expect(SCREEN).toMatch(/const moved = \(await apiPatch\(`\/api\/trainer\/sessions\/\$\{sessionId\}`, \{[\s\S]{0,240}\}\)\) as \{ approvalState\?: string \};/)
    expect(SCREEN).toMatch(/\}, \(r\) => \(\(r as \{ approvalState\?: string \} \| null\)\?\.approvalState === "approved"\s*\? "أُجِّل الموعد وبقي معتمَدا/)
  })
})
