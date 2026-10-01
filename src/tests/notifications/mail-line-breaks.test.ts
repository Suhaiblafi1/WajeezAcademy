/* ═══ أسطرُ النصّ تبقى أسطرا في الـHTML (١ أكتوبر ٢٠٢٦) ═══
 *
 * الـHTML يطوي فاصلَ السطر مسافةً، و`richHtml` كان يهرّب النصَّ ولا يزيد. فجوابُ
 * الموظّف على طلب تعديلٍ — فقراتٌ وقائمةٌ مرقّمة، وهو المقصودُ من رسالته كلِّها —
 * كان يصل المدرّبَ كتلةً واحدة، والنصُّ الخامُّ من الوصف نفسِه يحفظ أسطرَه.
 * والعلّةُ وما تعلّق بها في رأس `linesHtml` (`server/services/mail-template.ts`).
 *
 * والفحصُ على **بنية المصيَّر**: تُقتطَع الخليّةُ التي تحمل النصَّ من الـHTML،
 * وتُقسَم على `<br>`، فتُقابَل بأسطر المصدر واحدا واحدا — لا ورودَ كلمةٍ فيها.
 */

import { describe, expect, it } from 'vitest'
import { renderMail } from '../../../server/services/mail-template'
import { amendmentAnsweredMail, waitlistMail } from '../../../server/services/trainer-decision-mail'
import { renderNotificationMail } from '../../../server/services/notification-mail'

/** صناديقُ التنبيه (`callout`) في الرسالة — ما بين فتح الخليّة وإغلاقها */
const callouts = (html: string): string[] =>
  [...html.matchAll(/<td bgcolor="#FDF6E3"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])

/** الفقراتُ (`p`) في المتن */
const paragraphs = (html: string): string[] =>
  [...html.matchAll(/<p style="[^"]*">([\s\S]*?)<\/p>/g)].map((m) => m[1])

/** الخليّةُ التي يبدأ بها هذا النصّ — وواحدةٌ لا أكثر */
function holding(cells: string[], start: string): string {
  const hit = cells.filter((c) => c.startsWith(start))
  expect(hit.length, `لا خليّةَ تبدأ بـ«${start}» — أو بدأت به اثنتان`).toBe(1)
  return hit[0]
}

/* جوابٌ كما يُكتب في خانة «اكتبْ جوابَك»: فقرةٌ، وقائمةٌ مرقّمة، وخاتمة */
const REPLY = [
  'شكرا لقراءتك المتأنّية. وأكثرُ ما طلبتَه قائمٌ في العقد:',
  '',
  '1. الساعات يقترحها المدرّب (البند 3-6).',
  '2. والعقد لهذا الفصل وحده (البند 17-9).',
  '',
  'وما سوى ذلك يبقى كما هو.',
].join('\n')

const answered = (replyAr: string) => renderMail(amendmentAnsweredMail({
  fullName: 'مدرّب', reference: 'WJ-TR-2026-00001', title: 'اتفاقية تقديم خدمات تدريبية',
  replyAr, url: 'https://x.test/c/token', expiresOnAr: '٤ أكتوبر ٢٠٢٦',
}).doc)

describe('جوابُ طلب التعديل يصل بأسطره', () => {
  it('⚠️ فقراتُه وقائمتُه سطرا بسطر — والسطرُ الفارغُ فاصلٌ يُرى', () => {
    const cell = holding(callouts(answered(REPLY).html), 'شكرا لقراءتك')
    expect(cell.split('<br>'), 'ذاب سطرٌ في سطر').toEqual(REPLY.split('\n'))
  })

  it('والنصُّ الخامُّ يقول الأسطرَ نفسَها — فالصيغتان من وصفٍ واحد', () => {
    expect(answered(REPLY).text).toContain(REPLY)
  })

  it('⚠️ وما كتبه إنسانٌ يُهرَّب — و`<br>` وحدَه من صنع القالب', () => {
    const cell = holding(callouts(answered('<b>عريض</b>\n<script>x()</script>').html), '&lt;b&gt;')
    expect(cell).toBe('&lt;b&gt;عريض&lt;/b&gt;<br>&lt;script&gt;x()&lt;/script&gt;')
  })

  it('وطرفا الجواب يُشذَّبان، وما زاد على سطرٍ فارغٍ يُطوى، و`\\r\\n` سطرٌ واحد', () => {
    const cell = holding(callouts(answered('\n  أوّلا  \r\n\r\n\r\n\r\nثانيا\n\n').html), 'أوّلا')
    expect(cell).toBe('أوّلا<br><br>ثانيا')
  })
})

describe('وكلُّ نصٍّ يكتبه إنسانٌ في خانةٍ فيصل بريدا', () => {
  /* ملاحظةُ المراجِع في رسالة قائمة الانتظار — يكتبها فقرتين بينهما سطرٌ فارغ */
  it('⚠️ ملاحظةُ المراجِع بفقرتيها في صندوقها — لا ملتصقتين', () => {
    const note = 'خبرتُك في المبيعات واضحة.\n\nوننتظر شعبةً تناسب ما تدرّسه.'
    const { html } = renderMail(waitlistMail({ fullName: 'م', reference: 'WJ-TR-2026-00002', noteAr: note }).doc)
    const cell = holding(callouts(html), 'خبرتُك')
    expect(cell.split('<br><br>'), 'التصقت الفقرتان').toEqual(note.split('\n\n'))
  })

  /* والإشعارُ بالبريد يُقسَم فقراتٍ على السطر الفارغ (`bodyBlocks`) — والسطرُ
     المفردُ داخل الفقرة كان يذوب: قائمةٌ تُكتب سطرا سطرا تُقرأ «بين: • … • …» */
  it('⚠️ وسطرٌ تحت سطرٍ داخل فقرة الإشعار يبقى كذلك', () => {
    const { html } = renderNotificationMail({
      title: 'خبر', body: 'لك أن تختار بين:\n• الانتقال\n• الاسترداد\n\nاختر من «رحلتي».',
      audience: 'learner', siteUrl: 'https://x.test',
    })
    expect(holding(paragraphs(html), 'لك أن تختار')).toBe('لك أن تختار بين:<br>• الانتقال<br>• الاسترداد')
  })

  it('والقطعُ حول الرابط لا تُشذَّب — والسطرُ بعده يبقى سطرا', () => {
    const { html } = renderMail({
      heading: 'ع',
      blocks: [{ kind: 'p', text: ['قبل ', { text: 'الرابط', href: 'https://x.test/a' }, ' بعده\nسطرٌ ثانٍ'] }],
    })
    const cell = holding(paragraphs(html), 'قبل <a ')
    expect(cell).toMatch(/^قبل <a href="https:\/\/x\.test\/a"[^>]*>الرابط<\/a> بعده<br>سطرٌ ثانٍ$/)
  })
})
