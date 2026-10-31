/* من عبّأ نموذج المنحة: مصدرُه وإحصاءاتُه (٣١ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `src/application/commerce/grant-registrants.ts`.

   ① **المصدرُ بترتيبه**: المؤثّرُ أوّلا بكوده وحدَه (قناتُه كودُه فلا يُعاد)، ثمّ رابطُ مدرّبٍ باسمه في أيٍّ من الزيارتين،
      ثمّ «هدية من صديق»، ثمّ رسائلُ الأكاديمية بمنصّتها، ثمّ المنصّاتُ والمواقع، ثمّ المباشر — ومن لا زيارةَ له «غير معروف».
   ② **والإحصاءات**: العددُ والشراءُ لكلّ مصدر، وباليوم والساعة بتوقيت عمّان، والوسيطُ بين فتح الصفحة والتعبئة، والرسائلُ بحالها.
   ③ **ونصُّ الرسالة فقراتٌ** يفصلها سطرٌ فارغ.
   ④ **ونصوصُ الشاشة بلا تشكيل.** */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SOURCE_GROUP_AR, conversionAr, messageParagraphs, registrantSource, registrantStats, type StatRow,
} from '@/application/commerce/grant-registrants'
import { plainAr } from '@/application/text/plain-ar'

const base = { influencer: false, influencerCode: null, channel: null, wave: null, pageTouch: null, firstTouch: null }
const T = '2026-10-30T09:00:00.000Z'

describe('① المصدر بترتيبه', () => {
  it('⚠️ المؤثر بكوده وحده — وقناته كوده فلا تعاد', () => {
    const s = registrantSource({ ...base, influencer: true, influencerCode: 'SARA', channel: 'sara', pageTouch: { channel: 'sara', at: T } })
    expect(s.group).toBe('influencer')
    expect(s.labelAr).toBe('مؤثر · كود SARA')
    expect(s.labelAr.match(/sara/gi)).toHaveLength(1)
  })

  it('⚠️ رابط المدرب باسمه — من صفحة المنحة أو من أول زيارة', () => {
    const name = (c: string) => (c === 'WJ-AB12' ? 'ليلى' : null)
    expect(registrantSource({ ...base, pageTouch: { refCode: 'WJ-AB12', at: T }, trainerName: name }))
      .toMatchObject({ group: 'trainer', labelAr: 'رابط المدرب ليلى' })
    /* فتح الصفحةَ مباشرة بعد أن عرفنا برابط مدرّبه قبل يومين — يُنسب للمدرّب */
    expect(registrantSource({ ...base, pageTouch: { at: T }, firstTouch: { refCode: 'WJ-AB12', at: '2026-10-28T09:00:00.000Z' }, trainerName: name }))
      .toMatchObject({ group: 'trainer', labelAr: 'رابط المدرب ليلى' })
    expect(registrantSource({ ...base, pageTouch: { refCode: 'WJ-ZZ99', at: T }, trainerName: name }).labelAr).toBe('رابط مدرب')
  })

  it('⚠️ هدية من صديق، ورسائل الأكاديمية بمنصتها ودفعتها', () => {
    expect(registrantSource({ ...base, channel: 'share' }).group).toBe('share')
    const s = registrantSource({ ...base, channel: 'email', wave: '2', pageTouch: { channel: 'email', wave: '2', at: T } })
    expect(s).toMatchObject({ group: 'academy', labelAr: 'رسائل الأكاديمية · البريد' })
    expect(s.detailAr).toContain('دفعة 2')
  })

  it('⚠️ المنصات والإعلانات، والمواقع والبحث، والمباشر، وغير المعروف', () => {
    expect(registrantSource({ ...base, pageTouch: { utmSource: 'facebook', utmMedium: 'cpc', utmCampaign: 'oct', at: T } }))
      .toMatchObject({ group: 'platform', labelAr: 'فيسبوك (إعلان)', detailAr: 'حملة oct' })
    expect(registrantSource({ ...base, pageTouch: { referrerHost: 'instagram.com', at: T } }).group).toBe('platform')
    expect(registrantSource({ ...base, pageTouch: { referrerHost: 'google.com', at: T } })).toMatchObject({ group: 'site', labelAr: 'بحث جوجل' })
    expect(registrantSource({ ...base, pageTouch: { landingPath: '/grant', at: T } })).toMatchObject({ group: 'direct', labelAr: 'مباشر من الموقع' })
    expect(registrantSource(base)).toMatchObject({ group: 'unknown', detailAr: 'عبأ قبل تتبع المصدر' })
  })

  it('⚠️ الزيارة الأولى تقال إن سبقت فتح الصفحة بيوم أو أكثر', () => {
    const s = registrantSource({ ...base, pageTouch: { at: T }, firstTouch: { referrerHost: 'google.com', at: '2026-10-20T09:00:00.000Z' } })
    expect(s.group).toBe('site')
    expect(s.detailAr).toBe('أول زيارة 2026-10-20 من بحث جوجل')
    expect(registrantSource({ ...base, pageTouch: { at: T }, firstTouch: { at: '2026-10-30T08:00:00.000Z' } }).detailAr).toBeNull()
  })
})

