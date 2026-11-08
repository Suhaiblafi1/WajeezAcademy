/* مواعيدُ اللقاءات المباشرة حيث يقع قرارُ الشراء (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «these dates appears in the information of the training
   for the user when they buy it». والخادمُ يرشّح ما يُعلَن (يحرسه
   `server/tests/commerce/public-session-dates.test.ts`)، وهنا ما يصنعه
   المتصفّحُ بما وصله: يحمله إلى خيار الشعبة، ويعرضه في منتقي الموعد ولوحِ
   الشراء. والمنتقي يُرسَم رسما ساكنا — فالحارسُ على ما يُعرض لا على حروفٍ في
   الملفّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cohortOptionsFrom, type CohortOption } from '@/services/cohort-prices'
import CohortPicker from '@/components/CohortPicker'
import LiveSessionDates from '@/components/LiveSessionDates'
import { whenAr } from '@/application/learning/cohort-gate'

const S1 = '2099-03-03T15:00:00.000Z'
const S2 = '2099-03-10T15:00:00.000Z'
const S3 = '2099-03-17T15:00:00.000Z'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1', courseId: 'C-1', title: 'الشعبة', status: 'open', price: 100, currency: 'USD',
  startsAt: '2099-03-01T00:00:00.000Z', daysOfWeek: ['tue'], startTime: '18:00', timezone: 'Asia/Amman',
  seatsLeft: 10, trainers: [],
  sessions: [
    { startsAt: S2, endsAt: null, title: 'اللقاء الثاني' },
    { startsAt: S1, endsAt: '2099-03-03T17:00:00.000Z', title: 'اللقاء الأوّل' },
    { startsAt: S3, endsAt: null, title: 'اللقاء الثالث' },
  ],
  ...over,
})

describe('ما وصل من الخادم يحمل إلى خيار الشعبة', () => {
  it('⚠️ اللقاءات تصل الخيار مرتّبة — «أوّلها» أوّلها فعلا', () => {
    const [option] = cohortOptionsFrom([row()]).get('C-1') ?? []
    expect(option?.sessions.map((s) => s.startsAt)).toEqual([S1, S2, S3])
    expect(option?.sessions[0]).toEqual({ startsAt: S1, endsAt: '2099-03-03T17:00:00.000Z', title: 'اللقاء الأوّل' })
  })

  it('وما لا لحظة له يسقط ولا يختلق — والغياب قائمة فارغة', () => {
    const [bad] = cohortOptionsFrom([row({ sessions: [{ startsAt: 'ليس تاريخا', title: 'x' }, { title: 'بلا موعد' }, { startsAt: S1, endsAt: 'x' }] })]).get('C-1') ?? []
    expect(bad?.sessions).toEqual([{ startsAt: S1, endsAt: null, title: '' }])
    const [none] = cohortOptionsFrom([row({ sessions: undefined })]).get('C-1') ?? []
    expect(none?.sessions).toEqual([])
  })
})

const render = (cohorts: CohortOption[], compact = false) =>
  renderToStaticMarkup(createElement(CohortPicker, { cohorts, selectedId: null, onSelect: () => undefined, compact }))

describe('منتقي الموعد يعرضها — في «تفاصيل الشعبة» المطويّة (٨ نوفمبر ٢٠٢٦)', () => {
  /* كانت لقاءاتُ المختارة تظهر مفتوحة. ثمّ قال صاحبُ المنصّة (٨ نوفمبر ٢٠٢٦): «أخفِ تفاصيلَ الشعب لأنّها منسدلة، يفتحها
     إن أراد، فلا تفتح واحدةٌ تلقائيا». فلكلّ شعبةٍ زرُّ «تفاصيل الشعبة» مطويّا، وتحته نبذتُها ولقاءاتُها هي */
  const options = cohortOptionsFrom([row()]).get('C-1') ?? []
  const picker = readFileSync(join(process.cwd(), 'src/components/CohortPicker.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('⚠️ لا تفتح تفاصيل شعبةٍ وحدها — في صفحة الدورة ولا في القوائم', () => {
    for (const compact of [false, true]) {
      const html = render(options, compact)
      expect(html).toContain('تفاصيل الشعبة')
      expect(html).toContain('aria-expanded="false"')
      expect(html, 'لقاءات مفتوحة بلا طلب').not.toContain(whenAr(S3))
    }
  })

  it('⚠️ وإذا فتحها: لقاءاتها هي — عددها وأوّلها، والقائمة كلها في صفحة الدورة ومطويّة في القوائم', () => {
    expect(picker).toMatch(/function CohortMore\(\{ c, compact \}[\s\S]*?useState\(false\)[\s\S]*?\{open && \([\s\S]*?<LiveSessionDates sessions=\{c\.sessions\} defaultOpen=\{!compact\} \/>/)
    const live = renderToStaticMarkup(createElement(LiveSessionDates, { sessions: options[0].sessions, defaultOpen: true }))
    for (const at of [S1, S2, S3]) expect(live, `موعد ${at} غائب`).toContain(whenAr(at))
    expect(live).toContain('اللقاء الثالث')
    expect(live).toContain('3 لقاءات مباشرة')
    expect(live).toContain('بتوقيت عمّان')
    const folded = renderToStaticMarkup(createElement(LiveSessionDates, { sessions: options[0].sessions }))
    expect(folded).toContain(whenAr(S1))
    expect(folded, 'القائمة مفتوحة في القوائم').not.toContain(whenAr(S3))
  })

  it('وشعبة لم يعتمد جدولها لا يختلق لها سطر', () => {
    const html = render(cohortOptionsFrom([row({ sessions: [] })]).get('C-1') ?? [])
    expect(html).not.toContain('أوّلها')
    expect(html).not.toContain('بتوقيت عمّان')
  })

  it('⚠️ ولكل شعبة تفاصيلها هي — لا لقاءات أقربها', () => {
    expect(picker).toMatch(/\(c\.summaryAr \|\| c\.sessions\.length > 0\) && <CohortMore key=\{c\.id\} c=\{c\} compact=\{compact\} \/>/)
    const later = row({ id: 'c-2', startsAt: '2099-05-01T00:00:00.000Z', sessions: [{ startsAt: '2099-05-05T15:00:00.000Z', title: 'لقاء الثانية' }] })
    const both = cohortOptionsFrom([row(), later]).get('C-1') ?? []
    const html = renderToStaticMarkup(createElement(CohortPicker, { cohorts: both, selectedId: 'c-2', onSelect: () => undefined }))
    expect(html.match(/تفاصيل الشعبة/g)?.length, 'زر لكل شعبة').toBe(2)
  })
})

describe('ولوح الشراء يحملها قبل الدفع', () => {
  /* اللوحُ في `createPortal` فلا يُرسَم ساكنا — فالفحصُ على بنيته بلا تعليقاته،
     كأخيه `buy-panel-fold.test.ts` */
  const code = readFileSync(join(process.cwd(), 'src/components/BuyPanel.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('⚠️ لقاءات الشعبة المختارة لكلّ بند — والمستبعد بلا لقاءات', () => {
    expect(code).toMatch(/\{!out && <LiveSessionDates\b[^>]*sessions=\{picked\.sessions\}/)
  })
})
