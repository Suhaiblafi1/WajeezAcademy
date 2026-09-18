/* ═══ الأحكامُ الثلاثةُ للّقاءات، والجدولةُ سلسلةً (م٣) ═══

   قرارُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦):

     ١ · لقاءٌ لكلّ محورٍ على الأقلّ — **قائمٌ** ويحرسه `session-approval`.
     ٢ · كلُّ لقاءٍ ساعتان على الأقلّ — «في التحقّق وفي البوّابة معا».
     ٣ · نصيحةُ التباعد — «تُقال ولا تُفرَض».

   ومعها: «جدولٌ متكرّر» هو المختارُ سلفا، ومعاينةٌ تُرى قبل الإرسال،
   و«من الساعة/إلى الساعة» قائمتان لا حقلَ وقت.

   ── ولمَ فحصٌ سلوكيٌّ وبنيويٌّ معا ──

   القواعدُ في وحداتٍ نقيّةٍ تُختبَر بالسلوك (الحسابُ نفسُه). والوصلُ بينها
   وبين الشاشة والمسلك لا يُختبَر إلّا بنيويّا — فقاعدةٌ صحيحةٌ لا ينادِيها
   أحدٌ حارسٌ أخضرُ على شيءٍ لا يعمل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIN_SESSION_MINUTES, firstToFor, fromSlots, sessionMinutes, sessionTooShort,
  slotLabelAr, toMinutes, toSlotsFor,
} from '@/application/trainer/session-length'
import {
  MAX_SERIES, WEEKDAYS_AR, buildSeries, tooTight,
} from '@/application/trainer/session-series'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const SCHED = code('src/pages/trainer/TrainerSchedule.tsx')
const ROUTES = code('server/http/routes/learning-portal.routes.ts')

describe('② ساعتان لكلّ لقاءٍ حدًّا أدنى', () => {
  it('الحدُّ ساعتان — لا رقمٌ يُرتجَل في موضعَين', () => {
    expect(MIN_SESSION_MINUTES).toBe(120)
  })

  it('⚠️ لقاءٌ من عشر دقائقَ يُردّ — وكان يمرّ', () => {
    /* المفحوصُ الوحيدُ كان أنّ النهايةَ بعد البداية. فعشرُ دقائقَ تفي
       بالشرط، وتصير اجتماعَ زووم، وتصل المسجَّلين بتاريخها. */
    expect(sessionTooShort('2026-03-01T18:00:00Z', '2026-03-01T18:10:00Z')).toBe(true)
    expect(sessionMinutes('2026-03-01T18:00:00Z', '2026-03-01T18:10:00Z')).toBe(10)
  })

  it('والساعتان بالتمام تمرّان — الحدُّ حدٌّ لا ما فوقه', () => {
    expect(sessionTooShort('2026-03-01T18:00:00Z', '2026-03-01T20:00:00Z')).toBe(false)
    expect(sessionTooShort('2026-03-01T18:00:00Z', '2026-03-01T19:59:00Z')).toBe(true)
  })

  it('وما لا يُقرأ ليس قصيرا — يردّه فحصُ الصلاحيّة لا فحصُ الطول', () => {
    expect(sessionTooShort('ليس تاريخا', '2026-03-01T20:00:00Z')).toBe(false)
    expect(sessionMinutes('ليس تاريخا', '2026-03-01T20:00:00Z')).toBe(null)
  })

  it('⚠️ والمسلكُ يردّه كذلك — لا الشاشةُ وحدَها', () => {
    /* «في التحقّق وفي البوّابة معا». ومن نادى المسلكَ بلا شاشةٍ يُردّ. */
    expect(ROUTES, 'القاعدةُ غيرُ مستوردةٍ في المسلك')
      .toMatch(/import \{ SHORT_SESSION_AR, sessionTooShort \} from '\.\.\/\.\.\/\.\.\/src\/application\/trainer\/session-length'/)
    /* ⚠ والقصُّ عند `.parse(req.body)` لا بعددِ حروف: نافذةٌ من ٢٢٠٠ حرفٍ
       تتخطّى متنَ هذا المسلك إلى الذي يليه، فيمرّ الحارسُ على فحصٍ ليس
       فحصَه. والشرطُ يُطابَق بصدره `if (` كي لا يُبطَل بـ`false &&`
       ويبقى نصُّه في الملفّ. */
    const createAt = ROUTES.indexOf("'/api/trainer/cohorts/:id/sessions'")
    expect(createAt, 'لا مسلكَ إنشاء').toBeGreaterThan(0)
    const create = ROUTES.slice(createAt, ROUTES.indexOf('.parse(req.body)', createAt))
    expect(create, 'مسلكُ الإنشاء لا يفحص الطول').toContain('if (sessionTooShort(b.startsAt, b.endsAt)) {')
    expect(create, 'يفحص ولا يردّ').toContain('message: SHORT_SESSION_AR')
  })

  it('⚠️ وبابُ النقل يفحصه أيضا — وإلّا تُخطّي الحدَّ بنقلٍ وتقصير', () => {
    const at = ROUTES.indexOf("'/api/trainer/sessions/:sessionId'")
    expect(at, 'لا مسلكَ نقل').toBeGreaterThan(0)
    const move = ROUTES.slice(at, ROUTES.indexOf('.parse(req.body)', at))
    /* والنهايةُ اختياريّةٌ هنا، فما لم تُرسَل لا طولَ يُفحَص */
    expect(move, 'النقلُ لا يفحص الطول').toContain('if (b.endsAt && sessionTooShort(b.startsAt, b.endsAt)) {')
    expect(move, 'يفحص ولا يردّ').toContain('message: SHORT_SESSION_AR')
  })

  it('⚠️ والشاشةُ تمنع قبل النقر — لا بعد الرفض', () => {
    expect(SCHED, 'الشاشةُ لا تقرأ القاعدة').toContain('sessionTooShort')
    const at = SCHED.indexOf('disabled={busy ||')
    expect(at, 'لا شرطَ على زرِّ الإرسال').toBeGreaterThan(0)
    expect(SCHED.slice(at, at + 220), 'الزرُّ يُرسل ما يردّه المسلك').toContain('tooShort')
  })
})

