/* ملاحظاتُ الردّ نقاطٌ مختصرةٌ بلغةٍ بيضاء — المطلوبُ أوّلا (١٢ أكتوبر ٢٠٢٦، `scorecardNotes`).

   قال صاحبُ المنصّة لمّا رأى صناديقَ الردّ: «الملاحظاتُ المكتوبةُ بالداخل غيرُ مفهومةٍ نهائيّا. اشرحها
   بطريقةٍ أفضل، ورتّب النصوصَ لكي تظهر للمدرّب بطريقةٍ مختصرةٍ مفهومةٍ مرتّبةٍ بنقاطٍ حسب الأولويّة».

   ① النقطةُ: رأسٌ بلغة المدرّب، و«•» ما ينقص في مواضعه، و«←» ما يفعله — مرّةً لكلّ إصلاح.
   ② والمطلوبُ أوّلا، وبلا تشكيلٍ إعرابيّ، ولا يُسرد أكثرُ من أربعة مواضع.
   ③ والمدرّبُ يقرؤها نقاطا — والقديمُ «الآن ← نقترح» يُقرأ كما كان، والكلامُ الحرُّ كما كُتب.
   ④ وفي «المراجعة»: الخطواتُ التي فيها مطلوبٌ قبل غيرها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NOTE_ACTION_AR, NOTE_TITLE_AR, noteLinesFor, planScorecard, scorecardNotes, type ScoreItem,
} from '@/application/trainer/plan-scorecard'
import { noteItemsFrom, notePoints } from '@/application/trainer/plan-edits'
import { CASE_MARKS } from '@/application/text/plain-ar'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const item = (key: string, status: 'blocked' | 'advice', gaps: string[], step = 'modules'): ScoreItem => ({
  key, labelAr: `اسم ${key}`, standardAr: `معيار ${key}`, measuredAr: 'x', gaps,
  required: status === 'blocked', status, step: step as ScoreItem['step'],
})

describe('① النقطة: رأس، و«•» ما ينقص، و«←» ما يفعله', () => {
  it('⚠️ المحاور بنقص واحد سطر واحد — والإصلاح من النقص نفسه مرّة واحدة', () => {
    const gaps = [1, 3, 4, 5, 6, 7, 8].map((n) => `المحور ${n}: لا يسمّي خطأً شائعا — اكتبه في فقرةٍ باسمه`)
      .concat(['المحور 2: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ'])
    expect(noteLinesFor(item('content_depth', 'advice', gaps), 'مقترح')).toEqual([
      'مقترح — شرح المحاور',
      '• المحاور 1، 3–8: لا يسمّي خطأً شائعا',
      '← اكتبه في فقرةٍ باسمه',
      '• المحور 2: بلا مثالٍ محلول',
      '← أضف حالةً من سوقٍ عربيّ',
    ])
  })

  it('⚠️ وما لا يحمل إصلاحه فجملة فعل لمعياره — ولو كان في النقص « — »', () => {
    expect(noteLinesFor(item('project_time', 'advice', ['موعد «المشروع» الخميس — أقرب من أسبوع بعد آخر لقاء']), 'مقترح')).toEqual([
      'مقترح — وقت لإنجاز المشروع',
      '• موعد «المشروع» الخميس — أقرب من أسبوع بعد آخر لقاء',
      `← ${NOTE_ACTION_AR.project_time}`,
    ])
  })

  it('⚠️ ولا يسرد أكثر من أربعة مواضع — وخامس وحده يسرد، فلا «و1 غيرها»', () => {
    const dates = (n: number) => Array.from({ length: n }, (_, k) => `السبت ${k + 1} ديسمبر: بعد يومين من سابقه`)
    const six = noteLinesFor(item('session_gaps', 'advice', dates(6)), 'مقترح')
    expect(six.filter((l) => l.startsWith('•'))).toHaveLength(5)
    expect(six).toContain('• وموضعان آخران')
    const five = noteLinesFor(item('session_gaps', 'advice', dates(5)), 'مقترح')
    expect(five.filter((l) => l.startsWith('•'))).toHaveLength(5)
    expect(five.join('\n')).not.toMatch(/غيرها|أخرى|آخران/)
    expect(noteLinesFor(item('session_gaps', 'advice', dates(9)), 'مقترح')).toContain('• و5 مواضع أخرى')
  })

  it('⚠️ لكلّ معيار في البطاقة رأس بلغة المدرّب — وفعل لما لا يحمل نقصه إصلاحه', () => {
    const src = readFileSync(join(process.cwd(), 'src/application/trainer/plan-scorecard.ts'), 'utf8')
    const keys = [...src.matchAll(/out\.push\(item\(\{\s*key: '([a-z_]+)'/g)].map((m) => m[1]!)
    expect(keys.length, 'تعطّلت قراءة المعايير').toBeGreaterThan(15)
    expect(keys.filter((k) => !NOTE_TITLE_AR[k])).toEqual([])
    expect(keys.filter((k) => !k.startsWith('content_') && !NOTE_ACTION_AR[k])).toEqual([])
  })
})

describe('② المطلوب أوّلا، وبلا تشكيل', () => {
  it('⚠️ المطلوب قبل المقترح ولو جاء بعده — وبين النقاط سطر فارغ', () => {
    const notes = scorecardNotes([
      item('session_length', 'advice', ['السبت: 4 ساعات'], 'sessions'),
      item('live_per_module', 'blocked', ['المحور 2: بلا لقاء مباشر'], 'sessions'),
    ])
    const blocks = notes.sessions!.split('\n\n')
    expect(blocks.map((b) => b.split('\n')[0])).toEqual(['مطلوب — لقاء لكلّ محور', 'مقترح — طول اللقاء'])
  })

  it('⚠️ ولا حركة ولا تنوين فيما يصله — «اللغة البيضاء»', () => {
    const notes = scorecardNotes([item('content_depth', 'advice', ['المحور 1: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ'])])
    expect(notes.modules).not.toMatch(CASE_MARKS)
    expect(notes.modules).toContain('أضف حالة من سوق عربيّ')
  })

  it('وبطاقة حقيقيّة تخرج نقاطا كلّها — رأس ثمّ «•» و«←» لا غير', () => {
    const items = planScorecard({
      period: { startsOn: '2026-11-29', endsOn: '2027-01-20' },
      content: { modules: [{ moduleId: 'M1', activityAr: 'تطبيق عمليّ' }, { moduleId: 'M2', activityAr: '' }] },
      sessions: [{ startsAt: '2026-12-05T16:00:00Z', endsAt: '2026-12-05T22:00:00Z', moduleIds: ['M1'] }],
      assessments: [],
      now: new Date('2026-10-12T10:00:00Z'),
    })
    const notes = scorecardNotes(items)
    expect(Object.keys(notes).length, 'لا ملاحظات — الحارس يقيس الفراغ').toBeGreaterThan(1)
    for (const text of Object.values(notes)) {
      for (const block of text!.split('\n\n')) {
        const [head, ...rest] = block.split('\n')
        expect(head).toMatch(/^(مطلوب|مقترح) — [^:]+$/)
        expect(rest.length).toBeGreaterThan(0)
        for (const l of rest) expect(l).toMatch(/^[•←] /)
        expect(rest.at(-1)).toMatch(/^← /)
      }
    }
  })
})

describe('③ والمدرّب يقرؤها نقاطا', () => {
  it('⚠️ رأسها ووسمها، وما ينقص مع ما يفعله', () => {
    const [p] = notePoints('مقترح — شرح المحاور\n• المحاور 1، 3–8: لا يسمّي خطأ شائعا\n← اكتبه في فقرة\n• المحور 2: بلا مثال\n← أضف حالة')
    expect(p).toEqual({
      textAr: 'شرح المحاور', tagAr: 'مقترح', labelAr: 'شرح المحاور',
      subs: [
        { gapsAr: ['المحاور 1، 3–8: لا يسمّي خطأ شائعا'], fixAr: 'اكتبه في فقرة' },
        { gapsAr: ['المحور 2: بلا مثال'], fixAr: 'أضف حالة' },
      ],
    })
  })

  it('⚠️ و«•» تحت سطر موسوم بلا «←» نقطة مستقلّة كما كتبها المعتمد', () => {
    expect(notePoints('مقترح — المخرج أوضح\n• انقل اللقاء')).toEqual([
      { textAr: 'المخرج أوضح', tagAr: 'مقترح' },
      { textAr: 'انقل اللقاء', tagAr: null },
    ])
  })

  it('⚠️ والشاشتان ترسمانها بـ`NoteSubs` — ملاحظة الخطوة وبند «المراجعة»', () => {
    const body = code('src/components/LongText.tsx')
    expect(body).toMatch(/if \(p\.subs\) \{[\s\S]{0,400}<NoteSubs subs=\{p\.subs\} \/>/)
    expect(body).toMatch(/export function NoteSubs[\s\S]{0,1500}x\.gapsAr\.map[\s\S]{0,1200}x\.fixAr && \(/)
    expect(code('src/components/PlanEdits.tsx')).toMatch(/\{r\.subs \? \(\s*<div className="mt-1\.5"><NoteSubs subs=\{r\.subs\} \/><\/div>/)
  })
})

describe('④ وفي «المراجعة»: ما فيه مطلوب قبل غيره', () => {
  it('⚠️ العامّة، ثمّ الخطوات التي فيها مطلوب، ثمّ الباقي — بترتيب الشريط في كلّ', () => {
    const items = noteItemsFrom({
      general: 'شكرا', identity: 'مقترح — بداية الشعبة', sessions: 'مطلوب — لقاء', assignments: 'مطلوب — مصدر', modules: 'انقل',
    })
    expect(items.map((x) => x.edit.step)).toEqual(['general', 'sessions', 'assignments', 'identity', 'modules'])
  })
})
