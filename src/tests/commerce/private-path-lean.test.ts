/* صفحةُ المسار الشخصيّ ‎/go أبسط — كتسجيل البلاك فرايدي (٢٢ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اجعل الشكلَ أبسط مثل تسجيل البلاك فرايدي: كلماتٌ أصغر مثل "تفاصيل الدورة"، وما تحت "تفاصيل
   الشعبة" يُحذف، وصغّر سطرَ "تفاصيل الدورة"، وزرُّ "أضف دورات" أوضح، وعبارةُ "نبذة المدرب" لا داعي لها — يضغط على صورة
   المدرب فتفتح النبذة، ولا داعي لـ"بعد 13 يوما" لكلّ دورة».

   ═══ وما يُحرَس ═══

   ١) المنتقي بـ`lean`: لا سطرَ «نبذة المدرب» مكتوبا، والصورةُ زرٌّ اسمُه «نبذة المدرب <اسمه>»، والموعدُ بلا «بعد N يوما».
      وبلاها كما كان — البابُ مكتوبٌ والبُعدُ ظاهر.
   ٢) الرحلةُ بـ`lean`: «تفاصيل الدورة» بلا سطر «الأهداف · 8 وحدات»، ولا شاراتِ المدّة والمهارات، ولا جملةَ «نعلن اسم مدرب».
   ٣) ‎/go وحدَها تمرّر `lean` — وصفحةُ المسار المعتادة (`Pathway.tsx`) بالنسخة الكاملة.

   ═══ وكيف رُئي ساقطا ═══

   أُعيدت المصادرُ الثلاثةُ إلى ما قبل التغيير (`git show HEAD:<file>`) فسقط ①–③ كلُّها: النبذةُ مكتوبةٌ والبُعدُ ظاهرٌ
   والصورةُ بلا زرّ، والسطرُ والشاراتُ والجملةُ بلا شرط، و‎/go بلا `lean`. وأُضيف `lean` إلى رحلة `Pathway.tsx` فسقط ③. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { cohortOptionsFrom, type CohortOption } from '@/services/cohort-prices'
import CohortPicker from '@/components/CohortPicker'

/** الشيفرةُ بلا تعليقاتها — فلا يمرّ الحارسُ بنصٍّ في تعليق */
const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

const opt = (over: Record<string, unknown>): CohortOption => {
  const [o] = cohortOptionsFrom([{
    id: 'c-1', courseId: 'C-1', title: 'شعبة 1', status: 'open', price: 100, currency: 'USD',
    startsAt: inDays(10), daysOfWeek: ['sat'], startTime: '18:00', timezone: 'Asia/Amman', seatsLeft: 10,
    trainers: ['احمد صالح الطيار'], sessions: [],
    ...over,
  }]).get('C-1') ?? []
  return o!
}

const render = (cohorts: CohortOption[], lean: boolean) =>
  renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(CohortPicker, { cohorts, selectedId: null, onSelect: () => undefined, compact: true, hintOneLine: lean, lean })))

/** نصُّ الصفحة الظاهرُ بلا وسومها وصفاتها */
const visible = (html: string) => html.replace(/<[^>]+>/g, ' ')

describe('١) المنتقي في ‎/go: الصورة باب النبذة، والموعد بلا بعده', () => {
  const withPage = opt({ trainerProfiles: [{ id: 'p-1', name: 'احمد صالح الطيار', photoUrl: '/p.webp', slug: 'ahmad' }] })
  const noPage = opt({ trainerProfiles: [{ id: 'p-1', name: 'احمد صالح الطيار', photoUrl: '/p.webp' }] })

  it('⚠️ لا سطر «نبذة المدرب» مكتوبا — والصورة زر باسم النبذة', () => {
    const html = render([withPage], true)
    expect(visible(html)).not.toContain('نبذة المدرب')
    expect(html).toMatch(/<button[^>]*aria-label="نبذة المدرب احمد صالح الطيار"[^>]*data-photo-about=""[^>]*>[\s\S]*?<img/)
    /* و«مدربك» والاسم و«مباشر» باقية */
    expect(visible(html)).toContain('مدربك')
    expect(visible(html)).toContain('احمد صالح الطيار')
    expect(visible(html)).toContain('مباشر')
  })

  it('⚠️ ومن لا صفحة له: الصورة رابط إلى بطاقته في صفحة الفريق', () => {
    const html = render([noPage], true)
    expect(visible(html)).not.toContain('نبذة المدرب')
    const link = html.match(/<a\b[^>]*data-photo-about=""[^>]*>[\s\S]*?<\/a>/)?.[0] ?? ''
    expect(link).toContain('href="/trainers#trainer-p-1"')
    expect(link).toContain('aria-label="نبذة المدرب احمد صالح الطيار"')
    expect(link).toContain('<img')
  })

  it('⚠️ أول لقاء بلا «بعد N يوما» — والأيام والساعة باقية', () => {
    const text = visible(render([withPage], true))
    expect(text).not.toMatch(/بعد \d+ يوما/)
    expect(text).toContain('18:00')
  })

  it('وبلا lean كما كان: الباب مكتوب والبعد ظاهر', () => {
    const text = visible(render([withPage], false))
    expect(text).toContain('نبذة المدرب')
    expect(text).toMatch(/بعد \d+ يوما/)
  })
})

describe('٢) الرحلة في ‎/go أبسط', () => {
  const J = code('src/components/CourseJourney.tsx')

  it('⚠️ «تفاصيل الدورة» بلا سطر «الأهداف · N وحدات» — وأصغر', () => {
    expect(J).toMatch(/\{!lean && detailsSummaryAr\(c\) &&/)
    expect(J).toMatch(/lean \? "text-read font-bold" : "text-sm font-black"[^\n]*>تفاصيل الدورة</)
  })

  it('⚠️ لا شارات المدة والمهارات تحت الشعبة', () => {
    const chips = J.match(/\{!lean && \(<>([\s\S]*?)<\/>\)\}/)
    expect(chips, 'الشارات خلف !lean').not.toBeNull()
    expect(chips![1]).toContain('weeksLabel(')
    expect(chips![1]).toContain('relatedSkills')
    /* ولا شارةَ مدّةٍ ولا مهارةٍ خارجها */
    expect(J.replace(chips![0], '')).not.toMatch(/relatedSkills\.slice/)
  })

  it('⚠️ لا جملة «نعلن اسم مدرب» حيث تعرض الأسماء', () => {
    expect(J).toMatch(/\{!lean && \(\s*<p[^>]*>\s*نعلن اسم مدرب كل دورة/)
  })
})

describe('٣) ‎/go وحدها بالنسخة الأبسط', () => {
  const journeys = (p: string) => [...code(p).matchAll(/<CourseJourney\b([\s\S]*?)\n\s*\/>/g)].map((m) => m[1]!)

  it('⚠️ PrivatePath تمرر lean', () => {
    const js = journeys('src/pages/PrivatePath.tsx')
    expect(js.length).toBe(1)
    expect(js[0]).toMatch(/^\s*lean\s*$/m)
  })

  it('⚠️ وصفحة المسار المعتادة بالنسخة الكاملة', () => {
    const js = journeys('src/pages/Pathway.tsx')
    expect(js.length).toBeGreaterThan(0)
    for (const j of js) expect(j).not.toMatch(/\blean\b/)
  })
})
