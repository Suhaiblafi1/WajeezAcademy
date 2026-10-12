/* إعلانُ الإدارة إلى المدرّبين — النافذةُ وشاشةُ الإرسال (٤ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا»، واختار
   نافذةً فيها «قرأتُه» وإشعارا في الجرس وقائمةً بمن قرأ. وقرارُه قبله: «لا تُجبرني على
   فعل — أعطني الخياراتِ وفروقَها». فيُحرَس هنا:

   ① ما تعرضه النافذة: المطلوبُ من الجرس ولو قُرئ، وإلّا أقدمُ ما لم يُقرأ ولم يُؤجَّل.
   ② والنافذةُ لا تمنع: إغلاقُها تأجيلٌ لا قراءة، و«ذكّرني لاحقا» جنبَ «قرأتُه».
   ③ ولا يُرسَل شيءٌ بلا سؤال: «أرسِل…» تسأل، والإرسالُ في خيارٍ من خيارَين.
   ④ والجرسُ يفتح الإعلانَ نفسَه، في صنفٍ يُكتَم — والنافذةُ باقية.
   ⑤ ومن يصير مدرّبا بعد الإرسال: خياران بأثرهما، وإلى يومٍ يُسمّى لا بلا حدّ
      («اعرضه لمن ينضمّ بعدُ أيضا» — ٤ أكتوبر ٢٠٢٦).
   والخادمُ في `server/tests/trainer/trainer-announcements.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_DRAFT, ANNOUNCEMENT_TEMPLATE_KEY, LATE_JOINERS_DRAFT_UNTIL, announcementToShow, defaultLateUntil,
  lateUntilInstant, lateUntilProblem, recipientState,
} from '@/application/trainer/announcement'
import { categoryForTemplate } from '@/application/notifications/categories'
import { notificationHref } from '@/application/notifications/destinations'
import { allSections } from '@/pages/admin/nav-map'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const MODAL = code('src/pages/trainer/TrainerAnnouncement.tsx')
const LAYOUT = code('src/pages/trainer/TrainerLayout.tsx')
const ADMIN = code('src/pages/admin/TrainerAnnouncements.tsx')
const APP = code('src/App.tsx')

/** جسمُ دالّةٍ سهميّةٍ مسمّاة — من `const name = ` إلى أوّل `};` في عمودها */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`const ${name} = `)
  expect(at, `لا دالّة «${name}»`).toBeGreaterThan(-1)
  const end = src.indexOf('\n  };', at)
  return src.slice(at, end)
}

describe('① ما تعرضه النافذة', () => {
  /* الخادمُ يردّها أحدثَها أوّلا */
  const items = [
    { id: 'new', readAt: null },
    { id: 'mid', readAt: '2026-10-04T10:00:00Z' },
    { id: 'old', readAt: null },
  ]
  const none = () => false

  it('⚠️ أقدم ما لم يقرأ — لا أحدثه، فتقرأ بترتيب إرسالها', () => {
    expect(announcementToShow(items, { deferred: none })?.id).toBe('old')
  })

  it('⚠️ وما أجّل في هذه الجلسة يتخطّى إلى ما بعده — ثمّ لا شيء', () => {
    expect(announcementToShow(items, { deferred: (id) => id === 'old' })?.id).toBe('new')
    expect(announcementToShow(items, { deferred: () => true })).toBeNull()
  })

  it('⚠️ والمطلوب من الجرس يفتح ولو قرئ أو أجّل', () => {
    expect(announcementToShow(items, { wanted: 'mid', deferred: () => true })?.id).toBe('mid')
    expect(announcementToShow(items, { wanted: 'gone', deferred: none })?.id, 'مطلوب لا وجود له').toBe('old')
  })

  it('وحال المدرّب في القائمة ثلاث', () => {
    expect(recipientState({ readAt: '2026-10-04', seenAt: '2026-10-04' })).toBe('read')
    expect(recipientState({ seenAt: '2026-10-04', readAt: null })).toBe('seen')
    expect(recipientState({ seenAt: null, readAt: null })).toBe('unseen')
  })
})