describe('«من الساعة/إلى الساعة» قائمتان لا حقلَ وقت', () => {
  it('⚠️ لا `type="time"` في الشاشة — الحقلُ يخلط ص/م', () => {
    /* «الحقلُ اليومَ يخلط ص/م، فتُعتمَد جلسةٌ في السادسة صباحا» — والحرفُ
       الواحدُ يختلف رسمُه بالمتصفّح وبلغة النظام، وكلا الوقتَين صحيحٌ في
       يومٍ صحيح فلا ينبّه شيء. */
    expect(SCHED, 'عاد حقلُ الوقت').not.toMatch(/type="time"/)
    expect(SCHED, 'لا قائمةَ ساعات').toContain('slotLabelAr')
  })

  it('والفترةُ بحروفها — لا حرفٌ واحدٌ يُقرأ ضدَّه', () => {
    expect(slotLabelAr('06:00')).toBe('6:00 صباحا')
    expect(slotLabelAr('18:30')).toBe('6:30 مساءً')
    /* والظهرُ ساعتُه: «١٢ مساءً» تُقرأ خطأً، و«١٢ صباحا» أشدّ */
    expect(slotLabelAr('12:00')).toBe('12:00 ظهرا')
    expect(slotLabelAr('00:00')).toBe('12:00 صباحا')
  })

  it('⚠️ وسلّمُ «إلى» يبدأ من البداية زائدَ ساعتين — فالخطأُ لا يُعبَّر عنه', () => {
    /* القاعدةُ التي يُبنى عليها هذا: **الحالةُ الخاطئةُ لا يُعبَّر عنها**
       بدل أن تُشرَح بجملةٍ بعد الرفض. */
    const to = toSlotsFor('18:00')
    expect(to[0]).toBe('20:00')
    expect(to, 'سلّمُ «إلى» يعرض ما يردّه الحدّ').not.toContain('19:30')
    expect(firstToFor('18:00')).toBe('20:00')
    for (const c of to) expect(toMinutes(c)! - toMinutes('18:00')!).toBeGreaterThanOrEqual(MIN_SESSION_MINUTES)
  })

  it('وسلّمُ «من» يُقطَع حيث لا يبقى للحدّ متّسع', () => {
    const from = fromSlots()
    expect(from[0]).toBe('06:00')
    expect(from[from.length - 1], 'بدايةٌ لا تتّسع لساعتين قبل آخر الليل').toBe('21:30')
    for (const c of from) expect(toSlotsFor(c).length).toBeGreaterThan(0)
  })
})

