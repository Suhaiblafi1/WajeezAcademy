/* كلُّ شعبةٍ صندوقُها — بموعدها ووجهِ مدرّبها (٢٠ أكتوبر ٢٠٢٦).

   «لماذا تظهر الشعبة التي فيها مدرّبين اثنين وكأنّهم شعبةٌ واحدة! يجب أن تظهر وكأنّهم شعبتان
   للدورة، وهو يختار الشعبة المناسبة له كتوقيتٍ ومدرّب.. ينطبق هذا على كلّ الدورات.. ويفضّل أن
   يظهر اسمُ المدرّب بوضوح وصورتُه بنفس صندوق الشعبة، ينقله لمكان النبذة عن المدرّب» (صاحب المنصّة).

   ═══ وما يُحرَس ═══

   ١) الوجوهُ تصل من ردّ الخادم إلى خيار الشعبة — ومن خادمٍ أقدمَ تُبنى من الأسماء بلا باب.
   ٢) المنتقي يرسم الشعبتين صندوقين ظاهرين، في كلٍّ اسمُ مدرّبه وصورتُه وبابُ نبذته — لا «موعد آخر».
   ٣) ورحلةُ الدورات لا تجمع مدرّبي الشعب في شارةٍ واحدة حيث المنتقي ظاهر.
   ٤) وصفحةُ الفريق لا تقول «لم يعتمد نشر اسم مدرّب» قبل أن يصل جوابُها، وتعيد الطلبَ حين يخفق.

   ═══ وكيف رُئي ساقطا ═══

   أُعيد المنتقي إلى صيغته القديمة (الأقربُ وحدَه و«موعد آخر»)، فسقط ②. وأُعيدت الشارةُ بلا شرط،
   فسقط ③. وأُعيد شرطُ بيان الصفر بلا `approved !== null`، فسقط ④. وحُذف `trainerProfiles` من
   التحويل، فسقط ①. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { cohortOptionsFrom, type CohortOption } from '@/services/cohort-prices'
import CohortPicker from '@/components/CohortPicker'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** الشيفرةُ بلا تعليقاتها — فلا يمرّ الحارسُ بنصٍّ في تعليق */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-ahmad', courseId: 'C-1', title: 'شعبة 1', status: 'open', price: 100, currency: 'USD',
  startsAt: '2099-12-01T00:00:00.000Z', daysOfWeek: ['tue'], startTime: '18:00', timezone: 'Asia/Amman',
  seatsLeft: 10, trainers: ['احمد صالح الطيار'],
  trainerProfiles: [{ id: 'p-ahmad', name: 'احمد صالح الطيار', photoUrl: '/api/v1/trainer-photos/ahmad.webp' }],
  sessions: [],
  ...over,
})

const ines = row({
  id: 'c-ines', title: 'شعبة 2', startsAt: '2099-12-07T00:00:00.000Z', trainers: ['ايناس عاهد ذيب'],
  trainerProfiles: [{ id: 'p-ines', name: 'ايناس عاهد ذيب', photoUrl: null }],
})

const render = (cohorts: CohortOption[], selectedId: string | null = null) =>
  renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(CohortPicker, { cohorts, selectedId, onSelect: () => undefined, compact: true })))

describe('١) الوجوه تصل خيار الشعبة', () => {
  it('⚠️ الاسم والصورة والمعرّف كما وصلت — وما لا اسم له يسقط', () => {
    const [opt] = cohortOptionsFrom([row({ trainerProfiles: [
      { id: 'p-ahmad', name: ' احمد صالح الطيار ', photoUrl: '/api/v1/trainer-photos/ahmad.webp' },
      { id: 'p-x', name: '', photoUrl: null },
    ] })]).get('C-1') ?? []
    expect(opt?.trainerProfiles).toEqual([{ id: 'p-ahmad', name: 'احمد صالح الطيار', photoUrl: '/api/v1/trainer-photos/ahmad.webp' }])
  })

  it('ومن خادم أقدم بلا الحقل: من الأسماء بلا صورة ولا باب', () => {
    const [opt] = cohortOptionsFrom([row({ trainerProfiles: undefined })]).get('C-1') ?? []
    expect(opt?.trainerProfiles).toEqual([{ id: '', name: 'احمد صالح الطيار', photoUrl: null }])
  })
})

