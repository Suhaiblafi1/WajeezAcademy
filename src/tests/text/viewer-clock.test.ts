/* ═══ الساعةُ بتوقيت عمّان — وساعةُ الجهاز معها إن خالفتها (٢١ أكتوبر ٢٠٢٦) ═══

   اختارت مدرّبةٌ الحاديةَ عشرةَ ليومٍ في ديسمبر فرأته العاشرة: المنسّقاتُ كانت تقرأ اللحظةَ
   بساعة جهازها، وجهازُها على توقيت بيروت — ساعةٌ خلفَ عمّان في الشتاء وحدَه. واختار صاحبُ
   المنصّة (الخيارَ ٣): ساعةُ عمّان في كلّ موضع، وساعةُ الجهاز معها حين تخالفها.

   ومنطقةُ الجهاز تُبدَّل هنا بـ`TZ` — وNode يقرؤها لحظةَ تتبدّل. و`window` يُنصَب ليُرى
   المنسّقُ في متصفّح، ويُرفع ليُرى على الخادم: هناك لا جهازَ يُقرأ. */
import { afterEach, describe, expect, it } from 'vitest'
import { fmtClock24, fmtDate, fmtDateWith, fmtSession, fmtTime } from '@/application/text/format-ar'

/** الحاديةَ عشرةَ صباحا بعمّان يومَ ٨ ديسمبر — كما يكتبها `zonedInstant` */
const DEC = '2026-12-08T08:00:00.000Z'
/** والساعةُ نفسُها في أكتوبر — وبيروت فيه على صيفيّتها، كعمّان */
const OCT = '2026-10-21T08:00:00.000Z'

const g = globalThis as { window?: unknown }
const before = { tz: process.env.TZ, window: g.window }

function viewer(zone: string | null) {
  if (zone === null) delete g.window
  else g.window = globalThis
  process.env.TZ = zone ?? 'UTC'
}

afterEach(() => {
  process.env.TZ = before.tz
  if (before.window === undefined) delete g.window
  else g.window = before.window
})

describe('الساعة بتوقيت عمّان — وساعة الجهاز معها إن خالفتها', () => {
  it('⚠️ جهازٌ على بيروت في ديسمبر: الحادية عشرة بعمّان والعاشرة بتوقيته — لا العاشرة وحدها', () => {
    viewer('Asia/Beirut')
    const s = fmtSession(DEC)
    expect(s).toMatch(/^الثلاثاء، 8 ديسمبر، 11:00 ص بتوقيت عمّان · 10:00 ص بتوقيتك$/)
    expect(fmtTime(DEC)).toBe('11:00 ص بتوقيت عمّان · 10:00 ص بتوقيتك')
    expect(fmtClock24(DEC)).toBe('11:00 بتوقيت عمّان · 10:00 بتوقيتك')
  })

  it('وفي أكتوبر بيروت كعمّان — فلا يُلحق شيء', () => {
    viewer('Asia/Beirut')
    expect(fmtSession(OCT)).toBe('الأربعاء، 21 أكتوبر، 11:00 ص')
  })

  it('ومن جهازُه على عمّان لا يرى زيادة', () => {
    viewer('Asia/Amman')
    expect(fmtSession(DEC)).toBe('الثلاثاء، 8 ديسمبر، 11:00 ص')
  })

  it('واليومُ الآخرُ يُسمّى — منتصفُ الليل بعمّان مساءُ أمسٍ في القاهرة', () => {
    viewer('Africa/Cairo')
    expect(fmtTime('2026-12-08T21:30:00.000Z')).toBe('12:30 ص بتوقيت عمّان · الثلاثاء 11:30 م بتوقيتك')
  })

  it('وعلى الخادم عمّان وحدها — لا ساعةَ لجهازٍ لا يُرى، ولا ساعةَ غرينتش', () => {
    viewer(null)
    expect(fmtSession(DEC)).toBe('الثلاثاء، 8 ديسمبر، 11:00 ص')
  })

  it('واليومُ يومُ عمّان بلا لاحقة — بدءُ الشعبة منتصفُ ليلها لا مساءُ أمسها', () => {
    viewer('Asia/Beirut')
    expect(fmtDateWith('2026-12-07T21:00:00.000Z', { day: 'numeric', month: 'long' })).toBe('8 ديسمبر')
    expect(fmtDate('2026-12-07T21:00:00.000Z')).not.toMatch(/بتوقيت/)
  })

  it('ومن مرّر منطقته بنفسه تُحترم — بلا لاحقة', () => {
    viewer('Asia/Beirut')
    expect(fmtDateWith(DEC, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Beirut' })).toBe('10:00 ص')
  })
})
