/* أعطابُ جانب المدرّب — رآها صاحبُ المنصّة في صور «قبل/بعد» واعتمدها (١٩ أكتوبر ٢٠٢٦).
   والخادمُ في `server/tests/trainer/applicant-status-trainer-side.test.ts`؛ وهنا ما يُرى:

   ① «حالة طلبك»: من وقّع يُقال له «وقعت العقد»، ومن في التهيئة يُقال له إنّ البوّابة مفتوحة ويجد زرَّها.
   ② زرّا رسالتين يفتحان ما يسمّيانه: «افتح «دوراتي» وابدأ» إلى «دوراتي»، و«افتح «شعبي»…» إلى «شعبي».
   ③ ولا «اقترح تأجيلا» — المدرّبُ ينقل لقاءه بنفسه منذ ١٧ سبتمبر ٢٠٢٦.
   ④ و«ذكّرهم» إلى مركز التواصل في «طلبتي» — لا إلى صفحة شعبةٍ لا مراسلةَ فيها.
   ⑤ والحسابُ البنكيّ لا يُعرض في التهيئة ثمّ يُردّ: يُقال ما يمنعه بدله.
   ⑥ وحالُ التسجيل الجاري لا يُطبع «enrolled».

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APPLICANT_STATUS, CONTRACT_SIGNED_STATUS } from '@/application/trainer/application-options'
import { buildWorkQueue } from '@/application/trainer/work-queue'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① «حالة طلبك» تقول ما وقع', () => {
  const page = code('src/pages/ApplicantStatus.tsx')

  it('⚠️ من وقّع وتوقيعه ينتظرنا يقرأ «وقعت العقد» — لا «أرسلنا لك العقد»', () => {
    expect(page).toMatch(/mine\.status === "contract_pending" && mine\.contractSignedAt \? CONTRACT_SIGNED_STATUS/)
    expect(CONTRACT_SIGNED_STATUS.label).toBe('وقعت العقد')
    expect(CONTRACT_SIGNED_STATUS.explain).not.toMatch(/بعد توقيعه/)
  })

  it('⚠️ ومن في التهيئة يقرأ أنّ البوّابة مفتوحة — ويجد زرّها', () => {
    expect(APPLICANT_STATUS.onboarding.explain).not.toMatch(/تفتح لك بوابة|عند اكتمالها/)
    expect(APPLICANT_STATUS.onboarding.explain).toMatch(/مفتوحة لك/)
    expect(page).toMatch(/\(mine\.status === "active" \|\| mine\.status === "onboarding" \|\| isTrainer\) && \(\s*<Link\s+to="\/trainer"/)
  })

  it('وما يقال بلا تشكيل إعرابيّ', () => {
    for (const t of [CONTRACT_SIGNED_STATUS.label, CONTRACT_SIGNED_STATUS.explain, APPLICANT_STATUS.onboarding.explain]) {
      expect(t).not.toMatch(/[ً-ِْ]/)
    }
  })
})

describe('② زرّ الرسالة يفتح ما يسمّيه', () => {
  const svc = code('server/services/trainer-review.service.ts')

  it('⚠️ «افتح «دوراتي» وابدأ» إلى «دوراتي» — و«افتح «شعبي»…» إلى «شعبي»', () => {
    const approved = svc.slice(svc.indexOf('const mail = contractApprovedMail({'))
    expect(approved.slice(0, 400)).toMatch(/portalUrl: `\$\{publicSiteUrl\(\)\}\/trainer\/qualifications`/)
    const reminder = svc.slice(svc.indexOf('const mail = conditionReminderMail({'))
    expect(reminder.slice(0, 500)).toMatch(/portalUrl: `\$\{publicSiteUrl\(\)\}\/trainer\/board`/)
  })
})

describe('③ ولا «اقترح تأجيلا»', () => {
  it('⚠️ «جدولي» و«شعبي» لا يعدان بتأجيلٍ يُقترح', () => {
    for (const f of ['src/pages/trainer/Schedule.tsx', 'src/pages/trainer/CohortBoard.tsx']) {
      expect(code(f), f).not.toMatch(/اقترح تأجيلا|تقترح من بطاقة|اقتراحات تأجيل اللقاءات ومآلها/)
    }
  })
})

describe('④ «ذكّرهم» إلى مركز التواصل', () => {
  it('⚠️ يفتح «طلبتي» على الشعبة — لا صفحة الشعبة', () => {
    const now = Date.now()
    const items = buildWorkQueue([{
      cohort: {
        id: 'C1', title: 'شعبة', status: 'active', sessions: [],
        enrollments: [{ id: 'E1', status: 'enrolled' }],
        assessments: [{ id: 'A1', title: 'مهمّة', dueAt: new Date(now - 86_400_000).toISOString(), status: 'published', submissions: [] }],
      },
    }], 0, now)
    const remind = items.find((i) => i.kind === 'not_submitted')
    expect(remind, 'لا بند «لم يسلّموا»').toBeDefined()
    expect(remind!.href).toBe('/trainer/learners?cohort=C1')
  })
})

describe('⑤ والحسابُ البنكيّ في التهيئة', () => {
  it('⚠️ يُقال ما يمنعه بدل خانةٍ يُردّ حفظها', () => {
    /* والخانةُ صارت مشتركةً بين المدرّب والمستشار (١٩ أكتوبر ٢٠٢٦) — والصفحةُ تستعملها */
    expect(code('src/pages/trainer/Earnings.tsx')).toMatch(/<BankAccountPanel endpoint="\/api\/trainer\/bank-account" copy=\{BANK_COPY\.trainer\} \/>/)
    const panel = code('src/components/BankAccountPanel.tsx')
    expect(panel).toMatch(/if \(state\.writeProblemAr && !state\.account\) \{/)
  })
})

describe('⑥ وحالُ التسجيل بالعربيّة', () => {
  it('⚠️ «enrolled» لا يُطبع بلفظه', () => {
    const page = code('src/pages/trainer/MyLearners.tsx')
    expect(page).toMatch(/enrolled: "مسجّل"/)
    expect(page).toMatch(/const ONGOING = new Set\(\["active", "enrolled"\]\)/)
  })
})