describe('٢) شعبتان لمدرّبين = صندوقان يختار بينهما', () => {
  const both = cohortOptionsFrom([row(), ines]).get('C-1') ?? []

  it('⚠️ الصندوقان ظاهران معا باسمي مدرّبيهما — لا «موعد آخر» يخفي الثانية', () => {
    const html = render(both, 'c-ines')
    expect(html).toContain('احمد صالح الطيار')
    expect(html).toContain('ايناس عاهد ذيب')
    expect(html, 'الشعبة الثانية خلف زرّ').not.toContain('موعد آخر')
    expect(html.match(/type="radio"/g)?.length ?? 0, 'لكلّ شعبة خيارها').toBe(2)
    expect(html).toContain('role="radiogroup"')
    expect(html, 'المختارة غير معلّمة').toMatch(/<input(?=[^>]*value="c-ines")(?=[^>]*checked="")[^>]*>/)
    expect(html).not.toMatch(/<input(?=[^>]*value="c-ahmad")(?=[^>]*checked="")[^>]*>/)
  })

  it('⚠️ في صندوق كلٍّ صورة مدرّبه وباب نبذته في صفحة الفريق', () => {
    const html = render(both)
    expect(html).toContain('src="/api/v1/trainer-photos/ahmad.webp"')
    expect(html).toContain('href="/trainers#trainer-p-ahmad"')
    expect(html).toContain('href="/trainers#trainer-p-ines"')
    expect(html).toContain('نبذة المدرب')
    /* ومن لا صورة له تُرسم حروفُه لا أيقونةٌ مكسورة */
    expect(html).toContain('>أ</span>')
  })

  it('وشعبة واحدة صندوق بلا خيار — ومن لا باب له لا رابط', () => {
    const html = render(cohortOptionsFrom([row({ trainerProfiles: undefined })]).get('C-1') ?? [])
    expect(html).not.toContain('type="radio"')
    expect(html).toContain('احمد صالح الطيار')
    expect(html).not.toContain('href="/trainers#')
  })
})

