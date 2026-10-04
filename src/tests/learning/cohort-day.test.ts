/* ═══ يومُ الشعبة بتوقيت عمّان — في كلّ شاشةٍ ورسالة (٣ أكتوبر ٢٠٢٦، ⑪) ═══
 *
 * سار صاحبُ المنصّة في مسار اعتماد الخطط، فرأى «شعبي» بجهازٍ على توقيت القاهرة
 * تقول «31 أكتوبر» لشعبةٍ تبدأ ١ نوفمبر، وشاشةُ المراجعة تقول ١ نوفمبر. واختار
 * («11»): اليومُ يومُ عمّان في كلّ موضعٍ يكتب يومَ بدء شعبةٍ أو انتهائها — لا
 * في الشاشة التي رآها وحدَها. والعلّةُ في رأس `cohortDayAr` (`cohort-gate.ts`).
 *
 * ── حارسان ──
 *
 * ① المساعدُ يقول اليومَ الصحيح — وبيئةُ الاختبار (UTC، كبيئة CI والخادم) تُظهر
 *    العطبَ لو عاد: بلا منطقةٍ يُقرأ يومٌ قبله.
 * ② ولا موضعَ في src ولا server يكتب يومَ بدءٍ أو انتهاءٍ بمنسّقٍ بلا منطقة.
 *    ويُقرأ بمحلّل TypeScript على الاستدعاءات لا على ورود حرف — فتعليقٌ يذكر
 *    `fmtDateAr(c.startsAt)` لا يُسقطه، واستدعاءٌ يُسقطه — ويُثبَت الماسحُ بعيّنةٍ
 *    يُعرَف جوابُها قبل أن يُمسَح المستودَع.
 *
 * وساعاتُ اللقاءات على **الشاشات** خارجَ هذا: لحظاتٌ يقرؤها كلٌّ بساعة جهازه.
 * أمّا رسائلُ الخادم فنصٌّ ثابتٌ يُقرأ في كلّ منطقة — فساعتُها بتوقيت عمّان
 * كسائر رسائل المنصّة (`whenAr`)، ويُحرَس ذلك على الخادم وحدَه. */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cohortDayAr, DAY_NUMERIC } from '../../application/learning/cohort-gate'
import { fmtDateWith } from '../../application/text/format-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** شعبةُ ١ نوفمبر كما تُخزَّن: منتصفُ ليل يومها في عمّان، وآخرُ ثانيةٍ من آخر يومها */
const START = '2026-10-31T21:00:00.000Z'
const END = '2026-11-28T20:59:59.999Z'

describe('⑪ يومُ الشعبة يومُ عمّان — المساعد', () => {
  it('بدءُ الشعبة يومُها في عمّان — لا يومٌ قبله، بأيّ صيغة', () => {
    expect(cohortDayAr(START)).toBe('1 نوفمبر 2026')
    expect(cohortDayAr(new Date(START))).toBe('1 نوفمبر 2026')
    expect(cohortDayAr(END)).toBe('28 نوفمبر 2026')
    expect(cohortDayAr(START, { weekday: 'long', day: 'numeric', month: 'long' })).toBe('الأحد، 1 نوفمبر')
    expect(cohortDayAr(START, DAY_NUMERIC))
      .toBe(fmtDateWith('2026-11-01T12:00:00Z', { ...DAY_NUMERIC, timeZone: 'UTC' }))
  })

  it('والتاريخُ وحدَه يومُه كما كُتب — مدّةُ الخطّة، وحدودُ الفصل منتصفَ ليل غرينتش', () => {
    expect(cohortDayAr('2026-11-01')).toBe('1 نوفمبر 2026')
    expect(cohortDayAr('2027-02-01T00:00:00.000Z')).toBe('1 فبراير 2027')
  })

  it('ولا يومَ لما لا يوجد — «—» لا تاريخٌ مخترَع', () => {
    for (const v of [null, undefined, '', 'ليس تاريخا']) expect(cohortDayAr(v)).toBe('—')
  })

  /* إن كانت منطقةُ الجهاز تضع ٢١:٠٠ بغرينتش في اليوم التالي (عمّان فشرقَها) فلا
     يظهر العطبُ هنا أصلا — ويبقى الحارسُ في CI، ومنطقتُه UTC */
  const hidesBug = new Date(START).getDate() === 1
  it.skipIf(hidesBug)('وبيئةُ الاختبار تُظهر العطبَ لو عاد — بلا منطقةٍ يُقرأ ٣١ أكتوبر', () => {
    expect(fmtDateWith(START, { day: 'numeric', month: 'long', year: 'numeric' })).toBe('31 أكتوبر 2026')
  })
})

/* ═══ الماسح ═══ */

