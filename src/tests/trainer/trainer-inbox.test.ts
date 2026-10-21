/* «الرسائل والتنبيهات» في بوّابة المدرّب (٢١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: الجرسُ «لا يقرؤه ولا يوجد فيه أكشن» — فصار صفحةً لها بندٌ في القائمة والجرسُ
   يفتحها (اختار «A» من ثلاثة مواضعَ عُرضت بالصور)، ولها لسانان: التنبيهات، والرسائل (إعلاناتُ الإدارة
   وحدَها باختياره)، ويردّ بواتساب أو بالبريد.

   والمحروسُ ما يُفسد الوعدَ إن سقط بصمت:
   ① ما يحتاج إجراءً يُقسَم بصنفه، والإعلانُ خارجَ التنبيهات (له لسانُه) — ولكلّ صنفِ إجراءٍ بابٌ، وإلّا
     كانت بطاقةٌ صفراءُ «يحتاج منك» بلا زرّ.
   ② الردُّ إلى العنوان الواحد وفيه عنوانُ الرسالة.
   ③ والبابُ قائم: المسارُ، وبندُ القائمة (وفي طور الإعداد كذلك)، والجرسُ يفتحه، والنافذةُ لا تغطّيه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACTION_KEYS, TRAINER_REPLY_SPOT, replyMailHref, replySubjectAr, replyWhatsAppTextAr, splitAlerts,
} from '@/application/trainer/inbox'
import { ANNOUNCEMENT_TEMPLATE_KEY } from '@/application/trainer/announcement'
import { destinationFor, notificationHref } from '@/application/notifications/destinations'
import { ACADEMY_CONTACT_EMAIL } from '@/data/academy-email'
import { SETUP_TABS } from '@/application/trainer/setup-tabs'
import { WHATSAPP_SPOTS } from '@/application/site/whatsapp'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const at = (h: number) => new Date(Date.UTC(2026, 9, 21, h)).toISOString()
const alert = (id: string, templateKey: string, status: 'sent' | 'read', h: number) =>
  ({ id, templateKey, status, title: id, body: '', createdAt: at(h), sentAt: at(h) })

describe('① القسمة: يحتاج منك · للعلم · قرأتها', () => {
  const items = [
    alert('grade', 'submission.queued', 'sent', 9),
    alert('payout', 'trainer_payout', 'sent', 10),
    alert('poster', 'trainer.poster.submitted', 'sent', 11),
    alert('old-plan', 'cohort.plan.decision', 'read', 8),
    alert('ann', ANNOUNCEMENT_TEMPLATE_KEY, 'sent', 12),
    alert('mystery', 'something.new', 'sent', 7),
  ]
  const s = splitAlerts(items)

  it('⚠️ غير المقروء من صنف إجراء في الأعلى — أحدثه أوّلا', () => {
    expect(s.action.map((a) => a.id)).toEqual(['poster', 'grade'])
  })

  it('وما لا ينتظر فعله للعلم — والصنف المجهول للعلم لا لـ«يحتاج منك»', () => {
    expect(s.info.map((a) => a.id)).toEqual(['payout', 'mystery'])
  })

  it('والمقروء وحده في «قرأتها» ولو كان صنف إجراء', () => {
    expect(s.read.map((a) => a.id)).toEqual(['old-plan'])
  })

  it('⚠️ والإعلان خارج التنبيهات كلّها — له لسان «الرسائل»', () => {
    const all = [...s.action, ...s.info, ...s.read].map((a) => a.id)
    expect(all).not.toContain('ann')
  })

  it('⚠️ ولكلّ صنف إجراء باب في بوّابة المدرّب — لا بطاقة «يحتاج منك» بلا زرّ', () => {
    for (const k of ACTION_KEYS) {
      expect(destinationFor(k, 'trainer'), `«${k}» بلا وجهة`).not.toBeNull()
    }
  })

  it('وزرّ الإعلان في البريد والجرس يفتحه في لسانه بعينه', () => {
    expect(notificationHref(ANNOUNCEMENT_TEMPLATE_KEY, 'trainer', { announcementId: 'a-1' })).toBe('/trainer/inbox?m=a-1')
  })
})

describe('② الردّ — واتساب أو البريد، وعنوان الرسالة فيه', () => {
  it('⚠️ البريد إلى العنوان الواحد، وموضوعه عنوان الرسالة', () => {
    const href = replyMailHref('مواعيد الصرف')
    expect(href.startsWith(`mailto:${ACADEMY_CONTACT_EMAIL}?subject=`)).toBe(true)
    expect(decodeURIComponent(href.split('subject=')[1])).toBe(replySubjectAr('مواعيد الصرف'))
  })

  it('وواتساب يبدأ بعنوانها، وله خانة رقم في «التكاملات»', () => {
    expect(replyWhatsAppTextAr('مواعيد الصرف').startsWith(replySubjectAr('مواعيد الصرف'))).toBe(true)
    expect(WHATSAPP_SPOTS.map((s) => s.key)).toContain(TRAINER_REPLY_SPOT)
  })

  it('⚠️ والصفحة تبني الردّين من هذين لا من عنوان مكتوب', () => {
    const page = code('src/pages/trainer/Inbox.tsx')
    expect(page).toMatch(/waHref\(numbers, TRAINER_REPLY_SPOT, CONTACT\.whatsapp, replyWhatsAppTextAr\(title\)\)/)
    expect(page).toMatch(/href=\{replyMailHref\(title\)\}/)
    expect(page).not.toMatch(/@wajeez/i)
  })
})

describe('③ الباب قائم والجرس يفتحه', () => {
  const app = code('src/App.tsx')
  const layout = code('src/pages/trainer/TrainerLayout.tsx')
  const bell = code('src/components/NotificationBell.tsx')
  const page = code('src/pages/trainer/Inbox.tsx')

  it('⚠️ المسار مسجّل، وبند القائمة يحمل عدد غير المقروء', () => {
    expect(app).toMatch(/<Route path="\/trainer\/inbox" element=\{<TrainerInbox \/>\} \/>/)
    expect(layout).toMatch(/\{ to: "\/trainer\/inbox", label: "الرسائل والتنبيهات", icon: Inbox, count: unread/)
    expect(SETUP_TABS).toContain('/trainer/inbox')
  })

  it('⚠️ وجرس المدرّب باب إليها لا قائمة منسدلة', () => {
    expect(layout).toContain('<NotificationBell audience="trainer" href="/trainer/inbox" />')
    const linkBranch = bell.slice(bell.indexOf('if (href)'), bell.indexOf('if (href)') + 400)
    expect(linkBranch).toMatch(/<Button as=\{Link\} to=\{href\}/)
  })

  it('والعدد من مخزن واحد للجرس والبند — لا مؤقّتان', () => {
    expect(bell).toContain('useUnreadCount(audience')
    expect(layout).toContain('useUnreadCount("trainer"')
    expect(bell).not.toMatch(/setInterval\(/)
  })

  it('والصفحة تقسم بالقاعدة المشتركة وتقرأ الإعلانات وتؤكّد قراءتها', () => {
    expect(page).toContain('splitAlerts(alerts ?? [])')
    expect(page).toContain('apiGet<Announcement[]>("/api/trainer/announcements")')
    expect(page).toContain('/api/trainer/announcements/${a.id}/read')
  })

  it('⚠️ ونافذة الإعلان لا تغطّي الصفحة التي تعرضه', () => {
    const modal = code('src/pages/trainer/TrainerAnnouncement.tsx')
    expect(modal).toMatch(/const onInbox = useLocation\(\)\.pathname\.startsWith\("\/trainer\/inbox"\)/)
    expect(modal).toMatch(/const shown = items && !onInbox/)
  })
})