describe('٢ب) صورة المدرب كبيرة في صندوق الشعبة — في كل شراء من الموقع (٢٤ أكتوبر ٢٠٢٦)', () => {
  /* قرارُ صاحب المنصّة: «اجعل صورةَ المدرّب أكبر عندما يقوم الزائرُ بشراء دورةٍ أو مسارٍ من الموقع… سواءً بعد تشخيصٍ أو
     مساراتٍ جاهزةٍ أو دوراتٍ جاهزة. أبدع في التصميم». والمنتقي واحدٌ في المواضع كلّها — فالحارسُ عليه وعلى أنّها تناديه. */
  const one = render(cohortOptionsFrom([row()]).get('C-1') ?? [])

  it('⚠️ مدرب واحد: صورته كبيرة في إطار متدرج، وشارة «مباشر»، و«مدربك» واسمه وباب نبذته بجانبها', () => {
    expect(one).toMatch(/<img [^>]*src="\/api\/v1\/trainer-photos\/ahmad\.webp"[^>]*class="grid h-20 w-20 [^"]*rounded-2xl sm:h-24 sm:w-24/)
    expect(one, 'الإطار المتدرج').toMatch(/bg-gradient-to-br from-gold via-teal-light to-teal-deep p-\[3px\]/)
    expect(one).toContain('مباشر')
    expect(one).toContain('مدربك')
    expect(one).toContain('href="/trainers#trainer-p-ahmad"')
    /* والصورةُ ليست رابطا: الضغطُ عليها في صندوق الاختيار لا ينقله عن صفحة الشراء */
    expect(one, 'الصورة داخل رابط').not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<img /)
    expect(one, 'عاد الوجه الصغير').not.toMatch(/h-11 w-11/)
  })

  it('⚠️ واسم الشعبة أول ما في الصندوق — أكبر من اسم المدرب وكاملا بلا قص (٢٦ أكتوبر ٢٠٢٦)', () => {
    /* «يجب أن يكون عنوانُ الدورة ظاهرا فهو أهمُّ من المدرّب واسمه» (صاحب المنصّة) */
    const at = one.indexOf('شعبة 1')
    expect(at, `اسم الشعبة غائب: ${one.slice(0, 1200)}`).toBeGreaterThan(-1)
    /* وسمُ العنصر الذي يحمله — آخرُ «<span» قبله */
    const tag = one.slice(one.lastIndexOf('<span', at), at)
    expect(tag).toContain('text-lg')
    expect(tag, 'مقصوص').not.toContain('truncate')
    expect(at, 'قبل الصورة').toBeLessThan(one.indexOf('<img '))
    const nameAt = one.indexOf('احمد صالح الطيار')
    expect(nameAt).toBeGreaterThan(at)
    const nameTag = one.slice(one.lastIndexOf('<span', nameAt), nameAt)
    expect(nameTag, 'اسم المدرب أكبر من اسم الشعبة').not.toMatch(/text-(lg|xl)/)
    expect(nameTag).toContain('text-base')
  })

  it('⚠️ وبلا صورة: حروف اسمه بحجم الصورة نفسه — فلا تتفاوت الصناديق', () => {
    const html = render(cohortOptionsFrom([ines]).get('C-1') ?? [])
    expect(html).toMatch(/<span [^>]*aria-hidden="true" class="grid h-20 w-20 [^"]*sm:h-24 sm:w-24 bg-teal-deep [^"]*">أ<\/span>/)
  })

  it('⚠️ ومدربان في شعبة: وجهان أصغر جنبا إلى جنب لا صورتان كبيرتان', () => {
    const two = row({ trainerProfiles: [
      { id: 'p-ahmad', name: 'احمد صالح الطيار', photoUrl: '/api/v1/trainer-photos/ahmad.webp' },
      { id: 'p-ines', name: 'ايناس عاهد ذيب', photoUrl: null },
    ], trainers: ['احمد صالح الطيار', 'ايناس عاهد ذيب'] })
    const html = render(cohortOptionsFrom([two]).get('C-1') ?? [])
    expect(html).not.toContain('from-gold via-teal-light')
    expect(html.match(/h-14 w-14/g)?.length).toBe(2)
  })

  it('⚠️ والمنتقي نفسه في صفحة الدورة ورحلة المسار وعرض التشخيص', () => {
    expect(code('src/pages/CoursePath.tsx')).toMatch(/<CohortPicker\b/)
    expect(code('src/components/CourseJourney.tsx')).toMatch(/<CohortPicker\b/)
    expect(code('src/components/journey/StageOffer.tsx')).toMatch(/<CohortPicker\b/)
  })
})

describe('٣) ورحلة الدورات لا تجمعهم في شارة واحدة', () => {
  it('⚠️ شارة «المدرب: …» لا تظهر حيث المنتقي ظاهر', () => {
    expect(code('src/components/CourseJourney.tsx')).toMatch(/\{!showSchedule && <CourseTrainer courseId=\{c\.id\} \/>\}/)
  })
})

describe('٤) صفحة الفريق: «لم يصل» غير «لا أحد»', () => {
  const page = code('src/pages/Trainers.tsx')

  it('⚠️ بيان الصفر لا يقال إلا عن جواب وصل', () => {
    expect(page).toMatch(/useState<PublicTrainer\[\] \| null>\(null\)/)
    expect(page).toMatch(/approved !== null && filteredApproved\.length === 0 && !query/)
    expect(page).toContain('جار تحميل المدربين')
  })

  it('⚠️ والطلب يعاد حين يخفق — لا تحديث باليد', () => {
    expect(page).toMatch(/withRetry\(\(\) => apiGet<PublicTrainer\[\]>\('\/api\/trainers\/public'\)/)
    expect(page).toMatch(/useAutoRefresh\(load/)
    expect(code('src/services/cohort-prices.ts')).toMatch(/withRetry\(async \(\) => \{\s*const r = await fetch\(`\$\{API_BASE\}\/api\/public\/cohorts`\)\s*if \(!r\.ok\) throw/)
  })
})