/** ما يكون يوما لشعبةٍ أو فصل — حقلا بدءٍ وانتهاءٍ وآخرُ الالتحاق */
const DAY_FIELD = /\b(?:startsAt|endsAt|startsOn|endsOn|joinClosesAt)\b/
/** منسّقاتُ اليوم بمنطقة الجهاز — لا تقبل منطقة */
const DAY_ONLY = new Set(['fmtDateAr', 'fmtDate', 'fmtDateLong', 'fmtDayMonth'])
/** منسّقاتُ الساعة بمنطقة الجهاز — للشاشات، لا لرسائل الخادم */
const CLOCK = new Set(['fmtDateTimeAr', 'fmtShortDateTimeAr', 'fmtSession', 'fmtDateTime', 'fmtTime'])
const LOCALE_METHODS = new Set(['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'])

/** استدعاءاتٌ تكتب يومَ بدءٍ أو انتهاءٍ بلا منطقة — بأسطرها */
function zonelessDays(file: string, src: string, where: { server: boolean }): number[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: number[] = []
  const named = (o: ts.ObjectLiteralExpression, key: string) => o.properties.find(
    (p): p is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText(sf) === key)
  const zoned = (arg: ts.Expression | undefined) => !!arg && ts.isObjectLiteralExpression(arg) && !!named(arg, 'timeZone')
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const direct = ts.isIdentifier(callee) ? callee.text : ''
      const method = ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
      const first = n.arguments[0]?.getText(sf) ?? ''
      let bad = false
      if (DAY_ONLY.has(direct) && DAY_FIELD.test(first)) bad = true
      else if (direct === 'fmtDateWith' && DAY_FIELD.test(first) && !zoned(n.arguments[1])) bad = true
      else if (LOCALE_METHODS.has(method) && ts.isPropertyAccessExpression(callee)
        && DAY_FIELD.test(callee.expression.getText(sf)) && !zoned(n.arguments[1])) bad = true
      else if (where.server && CLOCK.has(direct) && DAY_FIELD.test(first)) bad = true
      else if (direct === 'planDiff') {
        /* ومنسّقُ يومَي المدّة في «ما تغيّر» — يُمرَّر ولا يُستدعى هنا */
        const fmt = n.arguments[2]
        const date = fmt && ts.isObjectLiteralExpression(fmt) ? named(fmt, 'date') : undefined
        if (date && ts.isPropertyAssignment(date) && date.initializer.getText(sf) !== 'cohortDayAr') bad = true
      }
      if (bad) out.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** ملفّاتُ الشيفرة — بلا الاختبارات */
function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== 'tests' && name !== '__tests__') sources(p, acc)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      acc.push(p)
    }
  }
  return acc
}

describe('⑪ يومُ الشعبة يومُ عمّان — في كلّ موضع', () => {
  const SAMPLE = [
    'const a = fmtDateAr(c.startsAt)',
    'const b = cohortDayAr(c.startsAt)',
    'const c = fmtDate(new Date(e.startsAt))',
    "const d = fmtDateWith(s.startsAt, { day: 'numeric' })",
    "const e = fmtDateWith(s.startsAt, { day: 'numeric', timeZone: ACADEMY_ZONE })",
    'const f = fmtDateAr(x.createdAt)',
    '/* fmtDateAr(c.startsAt) في تعليقٍ يروي العطب */',
    /* واللغةُ متغيّرٌ لا نصٌّ — فبوّابةُ `audit-locale` تمنع تسميتَها خارج `format-ar.ts` */
    'const g = new Date(c.endsAt).toLocaleDateString(UI_LOCALE)',
    'const h = planDiff(a, b, { date: fmtDateAr })',
    'const i = planDiff(a, b, { date: cohortDayAr })',
    'const j = fmtDateTimeAr(s.startsAt)',
    'const k = <b>{fmtDateLong(term.startsOn)}</b>',
  ].join('\n')

  it('الماسحُ يرى الاستدعاءَ ويتجاوز التعليق — ويفرّق الشاشةَ من رسالة الخادم', () => {
    expect(zonelessDays('sample.tsx', SAMPLE, { server: false }), 'الماسحُ لا يرى ما يجب، أو يرى غيرَه')
      .toEqual([1, 3, 4, 8, 9, 12])
    expect(zonelessDays('sample.tsx', SAMPLE, { server: true }), 'ساعةُ اللقاء في رسالة الخادم بلا منطقة')
      .toEqual([1, 3, 4, 8, 9, 11, 12])
  })

  it('⚠️ ولا موضعَ في src ولا server يكتب يومَ بدءٍ أو انتهاءٍ بلا منطقة', () => {
    const client = sources(join(root, 'src'))
    const server = sources(join(root, 'server'))
    expect(client.length + server.length, 'لم تُقرأ ملفّاتُ الشيفرة — فالحارسُ يقيس الفراغ').toBeGreaterThan(200)
    const hits: string[] = []
    for (const [files, isServer] of [[client, false], [server, true]] as const) {
      for (const file of files) {
        const src = readFileSync(file, 'utf8')
        if (!DAY_FIELD.test(src)) continue
        for (const line of zonelessDays(file, src, { server: isServer })) hits.push(`${relative(root, file)}:${line}`)
      }
    }
    expect(hits, 'يومُ شعبةٍ يُكتب بمنطقة الجهاز أو الخادم — والمساعدُ `cohortDayAr`').toEqual([])
  })
})
