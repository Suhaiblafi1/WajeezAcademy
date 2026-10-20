/* «ما بقي من دوراتك» — ما يُعدّ عليه، وما تقوله الرسالة (٢٠ أكتوبر ٢٠٢٦).
   قرارُ صاحب المنصّة: لكلّ مدرّبٍ ما ينقصه وموعدٌ نهائيّ، والحملةُ التسويقيّةُ قريبة، وملفُّه يُغلق إن لم يكمل — بلطف. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { missingAr, prepReminderMail } from '../../services/prep-reminder.service'
import { renderMail } from '../../services/mail-template'

describe('ما بقي عليه', () => {
  it('لم يقبلها، ولم يرسل خطتها، ورددناها إليه — وما ليس عليه لا يعد', () => {
    expect(missingAr({ state: 'to_decide' })).toMatch(/لم تقبلها/)
    expect(missingAr({ state: 'preparing' })).toMatch(/لم ترسل خطة شعبتها/)
    expect(missingAr({ state: 'returned', postponedTo: null })).toMatch(/رددناها إليك/)
    expect(missingAr({ state: 'returned', postponedTo: '2027-02-01' }), 'المؤجلة عدت عليه').toBeNull()
    expect(missingAr({ state: 'submitted' }), 'ما ينتظرنا عد عليه').toBeNull()
    expect(missingAr({ state: 'approved' })).toBeNull()
    expect(missingAr({ state: 'declined' })).toBeNull()
  })
})

describe('الرسالة', () => {
  const mail = prepReminderMail({
    name: 'ياسمين', deadlineAr: 'الأحد 27 أكتوبر 2026', portalUrl: 'https://x.test/trainer/qualifications',
    items: [{ titleAr: 'دورة التسعير', missingAr: 'لم تقبلها بعد' }, { titleAr: 'دورة خطة العمل', missingAr: 'لم ترسل خطة شعبتها' }],
  })
  const t = renderMail(mail.doc).text
  it('كل دورة بما بقي فيها، والموعد، والحملة، وإغلاق الملف بلطف', () => {
    expect(t).toContain('دورة التسعير')
    expect(t).toContain('لم ترسل خطة شعبتها')
    expect(mail.subject).toContain('الأحد 27 أكتوبر 2026')
    expect(t).toMatch(/حملتنا التسويقية/)
    expect(t).toMatch(/سنضطر آسفين إلى إغلاق ملفك/)
    expect(t).toMatch(/فرد على هذه الرسالة/)
    expect(mail.doc.blocks.some((b) => b.kind === 'cta' && b.href === 'https://x.test/trainer/qualifications')).toBe(true)
    expect([mail.subject, t].join('\n'), 'قيل «عرضك»').not.toMatch(/عرض[َُِ]?ك/)
  })
})

describe('في صفحة المدربين لا في العقود', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
  it('سطر في بطاقة كل مدرب بقي عليه شيء، وموعد واحد أعلى الصفحة', () => {
    expect(page).toMatch(/<TrainerCourses trainer=\{t\} \/>\s*\{reminders\.has\(t\.profileId\) && <PrepReminderRow row=\{reminders\.get\(t\.profileId\)!\} deadline=\{deadline\} \/>\}/)
    expect(page).toMatch(/<ReminderDeadline value=\{deadline\} onChange=\{setDeadline\}/)
  })
})
