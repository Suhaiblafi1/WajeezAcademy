/* ═══ إنذارُ حذف المدرّب — شعبُه التي فيها طلاب تُقال قبل الضغط (٢٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Warn, remove for all». والخادمُ يقرأ ما يقع ويفعله
   (`server/tests/trainer/purge-trainer-sessions.test.ts`)، وهنا ما يقوله الحوار: سطرٌ لكلّ شعبةٍ بطلابها وما يُرفع منها،
   وجملةُ الرفع حين يُرفع شيء — في حوار الحذف نفسِه قبل زرّه.

   والإنذارُ يجلب ما يقوله في `useEffect` فلا يُرسَم ساكنا بما فيه — فسطرُه يُفحص محضا، وموضعُه على بنية الشاشة
   بلا تعليقاتها، كأخواته في `host-start-screen.test.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { impactLineAr } from '@/application/trainer/purge-impact'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const row = { id: 'c1', title: 'شعبة الخريف', learners: 3, upcoming: 4, keepsSessions: false }

describe('سطرُ كلّ شعبة', () => {
  it('⚠️ طلابُها بصيغة العدد، وكم لقاءً قادما يُرفع منها', () => {
    expect(impactLineAr(row)).toBe('«شعبة الخريف» — 3 طلاب، ويرفع منها 4 لقاءات قادمة')
    expect(impactLineAr({ ...row, learners: 1, upcoming: 1 })).toBe('«شعبة الخريف» — 1 طالب، ويرفع منها 1 لقاء قادم')
  })

  it('⚠️ وما يبقى فيها مدرّبٌ غيرُه يقول إنّ لقاءاتها تبقى — لا «يرفع»', () => {
    const kept = impactLineAr({ ...row, keepsSessions: true })
    expect(kept).toContain('فتبقى لقاءاتها')
    expect(kept).not.toContain('يرفع')
  })

  it('وما لا لقاءَ قادما فيها يقول طلابَها وحدَهم', () => {
    expect(impactLineAr({ ...row, upcoming: 0 })).toBe('«شعبة الخريف» — 3 طلاب')
  })
})

describe('موضعُه وما يقرؤه', () => {
  const box = read('src/components/admin/PurgeImpact.tsx')
  const page = read('src/pages/admin/TrainerApplications.tsx')

  it('⚠️ يقرأ ما يقع من الخادم بمرجع الطلب — لا يحكم بنفسه', () => {
    expect(box).toMatch(/apiGet<\{ cohorts: ImpactCohort\[\] \}>\(`\/api\/admin\/trainer-applications\/\$\{encodeURIComponent\(reference\)\}\/purge-impact`\)/)
  })

  it('⚠️ وجملةُ الرفع حين يُرفع شيء — وما لم يُقرأ يُقال لا يسكت', () => {
    expect(box).toMatch(/const removing = cohorts\.some\(\(c\) => !c\.keepsSessions && c\.upcoming > 0\)/)
    expect(box).toMatch(/\{removing && \(\s*<p>\s*إن حذفته رفعت لقاءاتها القادمة من تقاويم الجميع/)
    expect(box).toMatch(/if \(err\) return <p role="alert"/)
  })

  it('⚠️ وفي حوار الحذف نفسِه — قبل زرّه', () => {
    const dialog = page.slice(page.indexOf('titleAr={`حذف الطلب ${purging.reference} نهائيّا`}'), page.indexOf('</ConfirmAction>', page.indexOf('titleAr={`حذف الطلب')))
    expect(dialog.length, 'حوار الحذف غائب').toBeGreaterThan(200)
    expect(dialog).toMatch(/<PurgeImpact reference=\{purging\.reference\} \/>/)
  })

  it('والجوابُ يقول ما رُفع بعدده', () => {
    expect(page).toMatch(/if \(r\.removedSessions > 0\) parts\.push\(`ورفع \$\{countAr\(r\.removedSessions, SESSION_COUNT_FORMS\)\} من تقاويم طلابه`\)/)
  })
})