describe('② والنافذة لا تمنع', () => {
  it('⚠️ تركّب في إطار البوّابة — فتظهر في أيّ شاشة يفتحها', () => {
    expect(LAYOUT).toMatch(/import TrainerAnnouncement from "\.\/TrainerAnnouncement"/)
    expect(LAYOUT).toMatch(/<TrainerAnnouncement \/>/)
  })

  it('⚠️ إغلاقها (Escape والنقر خارجها) تأجيل لا قراءة', () => {
    expect(MODAL).toMatch(/<Modal onClose=\{later\}/)
    expect(fnBody(MODAL, 'later'), 'الإغلاق يكتب قراءة').not.toMatch(/\/read|confirmRead/)
  })

  it('⚠️ وخياران بأثرهما: «قرأته» يكتب، و«ذكّرني لاحقا» يؤجّل', () => {
    expect(MODAL).toMatch(/onClick=\{\(\) => void confirmRead\(\)\}>قرأته</)
    expect(MODAL).toMatch(/onClick=\{later\}>ذكّرني لاحقا</)
    expect(fnBody(MODAL, 'confirmRead')).toMatch(/\/api\/trainer\/announcements\/\$\{shown\.id\}\/read/)
    expect(MODAL, 'لا يقال للمدرّب ما يقع بكلّ منهما').toMatch(/«قرأته» يعلم الإدارة[\s\S]*«ذكّرني لاحقا» يغلقه الآن/)
  })

  it('والنصّ المقترح نصيحة لا أمر — وبلا «عرضك»', () => {
    const text = `${ANNOUNCEMENT_DRAFT.titleAr}\n${ANNOUNCEMENT_DRAFT.bodyAr}`
    expect(text).toContain('اقتراح لا إلزام')
    expect(text).not.toMatch(/يجب|ممنوع|لا يسمح|إلزاميّ/)
    expect(text).not.toContain('عرضك')
  })
})

