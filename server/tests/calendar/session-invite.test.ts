/* دعوةُ اللقاء المباشر — الرسالةُ وموعدُ التقويم (٢٩ سبتمبر ٢٠٢٦).

   محضةٌ بلا قاعدةٍ ولا شبكة. ومن يُدعى ومتى في `learning/session-invites.test.ts`؛
   وهنا ما تقوله الدعوةُ نفسُها، وما يجعل التقويمَ يحدّثها لا يكرّرها — وما تقوله للمدرّب (٢٧ أكتوبر ٢٠٢٦). */

import { describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import { inviteSequence, sessionInviteMail, sessionInviteUid, sessionScheduleMail } from '../../services/calendar/session-invite'
import { attachmentsOf } from '../../services/mail'
import { whenAr } from '../../../src/application/learning/cohort-gate'

const AT = new Date('2099-03-03T15:00:00.000Z')
const NOW = new Date('2026-09-29T12:00:00.000Z')
const base = {
  session: { id: 'sess-1', title: 'لقاءُ المحور الأوّل', startsAt: AT, endsAt: new Date(AT.getTime() + 2 * 3_600_000) },
  cohortTitle: 'شعبةُ الخريف',
  to: { email: 'learner@x.co', name: 'متعلّم' },
  pageUrl: 'https://www.wajeezacademy.com/student/learning',
  now: NOW,
}
const PERSONAL = { url: 'https://zoom.us/w/123?tk=personal', personal: true }
/** الأسطرُ تُطوى عند ٧٥ ثمانيّة (`foldIcsLine`) — فتُفرَد قبل أن يُطابَق سطرٌ طويل */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')
/** معرّفاتُ الأحداث **سطرا كاملا**. كان الفحصُ `toContain('UID:…')` فمرّ معرّفٌ
    أطولُ يبدأ به (`…@wajeez-academy-update`) — وهو بعينه ما يكرّر الموعدَ في التقويم */
const uids = (ics: string) => [...unfold(ics).matchAll(/^UID:(.*?)\r?$/gm)].map((m) => m[1])

describe('الدعوة', () => {
  const m = sessionInviteMail({ ...base, kind: 'new', join: PERSONAL })

  it('⚠️ تقول الموعدَ بساعة عمّان صراحةً — والتقويمُ بالتوقيت العالميّ يحوّله لصاحبه', () => {
    expect(m.subject).toContain(whenAr(AT))
    expect(m.text).toContain(`${whenAr(AT)} — بتوقيت عمّان`)
    expect(m.ics).toContain('DTSTART:20990303T150000Z')
    expect(m.ics).toContain('DTEND:20990303T170000Z')
  })

  it('⚠️ وتحمل رابطَه الخاصّ وتقول إنّه له وحدَه — في الرسالة وفي التقويم', () => {
    expect(m.html).toContain(PERSONAL.url.replace(/&/g, '&amp;'))
    expect(m.text, 'من يقرأ النصَّ الخالصَ لا يعرف ألّا يشارك رابطَه').toContain('الرابطُ لك وحدَك')
    expect(m.html).toContain('الرابطُ لك وحدَك')
    expect(unfold(m.ics)).toContain(`LOCATION:${PERSONAL.url}`)
    expect(unfold(m.ics)).toContain(`URL:${PERSONAL.url}`)
  })

  it('والرابطُ المشتركُ لا يُقال عنه «لك وحدَك»', () => {
    const shared = sessionInviteMail({ ...base, kind: 'new', join: { url: 'https://zoom.us/j/9', personal: false } })
    expect(shared.text).not.toContain('لك وحدَك')
    expect(shared.ics).toContain('LOCATION:https://zoom.us/j/9')
  })

  it('وبلا رابطٍ تدلّ على صفحة رحلته — ولا يُختلَق مكان', () => {
    const none = sessionInviteMail({ ...base, kind: 'new', join: null })
    expect(none.text).toContain('صفحة رحلتك')
    expect(none.ics).not.toContain('LOCATION:')
    expect(none.ics).toContain(`URL:${base.pageUrl}`)
  })

  it('⚠️ دعوةٌ لا تطلب ردّا — والمنظِّمُ عنوانُ الأكاديميّة', () => {
    expect(m.ics).toContain('METHOD:REQUEST')
    expect(m.icsMethod).toBe('REQUEST')
    expect(unfold(m.ics)).toMatch(/ATTENDEE;CN=متعلّم;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:learner@x\.co/)
    expect(unfold(m.ics)).toContain('ORGANIZER;CN=أكاديمية وجيز:mailto:academy@wajeezacademy.com')
  })

  it('⚠️ والمعرّفُ معرّفُ اللقاء — هو نفسُه في ملفّ «أضِفها لتقويمك»', async () => {
    expect(uids(m.ics)).toEqual([sessionInviteUid('sess-1')])
    const { readFileSync } = await import('node:fs')
    const cal = readFileSync('server/services/calendar/calendar.service.ts', 'utf8')
    expect(cal, 'ملفُّ التنزيل بمعرّفٍ آخر — فيرى صاحبُه اللقاءَ مرّتين').toContain('uid: `session-${s.id}@wajeez-academy`')
    expect(sessionInviteUid('sess-1')).toBe('session-sess-1@wajeez-academy')
  })
})

describe('التحديث والرفع', () => {
  it('⚠️ التحديثُ بالمعرّف نفسِه ورقمٍ أعلى — فيتحرّك الموعدُ في التقويم ولا يتكرّر', () => {
    const first = sessionInviteMail({ ...base, kind: 'new', join: PERSONAL })
    const later = sessionInviteMail({ ...base, kind: 'update', join: PERSONAL, now: new Date(NOW.getTime() + 60_000) })
    const seq = (ics: string) => Number(/SEQUENCE:(\d+)/.exec(ics)?.[1])
    expect(uids(later.ics), 'التحديثُ بمعرّفٍ آخر — موعدٌ ثانٍ في التقويم').toEqual(uids(first.ics))
    expect(uids(later.ics)).toEqual([sessionInviteUid('sess-1')])
    expect(seq(later.ics)).toBeGreaterThan(seq(first.ics))
    expect(later.subject).toMatch(/^تغيّر موعد/)
    expect(later.text).toContain('بقي رابطُ الدخول نفسُه')
  })

  it('والرقمُ من الساعة لا من عدّاد — يعلو أبدا ولا يُحفظ', () => {
    expect(inviteSequence(new Date(Date.UTC(2026, 0, 1)))).toBe(0)
    expect(inviteSequence(new Date(Date.UTC(2026, 0, 1, 0, 0, 5)))).toBe(5)
    /* ولا يتجاوز حدَّ العدد الصحيح في العملاء بعد عقود */
    expect(inviteSequence(new Date(Date.UTC(2090, 0, 1)))).toBeLessThan(2 ** 31)
  })

  it('⚠️ والرفعُ `CANCEL` بالمعرّف نفسِه — بلا رابطٍ ومعه سببُه', () => {
    const c = sessionInviteMail({ ...base, kind: 'cancel', join: PERSONAL, cancelWhyAr: 'أُلغي هذا اللقاء — ويصلك بديلُه إن جُدوِل.' })
    expect(c.icsMethod).toBe('CANCEL')
    expect(c.ics).toContain('METHOD:CANCEL')
    expect(c.ics).toContain('STATUS:CANCELLED')
    expect(uids(c.ics)).toEqual([sessionInviteUid('sess-1')])
    expect(c.text).toContain('ويصلك بديلُه إن جُدوِل')
    expect(c.text).not.toContain(PERSONAL.url)
    expect(c.subject).toMatch(/^أُلغي من تقويمك/)
  })

  it('⚠️ ونوعُ المرفق يقول منهجَه — رفعٌ يُقرأ دعوةً إن قال `REQUEST`', () => {
    const [cancel] = attachmentsOf({ to: 'a@b.co', subject: 's', text: 't', icsContent: 'X', icsMethod: 'CANCEL' }) ?? []
    expect(cancel?.contentType).toBe('text/calendar; charset=utf-8; method=CANCEL')
    const [plain] = attachmentsOf({ to: 'a@b.co', subject: 's', text: 't', icsContent: 'X' }) ?? []
    expect(plain?.contentType, 'دعوةُ المقابلة تغيّر نوعُها').toBe('text/calendar; charset=utf-8; method=REQUEST')
  })
})

describe('جدولُ من التحق بعد الاعتماد — رسالةٌ واحدةٌ بما بقي', () => {
  const s1 = { ...base.session, join: PERSONAL }
  const s2 = {
    id: 'sess-2', title: 'لقاءُ المحور الثاني', startsAt: new Date(AT.getTime() + 7 * 24 * 3_600_000), endsAt: null,
    join: { url: 'https://zoom.us/w/456?tk=second', personal: true },
  }
  /* مقلوبةٌ عمدا: الترتيبُ بالموعد شأنُ الرسالة لا شأنُ من ناداها */
  const sched = sessionScheduleMail({
    cohortId: 'coh-1', cohortTitle: base.cohortTitle, to: base.to, sessions: [s2, s1], pageUrl: base.pageUrl, now: NOW,
  })
  const seqs = (ics: string) => [...ics.matchAll(/^SEQUENCE:(\d+)\r?$/gm)].map((m) => Number(m[1]))

  it('⚠️ كلُّ لقاءٍ بموعده بساعة عمّان ورابطِه — مرتّبةً بموعدها', () => {
    const first = sched.text.indexOf(whenAr(s1.startsAt))
    const second = sched.text.indexOf(whenAr(s2.startsAt))
    expect(first).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(first)
    expect(sched.text).toContain('بتوقيت عمّان')
    expect(sched.text).toContain(PERSONAL.url)
    expect(sched.html).toContain(s2.join.url)
    expect(sched.text, 'من يقرأ النصَّ الخالصَ لا يعرف ألّا يشارك روابطَه').toContain('الروابطُ لك وحدَك')
    expect(sched.subject).toContain(base.cohortTitle)
  })

  it('⚠️ وملفٌّ واحدٌ ينشرها كلَّها — بمعرّفاتها هي، بلا مدعوٍّ ولا طلبِ ردّ', () => {
    expect(sched.icsMethod).toBe('PUBLISH')
    expect(sched.ics).toContain('METHOD:PUBLISH')
    expect(sched.ics.match(/^BEGIN:VCALENDAR\r?$/gm)).toHaveLength(1)
    expect(uids(sched.ics), 'معرّفٌ غيرُ معرّف اللقاء — فلا يتحدّث حين يتغيّر').toEqual([sessionInviteUid('sess-1'), sessionInviteUid('sess-2')])
    expect(unfold(sched.ics)).not.toContain('ATTENDEE')
    expect(unfold(sched.ics)).toContain('ORGANIZER;CN=أكاديمية وجيز:mailto:academy@wajeezacademy.com')
    expect(unfold(sched.ics)).toContain(`LOCATION:${PERSONAL.url}`)
    expect(unfold(sched.ics)).toContain(`LOCATION:${s2.join.url}`)
    expect(seqs(sched.ics)).toEqual([inviteSequence(NOW), inviteSequence(NOW)])
    expect(sched.icsFilename).toBe('wajeez-cohort-coh-1.ics')
  })

  it('والرابطُ المشتركُ لا يُقال عنه «لك وحدَك» — وما لا رابطَ له يدلّ على صفحة رحلته', () => {
    const m = sessionScheduleMail({
      cohortId: 'coh-1', cohortTitle: base.cohortTitle, to: base.to, pageUrl: base.pageUrl, now: NOW,
      sessions: [{ ...s1, join: { url: 'https://zoom.us/j/9', personal: false } }, { ...s2, join: null }],
    })
    expect(m.text).not.toContain('لك وحدَك')
    expect(m.text).toContain('صفحة رحلتك')
    expect(unfold(m.ics)).toContain('LOCATION:https://zoom.us/j/9')
    expect(unfold(m.ics)).toContain(`URL:${base.pageUrl}`)
  })

  it('⚠️ ونوعُ المرفق يقول إنّه نشر — دعوةٌ بعشرة مواعيد يُقرأ منها الأوّل', () => {
    const [att] = attachmentsOf({ to: 'a@b.co', subject: 's', text: 't', icsContent: sched.ics, icsMethod: sched.icsMethod }) ?? []
    expect(att?.contentType).toBe('text/calendar; charset=utf-8; method=PUBLISH')
  })
})

describe('والمدرّبُ لا رابطَ له — يبدأ اللقاءَ مضيفا من صفحة شعبته (٢٧ أكتوبر ٢٠٢٦)', () => {
  const page = 'https://www.wajeezacademy.com/trainer/cohort/coh-1'
  const trainer = { ...base, to: { email: 'trainer@x.co', name: 'مدرّب' }, pageUrl: page, join: null, audience: 'trainer' as const }

  it('⚠️ الدعوةُ تدلّه على صفحة شعبته — لا على «صفحة رحلتك» — في الرسالة وفي التقويم', () => {
    const m = sessionInviteMail({ ...trainer, kind: 'new' })
    expect(m.text).toContain('تبدأ اللقاء مضيفا من صفحة شعبتك')
    expect(m.html).toContain(page)
    expect(m.text).not.toContain('صفحة رحلتك')
    expect(unfold(m.ics)).toContain(`تبدأ اللقاء مضيفا من صفحة شعبتك: ${page}`)
    expect(unfold(m.ics)).not.toContain('صفحة رحلتك')
    expect(m.ics, 'رابطُ مشاركٍ يُدخله مشاركا لا مضيفا').not.toContain('LOCATION:')
    expect(unfold(m.ics)).toContain(`URL:${page}`)
  })

  it('⚠️ والتحديثُ لا يقول له «بقي رابط الدخول نفسه» — لا رابطَ له', () => {
    const u = sessionInviteMail({ ...trainer, kind: 'update' })
    expect(u.subject).toMatch(/^تغيّر موعد/)
    expect(u.text).not.toContain('رابط الدخول')
    expect(u.text).toContain('صفحة شعبتك')
  })

  it('⚠️ وجدولُ ما بقي بلا روابط — وسطرٌ واحدٌ يقول أين يبدأ كلَّ لقاء', () => {
    const second = { id: 'sess-2', title: 'لقاءُ المحور الثاني', startsAt: new Date(AT.getTime() + 7 * 24 * 3_600_000), endsAt: null, join: null }
    const m = sessionScheduleMail({
      cohortId: 'coh-1', cohortTitle: base.cohortTitle, to: trainer.to, pageUrl: page, audience: 'trainer', now: NOW,
      sessions: [second, { ...base.session, join: null }],
    })
    expect(m.text).toContain(whenAr(AT))
    expect(m.text).toContain(whenAr(second.startsAt))
    expect(m.text).toContain('تبدأ كل لقاء مضيفا من صفحة شعبتك')
    expect(m.html).toContain(page)
    expect(m.text).not.toContain('صفحة رحلتك')
    expect(unfold(m.ics)).not.toContain('صفحة رحلتك')
    expect(uids(m.ics)).toEqual([sessionInviteUid('sess-1'), sessionInviteUid('sess-2')])
  })
})