describe('السلسلةُ: المتكرّرُ سلفا، ومعاينةٌ قبل الإرسال', () => {
  const TERM = { termStart: '2026-03-01', termEnd: '2026-04-30' }

  it('يشتقّ التواريخَ من أيّام الأسبوع حتّى يكتمل العدد', () => {
    /* ٢٠٢٦-٠٣-٠١ أحدٌ — والأحدُ صفرٌ في `getUTCDay` */
    const rows = buildSeries({ startDate: '2026-03-01', weekdays: [0], count: 3, ...TERM })
    expect(rows.map((r) => r.date)).toEqual(['2026-03-01', '2026-03-08', '2026-03-15'])
    expect(rows.every((r) => r.weekdayAr === WEEKDAYS_AR[0])).toBe(true)
    expect(rows.every((r) => !r.outside)).toBe(true)
  })

  it('ويومان في الأسبوع يتناوبان مرتَّبَين', () => {
    const rows = buildSeries({ startDate: '2026-03-01', weekdays: [0, 2], count: 4, ...TERM })
    expect(rows.map((r) => r.date)).toEqual(['2026-03-01', '2026-03-03', '2026-03-08', '2026-03-10'])
    expect(rows.map((r) => r.weekdayAr)).toEqual(['الأحد', 'الثلاثاء', 'الأحد', 'الثلاثاء'])
  })

  it('⚠️ وما خرج عن الفصل مُعلَّمٌ بسببه — لا محذوفٌ بصمت', () => {
    /* «ما خرج عن الفصل مشطوبٌ بسببٍ من كلمة». وحذفُه صمتا يترك المدرّبَ
       يعدّ صفوفا أقلَّ ممّا طلب ولا يعرف لماذا. */
    const rows = buildSeries({ startDate: '2026-04-19', weekdays: [0], count: 4, ...TERM })
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.outside)).toEqual([false, false, true, true])
    expect(rows[2].reasonAr).toBe('خارج الفصل')
    expect(rows[0].reasonAr).toBe('')
  })

  it('وقبلَ بدء الفصل خارجٌ كذلك — الحدُّ حدّان', () => {
    const rows = buildSeries({ startDate: '2026-02-15', weekdays: [0], count: 3, ...TERM })
    expect(rows.map((r) => r.outside)).toEqual([true, true, false])
  })

  it('وبلا حدودٍ للفصل لا شيءَ خارجَه', () => {
    const rows = buildSeries({ startDate: '2026-03-01', weekdays: [0], count: 2 })
    expect(rows.every((r) => !r.outside)).toBe(true)
  })

  it('ولا يدور بلا نهايةٍ ولا يتجاوز سقفَه', () => {
    expect(buildSeries({ startDate: '2026-03-01', weekdays: [], count: 5 })).toEqual([])
    expect(buildSeries({ startDate: 'ليس تاريخا', weekdays: [0], count: 5 })).toEqual([])
    expect(buildSeries({ startDate: '2026-03-01', weekdays: [0], count: 0 })).toEqual([])
    expect(buildSeries({ startDate: '2026-03-01', weekdays: [0, 1, 2, 3, 4, 5, 6], count: 999 }))
      .toHaveLength(MAX_SERIES)
  })

  it('⚠️ والمتكرّرُ هو المختارُ سلفا — والمتفرّقُ مخرج', () => {
    /* «شعبةٌ في فصلٍ ثابتٍ تجتمع سلسلةً — وهذه حقيقةُ نموذجنا لا تفضيلُ
       تصميم. مدرّبةٌ عندها اثنا عشرَ لقاءً تملأ النموذجَ اثنتَي عشرةَ مرّة.» */
    expect(SCHED, 'لا وضعَ سلسلةٍ أصلا').toMatch(/useState<"series" \| "single">\("series"\)/)
    expect(SCHED).toContain('جدولٌ متكرّر')
    expect(SCHED).toContain('لقاءٌ متفرّق')
  })

  it('⚠️ ولا يُرسَل ما لم يُعرَض — كلُّ تاريخٍ يصير اجتماعَ زووم', () => {
    /* المعاينةُ حالةٌ لا اشتقاق (الصفوفُ تُعدَّل بعد توليدها)، فزرُّ الإرسال
       يُقفَل ما دامت فارغة. */
    expect(SCHED, 'لا معاينةَ تُولَّد').toContain('setRows(buildSeries(')
    const at = SCHED.indexOf('disabled={busy ||')
    expect(SCHED.slice(at, at + 220), 'يُرسَل بلا معاينة').toContain('keep.length === 0')
  })

  it('⚠️ والمعاينةُ تُحذَف منها ويُعدَّل فيها', () => {
    expect(SCHED, 'لا حذفَ لصفّ').toContain('setRows(rows.filter((x) => x.key !== r.key))')
    expect(SCHED, 'لا تعديلَ لتاريخٍ ولا لعنوان').toMatch(/setRows\(rows\.map\(\(x\) => \(x\.key === r\.key/)
  })

  it('⚠️ والمشطوبُ لا يُرسَل — ويُعدّ ما يُرسَل وحدَه', () => {
    expect(SCHED, 'لا فرزَ بين ما يُرسَل وما شُطب').toMatch(/rows\.filter\(\(r\) => !r\.outside\)/)
    const at = SCHED.indexOf('for (const r of keep)')
    expect(at, 'التتابعُ يمرّ على الصفوف كلِّها لا على الباقي').toBeGreaterThan(0)
  })

  it('⚠️ والتتابعُ يقف عند أوّل رفضٍ ويقول كم مضى', () => {
    /* ما أُنشئ قبله لقاءاتٌ حقيقيّةٌ تُرى وتُحذف، فـ«تعذّر» عامّةً تُخفي
       عشرةً أُنشئت فعلا. */
    expect(SCHED).toMatch(/أُنشئ \$\{made\} من \$\{keep\.length\} ثمّ توقّف/)
    expect(SCHED, 'لا يُسقَط ما أُنشئ من المعاينة').toContain('setRows(stopped ? rows.slice(made) : [])')
  })
})

describe('③ نصيحةُ التباعد — تُقال ولا تُفرَض', () => {
  it('أسبوعٌ فما دون تباعدٌ ضيّق', () => {
    expect(tooTight(['2026-03-01', '2026-03-03'])).toBe(true)
    expect(tooTight(['2026-03-01', '2026-03-08'])).toBe(false)
    expect(tooTight(['2026-03-01'])).toBe(false)
    expect(tooTight([])).toBe(false)
  })

  it('⚠️ ولا يخدعه ترتيبٌ مقلوب', () => {
    /* والمتباعدان مقلوبَين هما الحالةُ الكاشفة: الفرقُ بينهما سالبٌ بلا
       فرز، والسالبُ أصغرُ من أسبوعٍ دائما — فيُقال «متقارب» عن شهرٍ
       كامل. والمتقاربان مقلوبَين يمرّان بفرزٍ وبغيره، فلا يكشفان شيئا. */
    expect(tooTight(['2026-03-10', '2026-03-08']), 'متقاربان مقلوبان').toBe(true)
    expect(tooTight(['2026-03-20', '2026-03-01']), 'متباعدان مقلوبان قُرئا متقاربَين').toBe(false)
  })

  it('⚠️ وتُعرض ولا تمنع — لا شرطَ عليها في زرِّ الإرسال', () => {
    expect(SCHED, 'النصيحةُ لا تُعرض').toContain('SPACING_ADVICE_AR')
    const at = SCHED.indexOf('disabled={busy ||')
    expect(SCHED.slice(at, at + 220), 'صارت النصيحةُ حكما يمنع').not.toContain('tight')
  })
})