describe('③ ولا يرسل شيء بلا سؤال', () => {
  it('⚠️ «أرسل…» تسأل ولا ترسل — والإرسال نداء واحد في خيار «أرسله الآن»', () => {
    const ask = ADMIN.slice(ADMIN.indexOf('<Button tone="primary" icon={Send}'), ADMIN.indexOf('أرسل…'))
    expect(ask).toMatch(/setAsking\(true\)/)
    expect(ask, '«أرسل…» ترسل بلا سؤال').not.toMatch(/send\(/)
    const calls = [...ADMIN.matchAll(/void send\(\)/g)]
    expect(calls, 'الإرسال من موضع غير خيار التأكيد').toHaveLength(1)
    const modalAt = ADMIN.indexOf('<Modal onClose={() => setAsking(false)}')
    expect(modalAt).toBeGreaterThan(-1)
    expect(calls[0].index!, 'الإرسال خارج نافذة السؤال').toBeGreaterThan(modalAt)
    expect(fnBody(ADMIN, 'send')).toMatch(/apiPost<[^>]+>\("\/api\/admin\/trainer-announcements"/)
  })

  it('⚠️ وفي السؤال خياران وتحت كلّ ما يقع به', () => {
    const modal = ADMIN.slice(ADMIN.indexOf('<Modal onClose={() => setAsking(false)}'))
    expect(modal).toMatch(/>أرسله الآن<\/Button>\s*<p[^>]*>\s*يصل الآن/)
    expect(modal).toMatch(/>ليس الآن<\/Button>\s*<p[^>]*>\s*لا يصل أحدا/)
  })

  it('والنموذج يبدأ بالنصّ المقترح — ويعدّل كلّه', () => {
    expect(ADMIN).toMatch(/useState<string>\(ANNOUNCEMENT_DRAFT\.titleAr\)/)
    expect(ADMIN).toMatch(/useState<string>\(ANNOUNCEMENT_DRAFT\.bodyAr\)/)
    expect(ADMIN).toMatch(/<textarea value=\{body\} onChange=\{\(e\) => setBody\(e\.target\.value\)\}/)
  })

  it('⚠️ وبابها في «المدرّبون» لمن يبثّ الإعلانات — ومسارها قائم', () => {
    const item = allSections.flatMap((s) => s.items).find((i) => i.to === '/admin/trainer-announcements')
    expect(item?.need).toBe('staff.notify')
    expect(APP).toMatch(/<Route path="\/admin\/trainer-announcements" element=\{<AdminTrainerAnnouncements \/>\} \/>/)
  })
})

describe('④ والجرس يفتح الإعلان نفسه', () => {
  it('⚠️ البند يفتح نافذته بالإعلان المسمّى', () => {
    expect(notificationHref(ANNOUNCEMENT_TEMPLATE_KEY, 'trainer', { announcementId: 'a-1' })).toBe('/trainer?announcement=a-1')
  })

  it('وفي صنف يكتم: الإعلانات — والنافذة لا تمرّ بالتفضيل', () => {
    const cat = categoryForTemplate(ANNOUNCEMENT_TEMPLATE_KEY)
    expect(cat?.key).toBe('announcements')
    expect(cat?.silenceable).toBe(true)
  })
})

describe('⑤ ومن يصير مدرّبا بعد الإرسال', () => {
  it('⚠️ المقترح للنصّ المقترح آخر نوفمبر — ولغيره، أو بعد نوفمبر، شهر من اليوم', () => {
    expect(LATE_JOINERS_DRAFT_UNTIL).toBe('2026-11-30')
    expect(defaultLateUntil('2026-10-04', true)).toBe('2026-11-30')
    expect(defaultLateUntil('2026-10-04', false)).toBe('2026-11-03')
    expect(defaultLateUntil('2026-12-02', true), 'اقترح يوم مضى').toBe('2027-01-01')
  })

  it('⚠️ ولا يقبل يوم مضى، ولا أبعد من سنة، ولا يوم لا وجود له', () => {
    expect(lateUntilProblem('2026-10-04', '2026-10-04')).toBeNull()
    expect(lateUntilProblem('2026-10-03', '2026-10-04')).toMatch(/مضى/)
    expect(lateUntilProblem('2027-12-01', '2026-10-04')).toMatch(/سنة/)
    expect(lateUntilProblem('2026-02-30', '2026-01-01')).toMatch(/صحيحا/)
  })

  it('واليوم يحسب حتّى آخر ثانية منه بعمّان', () => {
    expect(lateUntilInstant('2026-11-30').toISOString()).toBe('2026-11-30T20:59:59.999Z')
  })

  it('⚠️ وفي النموذج خياران وتحت كلّ أثره — والمرسل يتبع الخيار', () => {
    expect(ADMIN).toMatch(/onChange=\{\(\) => setLate\(true\)\} \/>\s*المدرّبون الآن، ومن يصير مدرّبا حتّى[\s\S]*?<p[^>]*>\s*من ينضمّ بعد الإرسال تظهر له النافذة/)
    expect(ADMIN).toMatch(/onChange=\{\(\) => setLate\(false\)\} \/>\s*المدرّبون الآن وحدهم\s*<\/label>\s*<p[^>]*>من ينضمّ بعد الإرسال لا يصله\.<\/p>/)
    expect(fnBody(ADMIN, 'send')).toMatch(/lateJoinersUntil: late \? until : null/)
    expect(ADMIN, 'لا يقال في السؤال من يصله بعده').toMatch(/late \? `ومن يصير مدرّبا حتّى \$\{dayLabelAr\(until\)\} يصله حين يفتح بوّابته\.` : "ومن ينضمّ بعد الإرسال لا يصله\."/)
  })

  it('⚠️ وما أرسل قبل الخيار يصل المنضمّين حتّى آخر نوفمبر — باللحظة نفسها', () => {
    /* على البنية لا على ورود الحرف: سطرُ SQL المعلَّقُ بـ`--` ليس ملئا */
    const sql = readFileSync(join(process.cwd(), 'prisma/migrations/20261004140000_announcement_late_joiners/migration.sql'), 'utf8')
      .replace(/--.*$/gm, '')
    const at = sql.match(/^UPDATE "TrainerAnnouncement" SET "lateJoinersUntil" = '([^']+)' WHERE "lateJoinersUntil" IS NULL;$/m)
    expect(at, 'لا ملء لما أرسل قبله').not.toBeNull()
    expect(`${at![1].replace(' ', 'T')}Z`).toBe(lateUntilInstant(LATE_JOINERS_DRAFT_UNTIL).toISOString())
  })
})
