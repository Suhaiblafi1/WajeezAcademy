/* عناوينُ الأكاديميّة — عنوانٌ ظاهرٌ واحد، ونسخةُ خادمٍ تطابقها.

   كان عنوانٌ واحدٌ مكتوبا حرفا في عشرة مواضع، فجُمع في مصدرٍ واحد. ثمّ قرّر
   صاحبُ المنصّة (٢٣ سبتمبر ٢٠٢٦): **كلُّ بريدٍ يراه المستخدمُ هو
   `Academy@wajeez.co` وحدَه** — لا `support@` ولا غيره.

   فالحرّاس: أنّ كلَّ غايةٍ ظاهرةٍ تشير إلى العنوان الواحد · وأنّ المُرسِلَ
   الآليَّ وحدَه على النطاق الموثَّق في Resend (وإلّا رُفضت الرسائلُ بصمت) ·
   وأنّ نسخةَ الخادم تطابق الأصل · وأنّ «ردّ» يصل إلى العنوان الواحد · وأنّ
   **لا صفحةَ ولا بيانَ يكتب عنوانا آخرَ على نطاقنا حرفا**. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACADEMY_EMAILS, ACADEMY_EMAIL_DOMAIN, ACADEMY_EMAIL, ACADEMY_CONTACT_EMAIL } from '../data/academy-email'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** الملفّات التي كانت تكتب العنوانَ بالأيدي — تُفحص بأعيانها فلا يعود إليها */
const FORMERLY_HARDCODED = [
  'src/data/stories.ts',
  'src/data/siteContent.ts',
  'src/pages/Diagnostic.tsx',
  'server/services/calendar/calendar.service.ts',
  'server/services/trainer-review.service.ts',
]

/** ما يُنشر للمستخدم مباشرةً بلا مرورٍ على المصدر — يُفحص بعينه */
const PUBLISHED = ['index.html', 'scripts/prerender-seo.ts']

/** كلُّ عنوانٍ على نطاقاتنا في نصّ */
const ourAddresses = (src: string) =>
  src.match(/[A-Za-z0-9._%+-]+@(?:wajeez\.co|wajeezacademy\.com|wajeez\.sa)\b/g) ?? []

describe('عناوينُ الأكاديميّة', () => {
  it('العنوانُ الظاهرُ واحدٌ: Academy@wajeez.co — قرارُ صاحب المنصّة', () => {
    expect(ACADEMY_CONTACT_EMAIL).toBe('Academy@wajeez.co')
    expect(ACADEMY_EMAIL).toBe(ACADEMY_CONTACT_EMAIL)
  })

  it('وكلُّ غايةٍ يراها المستخدمُ تشير إليه — ولا يبقى عنوانٌ غيرُه سوى المُرسِل', () => {
    const { noReply, ...visible } = ACADEMY_EMAILS
    expect(Object.keys(visible).length).toBeGreaterThan(1)
    for (const [k, e] of Object.entries(visible)) expect(e, `ACADEMY_EMAILS.${k}`).toBe(ACADEMY_CONTACT_EMAIL)
    expect(noReply).not.toBe(ACADEMY_CONTACT_EMAIL)
  })

  it('والمُرسِلُ الآليُّ على النطاق الموثَّق في Resend — وإلّا رُفضت كلُّ رسالة', () => {
    expect(ACADEMY_EMAILS.noReply).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(ACADEMY_EMAILS.noReply.split('@')[1]).toBe(ACADEMY_EMAIL_DOMAIN)
  })

  it('ونسخةُ الخادم تطابق الأصل — فلا تفترقان', () => {
    const server = read('server/services/integrations.service.ts')
    const d = server.match(/export const ACADEMY_EMAIL_DOMAIN = '([^']+)'/)
    expect(d, 'الخادمُ يعلن ACADEMY_EMAIL_DOMAIN').not.toBeNull()
    expect(d![1]).toBe(ACADEMY_EMAIL_DOMAIN)
    const c = server.match(/export const ACADEMY_CONTACT_EMAIL = '([^']+)'/)
    expect(c, 'الخادمُ يعلن ACADEMY_CONTACT_EMAIL').not.toBeNull()
    expect(c![1]).toBe(ACADEMY_CONTACT_EMAIL)
    /* ومنظِّمُ التقويم والدعمُ في الخادم هما العنوانُ الواحد، والمُرسِلُ `no-reply` */
    expect(server).toMatch(/support: ACADEMY_CONTACT_EMAIL/)
    expect(server).toMatch(/calendar: ACADEMY_CONTACT_EMAIL/)
    expect(server).toContain('ACADEMY_EMAIL = ACADEMY_EMAILS.noReply')
  })

  it('و«ردّ» على الرسائل الآليّة يُوجَّه إلى العنوان الواحد', () => {
    const mail = read('server/services/mail.ts')
    expect(mail).toMatch(/replyTo: config\.replyTo \|\| ACADEMY_EMAILS\.support/)
  })

  it('ولا يُكتب عنوانٌ حرفا في ملفٍّ غيرِ مصدرَيه', () => {
    for (const f of FORMERLY_HARDCODED) {
      const src = read(f)
      expect(ourAddresses(src), `${f} يكتب عنوانا حرفا — استورده من مصدره`).toEqual([])
      expect(src).toContain('ACADEMY_EMAILS')
    }
  })

  it('وما يُنشر للزاحف والمشاركة لا يعلن عنوانا غيرَ Academy@wajeez.co', () => {
    for (const f of PUBLISHED) {
      const found = ourAddresses(read(f))
      expect(found.length, `${f} يعلن عنوانَ الأكاديميّة`).toBeGreaterThan(0)
      for (const e of found) expect(e, f).toBe(ACADEMY_CONTACT_EMAIL)
    }
  })
})
