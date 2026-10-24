/* خطابُ التوصية — القاعدةُ ونصُّه وصفحتُه (٢٢ أكتوبر ٢٠٢٦). والعلّةُ في رأس `src/application/learning/endorsement.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import {
  ENDORSEMENT_MIN_ATTENDANCE, endorsementBodyAr, endorsementEarned, endorsementNumber, endorsementPath, endorsementTally,
} from '@/application/learning/endorsement'
import { faqs } from '@/data/siteContent'
import { GRANT_GAINS_AR } from '@/application/commerce/grant-landing'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/EndorsementLetter.tsx')
const CERTS = code('src/pages/student/Certificates.tsx')
const APP = code('src/App.tsx')

const all = { attendancePct: 80, assignmentsAccepted: 2, assignmentsTotal: 2, assessmentsPassed: 1, assessmentsTotal: 1 }

describe('من يستحق الخطاب', () => {
  it('⚠️ حضور 80% فأكثر ومهامه كلها — ولا يستحقه من نقص أحدهما', () => {
    expect(ENDORSEMENT_MIN_ATTENDANCE).toBe(80)
    expect(endorsementEarned(all)).toBe(true)
    expect(endorsementEarned({ ...all, attendancePct: 79 }), 'حضور أقل').toBe(false)
    expect(endorsementEarned({ ...all, assignmentsAccepted: 1 }), 'تكليف لم يقبل').toBe(false)
    expect(endorsementEarned({ ...all, assessmentsPassed: 0 }), 'اختبار لم يجتز').toBe(false)
    expect(endorsementEarned({}), 'حضور لم يؤخذ').toBe(false)
    expect(endorsementEarned({ attendancePct: 95 }), 'دورة بلا مهام').toBe(true)
    expect(endorsementTally(all)).toEqual({ attendancePct: 80, tasksDone: 3, tasksTotal: 3 })
  })
})

describe('نص الخطاب', () => {
  const facts = { learnerName: 'سارة أحمد', courseTitle: 'إدارة فرق العمل', attendancePct: 92, tasksDone: 4, tasksTotal: 4, skills: ['تفويض المهام'], totalHours: 24 }

  it('⚠️ بأرقامه الحقيقية وشرط استحقاقه — بلغة بيضاء بلا تشكيل', () => {
    const body = endorsementBodyAr(facts).join(' ')
    expect(body).toContain('سارة أحمد')
    expect(body).toContain('«إدارة فرق العمل» (24 ساعة)')
    expect(body).toContain('نسبة الحضور 92% من اللقاءات')
    expect(body).toContain('(4 من 4)')
    expect(body).toContain('80% على الأقل')
    for (const line of endorsementBodyAr(facts)) expect(plainAr(line), line).toBe(line)
    expect(body).not.toContain('عرضك')
  })

  it('⚠️ بلا فعل يذكر صاحبه أو يؤنثه — واسم الدورة لا تتكرر قبله «دورة»', () => {
    const body = endorsementBodyAr({ ...facts, courseTitle: 'دورة إدارة فرق العمل' }).join(' ')
    expect(body).toContain('بإتمام سارة أحمد دورة «إدارة فرق العمل»')
    expect(body).not.toContain('«دورة')
    for (const gendered of [' أتم ', 'حضر 9', 'نوصي به ', 'أظهره', 'تدرب']) expect(body, gendered).not.toContain(gendered)
  })

  it('⚠️ بلا ساعات ولا مهام — لا يكتب «0 من 0»', () => {
    const body = endorsementBodyAr({ ...facts, totalHours: null, tasksDone: 0, tasksTotal: 0 }).join(' ')
    expect(body).not.toContain('ساعة)')
    expect(body).not.toContain('0 من 0')
  })

  it('⚠️ رقمه عشوائي بحروف لا تشتبه — ورابطه', () => {
    const n = endorsementNumber()
    expect(n).toMatch(/^WJ-REC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(new Set(Array.from({ length: 50 }, () => endorsementNumber())).size, 'تكرر').toBeGreaterThan(45)
    expect(endorsementPath('WJ-REC-ABCD-EF23')).toBe('/letter/WJ-REC-ABCD-EF23')
  })
})

describe('صفحته ومواضع ذكره', () => {
  it('⚠️ صفحة عامة لا تفهرس، نصها من `endorsementBodyAr`، ويطبعها صاحبها — والملغى يقال ولا يعرض', () => {
    expect(APP).toMatch(/<Route path="\/letter\/:number" element=\{<EndorsementLetter \/>\} \/>/)
    expect(PAGE).toMatch(/<SeoHead [^>]*noindex \/>/)
    expect(PAGE).toMatch(/endorsementBodyAr\(state\.letter\)\.map/)
    expect(PAGE).toMatch(/apiGet<Letter>\(`\/api\/v1\/letters\/\$\{encodeURIComponent\(number\)\}`\)/)
    expect(PAGE).toContain('window.print()')
    expect(PAGE).toMatch(/state\.letter\.status !== "active" && \(/)
    expect(PAGE).toContain('هذا الخطاب ملغى مع شهادته')
    /* وقاعدةُ الطباعة العامّة تخفي كلَّ `header` و`nav` — فلا يُبنى الخطابُ بهما */
    expect(PAGE).not.toMatch(/<(header|nav|aside)[\s>]/)
  })

  it('⚠️ في «شهاداتي» رابطه للشهادة السارية — وفي صفحة المنحة والأسئلة الشائعة', () => {
    expect(CERTS).toMatch(/c\.status !== "revoked" && c\.endorsementNumber && \(/)
    expect(CERTS).toMatch(/to=\{endorsementPath\(c\.endorsementNumber\)\}/)
    /* وفي صفحة المنحة «رسالة توصية» — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «استبدل كلمةَ خطابٍ إلى رسالة» */
    expect(GRANT_GAINS_AR.find((g) => g.id === 'certificate')?.title).toContain('رسالة توصية')
    expect(faqs.some((f) => f.q.includes('خطاب توصية') && f.a.includes('80%'))).toBe(true)
  })
})
