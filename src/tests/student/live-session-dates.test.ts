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
import { whenAr } from '@/application/learning/cohort-gate'

const S1 = '2099-03-03T15:00:00.000Z'
const S2 = '2099-03-10T15:00:00.000Z'
const S3 = '2099-03-17T15:00:00.000Z'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1', courseId: 'C-1', title: 'الشعبة', status: 'open', price: 100, currency: 'USD',
  startsAt: '2099-03-01T00:00:00.000Z', daysOfWeek: ['tue'], startTime: '18:00', timezone: 'Asia/Amman',
  seatsLeft: 10, trainers: [],
  sessions: [
    { startsAt: S2, endsAt: null, title: 'اللقاءُ الثاني' },
    { startsAt: S1, endsAt: '2099-03-03T17:00:00.000Z', title: 'اللقاءُ الأوّل' },
    { startsAt: S3, endsAt: null, title: 'اللقاءُ الثالث' },
  ],
  ...over,
})

describe('ما وصل من الخادم يُحمل إلى خيار الشعبة', () => {
  it('⚠️ اللقاءاتُ تصل الخيارَ مرتّبةً — «أوّلُها» أوّلُها فعلا', () => {
    const [option] = cohortOptionsFrom([row()]).get('C-1') ?? []
    expect(option?.sessions.map((s) => s.startsAt)).toEqual([S1, S2, S3])
    expect(option?.sessions[0]).toEqual({ startsAt: S1, endsAt: '2099-03-03T17:00:00.000Z', title: 'اللقاءُ الأوّل' })
  })

  it('وما لا لحظةَ له يسقط ولا يُختلَق — والغيابُ قائمةٌ فارغة', () => {
    const [bad] = cohortOptionsFrom([row({ sessions: [{ startsAt: 'ليس تاريخا', title: 'x' }, { title: 'بلا موعد' }, { startsAt: S1, endsAt: 'x' }] })]).get('C-1') ?? []
    expect(bad?.sessions).toEqual([{ startsAt: S1, endsAt: null, title: '' }])
    const [none] = cohortOptionsFrom([row({ sessions: undefined })]).get('C-1') ?? []
    expect(none?.sessions).toEqual([])
  })
})

const render = (cohorts: CohortOption[], compact = false) =>
  renderToStaticMarkup(createElement(CohortPicker, { cohorts, selectedId: null, onSelect: () => undefined, compact }))

describe('منتقي الموعد يعرضها', () => {
  const options = cohortOptionsFrom([row()]).get('C-1') ?? []

  it('⚠️ في صفحة الدورة: القائمةُ كلُّها بساعة عمّان — وعددُها وأوّلُها', () => {
    const html = render(options)
    for (const at of [S1, S2, S3]) expect(html, `موعدُ ${at} غائب`).toContain(whenAr(at))
    expect(html).toContain('اللقاءُ الثالث')
    expect(html).toContain('3 لقاءاتٍ مباشرة')
    expect(html).toContain('بتوقيت عمّان')
  })

  it('⚠️ وفي القوائم مطويّة: عددُها وأوّلُها، لا الثمانيةُ والأربعون سطرا', () => {
    const html = render(options, true)
    expect(html).toContain('3 لقاءاتٍ مباشرة')
    expect(html).toContain(whenAr(S1))
    expect(html, 'القائمةُ مفتوحةٌ في القوائم').not.toContain(whenAr(S3))
    expect(html).toContain('aria-expanded="false"')
  })

  it('وشعبةٌ لم يُعتمَد جدولُها لا يُختلَق لها سطر', () => {
    const html = render(cohortOptionsFrom([row({ sessions: [] })]).get('C-1') ?? [])
    expect(html).not.toContain('أوّلُها')
    expect(html).not.toContain('بتوقيت عمّان')
  })

  it('⚠️ والمعروضُ لقاءاتُ الشعبة المختارة — لا أقربِها', () => {
    const later = row({ id: 'c-2', startsAt: '2099-05-01T00:00:00.000Z', sessions: [{ startsAt: '2099-05-05T15:00:00.000Z', title: 'لقاءُ الثانية' }] })
    const both = cohortOptionsFrom([row(), later]).get('C-1') ?? []
    const html = renderToStaticMarkup(createElement(CohortPicker, { cohorts: both, selectedId: 'c-2', onSelect: () => undefined }))
    expect(html).toContain('لقاءُ الثانية')
    expect(html).not.toContain('اللقاءُ الأوّل')
  })
})

describe('ولوحُ الشراء يحملها قبل الدفع', () => {
  /* اللوحُ في `createPortal` فلا يُرسَم ساكنا — فالفحصُ على بنيته بلا تعليقاته،
     كأخيه `buy-panel-fold.test.ts` */
  const code = readFileSync(join(process.cwd(), 'src/components/BuyPanel.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('⚠️ لقاءاتُ الشعبة المختارة لكلّ بند — والمستبعَدُ بلا لقاءات', () => {
    expect(code).toMatch(/\{!out && <LiveSessionDates\b[^>]*sessions=\{picked\.sessions\}/)
  })
})
