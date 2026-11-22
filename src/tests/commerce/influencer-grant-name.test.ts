/* منحةُ المؤثّر باسمه، وقيمةُ الخصم لا ما تدفعه الأكاديميّة (٢٢ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة في صفحة كاسيت: «استبدل هذا النصّ بنصٍّ يركّز على قيمة الخصم، لا كم تدفع الأكاديميّةُ عنك؛ ولا تذكر
   "منحة مؤثرين وجيز" لأنّها منحةُ كاسيت». فما يراه متابعُ المؤثّر:
   ① **اسمُها «منحة <المؤثّر>»** — `influencerGrantNameAr`، و«منحة وجيز» إن لم يُعرف مؤثّرُه. وشاشاتُ الإدارة باسم الحملة.
   ② **وسطرُ القيمة «خصمك 70% — توفر $480»** — النسبةُ أوّلا ثمّ ما يوفّره، بدل «قيمة منحتك … تدفعها الأكاديمية عنك».
   ③ **والصفحةُ تبنيهما منهما** — رأسُها وعنوانُها وما بعد النموذج ورسالةُ المستشار، ولوحُ الشراء وبطاقةُ كوده من الخادم.
   ④ **والحملاتُ الأخرى كما كانت** — «منحة وجيز» و«بلاك فرايدي وجيز» بنصوصهما.
   وبريدُ المتابع في `server/tests/commerce/influencer-grant-name.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BLACK_FRIDAY_GRANT_NAME_AR, BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_NAME_AR, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_NAME_AR,
  MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, grantTitleAr, influencerGrantNameAr,
} from '@/application/commerce/grant'
import {
  GRANT_SAVES_AR, GRANT_VALUE_AR, GRANT_VALUE_PAID_AR, grantDiscountAr, grantDiscountLineAr, grantPicksPreheaderAr,
  grantPicksSavingPreheaderAr,
} from '@/application/commerce/grant-landing'

/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق حرفٌ في تعليق */
const code = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/MemberGrantPage.tsx')
/* حركاتُ الإعراب والتنوين والسكون والمدّة — والشدّةُ وحدَها تبقى (قرارُ ١١ أكتوبر ٢٠٢٦) */
const DIACRITICS = /[ً-ِْٰ]/
const PAYS_FOR_YOU = /تدفع عنك|تدفعها الأكاديمية عنك/

describe('① اسمها باسم المؤثر', () => {
  it('⚠️ «منحة كاسيت» — و«منحة وجيز» إن لم يعرف المؤثر، ولا «منحة مؤثرين وجيز» أبدا', () => {
    expect(influencerGrantNameAr('كاسيت')).toBe('منحة كاسيت')
    expect(influencerGrantNameAr('  ChatTree ')).toBe('منحة ChatTree')
    for (const none of [null, undefined, '', '   ']) expect(influencerGrantNameAr(none)).toBe(MEMBER_GRANT_NAME_AR)
    expect(influencerGrantNameAr('كاسيت')).not.toContain(INFLUENCER_GRANT_NAME_AR)
  })

  it('⚠️ اسم منحة الكود: باسم مؤثره في منحة المؤثرين، وباسم الحملة فيما سواها', () => {
    const inf = { slug: INFLUENCER_GRANT_SLUG, nameAr: INFLUENCER_GRANT_NAME_AR }
    expect(grantTitleAr(inf, { nameAr: 'كاسيت' })).toBe('منحة كاسيت')
    expect(grantTitleAr(inf, null), 'قيل اسم الحملة الداخلي لمتابع').toBe('منحة وجيز')
    /* وبلاك فرايدي برابط مؤثّرٍ ليست منحتَه — تبقى باسمها */
    expect(grantTitleAr({ slug: BLACK_FRIDAY_GRANT_SLUG, nameAr: BLACK_FRIDAY_GRANT_NAME_AR }, { nameAr: 'كاسيت' })).toBe('بلاك فرايدي وجيز')
    expect(grantTitleAr({ slug: MEMBER_GRANT_SLUG, nameAr: MEMBER_GRANT_NAME_AR }, null)).toBe('منحة وجيز')
    expect(grantTitleAr({ slug: OPEN_GRANT_SLUG, nameAr: 'منحة وجيز العامة' }, null)).toBe('منحة وجيز العامة')
  })
})

