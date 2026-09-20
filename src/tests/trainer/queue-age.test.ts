/* عمرُ الطلب في الطابور — ولمن يُقرأ اللون.

   ═══ ما يُحرَس ═══

   ① **اللونُ لما ينتظرنا وحدَه** — طلبٌ في «نحتاج معلومات إضافية» ينتظر
      صاحبَه، فلو احمرَّ لقرأه الموظّفُ دَينا عليه واستعجل قرارا لا يملك
      مادّته. والتفريقُ هو ما يجعل الأحمرَ خبرا.
   ② **ومن وقع فيه قرارٌ لا عمرَ له** — لا شيءَ ينتظر، وشارةٌ عليه ضجيج.
      وقائمةُ الانتظار مثلُه: وقوفُها مقصود.
   ③ **والحدّان يُفحصان عند طرفَيهما** — سبعةٌ تُنبّه وأربعةَ عشرَ تُنادي،
      وما قبلهما بيومٍ لا يتلوّن. فحدٌّ يُكتب `>` بدل `>=` يزحف يوما بلا
      أن يسقط شيء.
   ④ **والعددُ يُصاغ عربيّا** — «1 أيّام» و«2 يوما» تُقرأ في كلّ صفّ. */

import { describe, expect, it } from 'vitest'
import {
  AGE_LATE_DAYS, AGE_WARN_DAYS, AWAITING_APPLICANT, AWAITING_US, queueAge,
} from '@/application/trainer/queue-age'

const NOW = new Date('2026-09-19T10:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

describe('ما ينتظرنا يتلوّن', () => {
  it.each([
    [0, 'calm'], [6, 'calm'], [7, 'warn'], [13, 'warn'], [14, 'late'], [40, 'late'],
  ] as const)('بعد %i يوما → %s', (days, tone) => {
    expect(queueAge('under_review', daysAgo(days), NOW)?.tone).toBe(tone)
  })

  it('والحدّان عند طرفَيهما لا بعدهما بيوم', () => {
    expect(queueAge('submitted', daysAgo(AGE_WARN_DAYS - 1), NOW)?.tone).toBe('calm')
    expect(queueAge('submitted', daysAgo(AGE_WARN_DAYS), NOW)?.tone).toBe('warn')
    expect(queueAge('submitted', daysAgo(AGE_LATE_DAYS - 1), NOW)?.tone).toBe('warn')
    expect(queueAge('submitted', daysAgo(AGE_LATE_DAYS), NOW)?.tone).toBe('late')
  })

  it('وكلُّ حالةٍ تنتظرنا تقول «عندنا»', () => {
    for (const status of AWAITING_US) {
      expect(queueAge(status, daysAgo(3), NOW)?.ar, status).toContain('عندنا')
    }
  })
})

describe('وما ينتظر صاحبَه يُقال ولا يتلوّن', () => {
  it.each([...AWAITING_APPLICANT])('«%s» يبقى هادئا مهما طال', (status) => {
    const old = queueAge(status, daysAgo(60), NOW)
    expect(old?.tone, `${status}: احمرَّ وهو ينتظر صاحبَه`).toBe('calm')
    expect(old?.ar).toContain('بانتظاره')
  })
})

describe('ومن لا عمرَ له', () => {
  it.each(['active', 'rejected', 'withdrawn', 'suspended', 'waitlisted'])('«%s» بلا شارة', (status) => {
    expect(queueAge(status, daysAgo(30), NOW)).toBeNull()
  })

  it('وبلا تاريخٍ لا تُخترع شارة', () => {
    expect(queueAge('submitted', null, NOW)).toBeNull()
    expect(queueAge('submitted', undefined, NOW)).toBeNull()
    expect(queueAge('submitted', 'ليس تاريخا', NOW)).toBeNull()
  })
})

describe('وصيغةُ العدد عربيّة', () => {
  it.each([
    [0, 'اليوم'], [1, '1 يوم'], [2, '2 يومين'], [5, '5 أيّام'], [11, '11 يوما'],
  ] as const)('%i يوما → «%s»', (days, text) => {
    expect(queueAge('under_review', daysAgo(days), NOW)?.ar).toContain(text)
  })

  it('وساعةٌ في المستقبل لا تُقرأ «منذ -١»', () => {
    /* فرقُ ساعةِ خادمٍ عن متصفّح يجعل `since` بعد `now` بثوانٍ */
    const ahead = new Date(NOW.getTime() + 3_600_000)
    expect(queueAge('submitted', ahead, NOW)?.days).toBe(0)
  })
})

describe('والشاشةُ تقرأ القاعدة ولا تكتبها', () => {
  it('صفُّ الطابور يستدعي الدالّة، ولوحُ السابقِ يُعرض بشرطه', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../../pages/admin/TrainerApplications.tsx', import.meta.url), 'utf8')
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    expect(src, 'الشاشةُ تحسب العمرَ بيدها').toContain('queueAge(a.status, a.waitingSince)')
    /* ═══ والهادئُ يسكت في الصفّ (٢٠ سبتمبر ٢٠٢٦) ═══

       شكا صاحبُ المنصّة أنّ الصفَّ كثيرُ المعلومات، فلم يبقَ فيه إلّا الاسمُ
       والرقمُ والحالةُ ونتيجةُ اللقاء. والشارةُ لم تُحذف — حذفُها يعيد
       الشكوى الأولى (الطلبُ يشيخ بصمت) — بل سكتت عمّن لا يُستعجَل: ما
       تلوّن وحدَه يُقال عمرُه. ولو عاد العرضُ على كلٍّ لسقط هذا. */
    expect(src, 'شارةُ العمر تُعرض على الهادئ أيضا — وهو ضجيجُ الصفّ')
      .toMatch(/age\.tone === "calm"\) return null/)
    expect(src, 'لوحُ «تقدّم سابقا» يُعرض بلا شرطٍ أو لا يُعرض')
      .toMatch(/a\.priorApplications\?\.length \?\? 0\) > 0/)
  })
})