const row = (o: Partial<StatRow>): StatRow => ({
  createdAt: T, pageOpenedAt: null, state: 'none', influencer: false, code: 'WG-AAAAAAAA', advisor: null, workField: 'الهندسة',
  careerLevel: null, interests: [], picks: [], source: { group: 'direct', labelAr: 'مباشر من الموقع', detailAr: null }, mails: [], ...o,
})

describe('② الإحصاءات', () => {
  it('⚠️ العدد والشراء لكل مصدر، وباليوم والساعة بتوقيت عمان، ووسيط فتح الصفحة إلى التعبئة', () => {
    const s = registrantStats([
      row({ state: 'bought', source: { group: 'trainer', labelAr: 'x', detailAr: null }, pageOpenedAt: '2026-10-30T08:50:00.000Z' }),
      row({ source: { group: 'trainer', labelAr: 'y', detailAr: null }, pageOpenedAt: '2026-10-30T08:30:00.000Z', interests: ['أ', 'ب'] }),
      row({ createdAt: '2026-10-29T22:30:00.000Z', state: 'pending', influencer: true, code: null, advisor: 'سعاد', interests: ['أ'] }),
      row({ mails: [{ purpose: 'grant.code', status: 'sent' }, { purpose: 'grant.reminder', status: 'failed' }] }),
    ])
    expect(s).toMatchObject({ total: 4, bought: 1, pending: 1, none: 2, boughtPct: 25, withCode: 3, withAdvisor: 1, member: 3, influencer: 1 })
    expect(s.bySource[0]).toMatchObject({ key: 'trainer', labelAr: SOURCE_GROUP_AR.trainer, n: 2, bought: 1 })
    expect(conversionAr(s.bySource[0])).toBe('1 من 2 · 50%')
    /* ٢٢:٣٠ بتوقيت غرينتش هي ١:٣٠ فجرَ الثلاثين في عمّان — فيومُها الثلاثون وساعتُها الواحدة */
    expect(s.byDay).toEqual([{ day: '2026-10-30', n: 4 }])
    expect(s.byHour[1].n).toBe(1)
    expect(s.byHour[12].n).toBe(3)
    expect(s.openToFormMedianMin).toBe(20)
    expect(s.opened).toBe(2)
    expect(s.byInterest).toEqual([
      { key: 'أ', labelAr: 'أ', n: 2, bought: 0 },
      { key: 'ب', labelAr: 'ب', n: 1, bought: 0 },
    ])
    expect(s.mails).toMatchObject({ total: 2, sent: 1, failed: 1, queued: 0 })
    expect(s.mails.byPurpose.map((c) => c.labelAr)).toEqual(['كود المنحة', 'تذكير قبل انتهاء المنحة'])
  })
})

describe('③ نص الرسالة فقرات', () => {
  it('⚠️ يفصلها سطر فارغ، والأسطر داخل الفقرة تبقى', () => {
    expect(messageParagraphs('مرحبا بكم\r\n\r\n  السطر الأول\nالسطر الثاني  \n\n\n')).toEqual(['مرحبا بكم', 'السطر الأول\nالسطر الثاني'])
    expect(messageParagraphs('   \n\n ')).toEqual([])
  })
})

describe('④ نصوص الشاشة بلا تشكيل', () => {
  it('⚠️ أسماء المصادر ونصوص الأزرار', () => {
    const screen = readFileSync('src/pages/admin/GrantRegistrants.tsx', 'utf8') + readFileSync('src/pages/admin/GrantRegistrantStats.tsx', 'utf8')
    for (const t of [...Object.values(SOURCE_GROUP_AR), 'تنزيل Excel', 'احذفه وأبطل كوده', 'احذفه وأبق كوده', 'ما وصله', 'ما هو آت', 'فتح صفحة المنحة']) {
      expect(t).toBe(plainAr(t))
    }
    expect(screen).toContain('احذفه وأبطل كوده')
  })
})