describe('② قيمة الخصم لا ما تدفعه الأكاديمية', () => {
  it('⚠️ «خصمك 70% — توفر $480.00»: النسبة أولا ثم ما يوفره', () => {
    expect(grantDiscountAr(70)).toBe('خصمك 70%')
    expect(GRANT_SAVES_AR).toBe('توفر')
    expect(grantDiscountLineAr(70, '$480.00')).toBe('خصمك 70% — توفر $480.00')
    expect(grantPicksSavingPreheaderAr(3, 70, '$330.00')).toBe('ما اخترته: 3 دورات، خصمك 70% — توفر $330.00.')
    for (const t of [grantDiscountLineAr(70, '$480.00'), grantPicksSavingPreheaderAr(1, 45, '$55.00')]) {
      expect(t, t).not.toMatch(PAYS_FOR_YOU)
      expect(t, t).not.toMatch(DIACRITICS)
    }
  })
})

describe('③ الصفحة تبنيهما منهما', () => {
  it('⚠️ رأسها وعنوانها وما بعد النموذج ورسالة المستشار باسم المؤثر — واسم الحملة لا يعرض', () => {
    expect(PAGE).toMatch(/const shownNameAr = forInfluencer \? influencerGrantNameAr\(view\?\.influencer\?\.nameAr\) : nameAr;/)
    expect(PAGE).toContain('<h1 className="mt-2 text-3xl font-black">{shownNameAr}</h1>')
    expect(PAGE).toMatch(/\? \{ title: shownNameAr, path: `\$\{influencerBase\}/)
    expect(PAGE).toContain('grantWhyHereAr({ grantNameAr: shownNameAr,')
    expect(PAGE).toMatch(/recordLink: grantRecordLink\([^)]*\), grantNameAr: shownNameAr,/)
    /* واسمُ الحملة الداخليُّ لا يُعرض: يبقى لعدِّ ما بقي على كوده وصفحتَي بلاك فرايدي والعامة */
    expect(PAGE, 'عرض اسم الحملة في الصفحة').not.toMatch(/\{nameAr\}|grantNameAr: nameAr|title: nameAr, path: `\$\{influencerBase\}/)
  })

  it('⚠️ وسطر القيمة «خصمك … — توفر» لكل المنح — ولا «تدفعها الأكاديمية عنك» في الصفحة', () => {
    /* ثمّ لكلّ المنح (٢٢ نوفمبر ٢٠٢٦، «طبّق هذا لكافّة المنح أيضا»): لا «تدفعها الأكاديمية عنك» في الصفحة أصلا */
    expect(PAGE).toMatch(/\{grantDiscountAr\(pct\)\} — \{GRANT_SAVES_AR\} <bdi dir="ltr">\{money\(listTotal - payTotal\)\}<\/bdi>/)
    expect(PAGE, 'قيل «تدفعها الأكاديمية عنك»').not.toMatch(/\{GRANT_VALUE_PAID_AR\}/)
    expect(PAGE, 'نص حرفي يقول ما تدفعه الأكاديمية').not.toMatch(PAYS_FOR_YOU)
  })

  it('⚠️ ولوح الشراء وبطاقة كوده باسم منحته كما يراها — من الخادم', () => {
    expect(code('server/services/commerce/cart.service.ts')).toMatch(/grantNameAr: coupon\?\.grantCode \? grantTitleAr\(coupon\.grantCode\.campaign, coupon\.grantCode\.influencer\) : null/)
    expect(code('server/services/grant.service.ts')).toMatch(/titleAr: grantTitleAr\(campaign, coupon\.grantCode\?\.influencer\)/)
    expect(code('src/components/MyGrantCard.tsx')).toContain('{grant.titleAr ?? grant.nameAr}:')
  })
})

describe('④ والحملات الأخرى كما كانت', () => {
  it('⚠️ «منحة وجيز» و«بلاك فرايدي وجيز» بنصوصهما', () => {
    expect(MEMBER_GRANT_NAME_AR).toBe('منحة وجيز')
    expect(BLACK_FRIDAY_GRANT_NAME_AR).toBe('بلاك فرايدي وجيز')
    expect(INFLUENCER_GRANT_NAME_AR, 'تغير اسم الحملة في الإدارة').toBe('منحة مؤثرين وجيز')
    expect(`${GRANT_VALUE_AR} $480.00 ${GRANT_VALUE_PAID_AR}`).toBe('قيمة منحتك $480.00 تدفعها الأكاديمية عنك')
    expect(grantPicksPreheaderAr(3, '$330.00')).toBe('ما اخترته: 3 دورات، ومنحتك تدفع عنك $330.00.')
  })
})
