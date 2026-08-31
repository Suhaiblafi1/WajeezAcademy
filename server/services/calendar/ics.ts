/* دعوةُ تقويم بمعيار iCalendar (RFC 5545) — لا واجهةُ مزوّدٍ بعينه.

   سُئلنا: هل الموقعُ مربوطٌ بقوقل كلندر لإرسال دعوات المقابلات ومواعيد
   الشعب؟ ولم يكن كذلك. واخترنا ICS لا واجهةَ قوقل لثلاثة:

   ١) واجهةُ قوقل تلزمها OAuth ومشروعٌ سحابيّ ورموزٌ تُجدَّد وموافقةُ كلّ
      مستخدمٍ على حدة — كلُّ ذلك ليُكتب سطرٌ في تقويمه.
   ٢) وتربطنا بمزوّدٍ واحد: من يستعمل آبل أو أوتلوك لا يستفيد.
   ٣) وICS يفتحه الثلاثةُ جميعا بلا حسابٍ ولا إذن — مرفَقا في البريد أو
      ملفّا يُنزَّل.

   وما ينكسر صامتا في هذا المعيار ثلاثة، وكلُّها محروسةٌ باختبار:
   - السطرُ فوق ٧٥ ثمانيّة يُرفض عند بعض العملاء، والطيُّ يجب ألّا يقطع
     محرفا عربيّا نصفين (كلُّ حرفٍ عربيّ ثمانيّتان في UTF-8).
   - الفاصلةُ والفاصلةُ المنقوطة في العنوان تقصم الحقل ما لم تُهرَّب.
   - والمعرّفُ (UID) إن تغيّر أنتج نسخةً ثانية من الموعد في تقويم صاحبه
     بدل تحديث الأولى. */

export interface IcsEvent {
  /** ثابتٌ لهذا الموعد عبر تحديثاته — لا يُولَّد عشوائيا في كلّ إرسال */
  uid: string
  title: string
  startsAt: Date
  durationMinutes: number
  description?: string
  location?: string
  url?: string
  organizer?: { name: string; email: string }
  attendee?: { name?: string; email: string }
  /** يرتفع مع كلّ تعديلٍ على الموعد فيعرف التقويمُ أنّه تحديثٌ لا موعدٌ ثانٍ */
  sequence?: number
  cancelled?: boolean
  /** لحظةُ التوليد — يُمرَّر في الاختبارات كي تكون النتيجةُ حتميّة */
  now?: Date
}

/** حدُّ المعيار: ٧٥ ثمانيّة للسطر الواحد بلا CRLF */
const MAX_OCTETS = 75

/** `20260908T150000Z` — التوقيتُ العالميّ يعفينا من جدول المناطق كلِّه */
function toIcsDate(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** الترتيبُ مقصود: الشرطةُ المائلة أوّلا وإلّا ضوعف تهريبُ ما بعدها */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** يطوي السطر عند ٧٥ ثمانيّة بلا قطع محرفٍ متعدّد الثمانيّات */
export function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= MAX_OCTETS) return line

  const out: string[] = []
  let current = ''
  let limit = MAX_OCTETS
  for (const ch of line) {
    /* المسافةُ البادئة في الأسطر التالية تُحتسب من الحدّ */
    if (Buffer.byteLength(current + ch, 'utf8') > limit) {
      out.push(current)
      current = ch
      limit = MAX_OCTETS - 1
    } else {
      current += ch
    }
  }
  if (current) out.push(current)
  return out.map((seg, i) => (i === 0 ? seg : ` ${seg}`)).join('\r\n')
}

export function buildIcs(e: IcsEvent): string {
  const end = new Date(e.startsAt.getTime() + e.durationMinutes * 60_000)
  const stamp = toIcsDate(e.now ?? new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wajeez Academy//AR//',
    'CALSCALE:GREGORIAN',
    `METHOD:${e.cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsDate(e.startsAt)}`,
    `DTEND:${toIcsDate(end)}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ]

  if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`)
  if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`)
  /* الرابطُ لا يُهرَّب: الشرطةُ المائلة فيه جزءٌ منه، وليس فيه فاصلة */
  if (e.url) lines.push(`URL:${e.url}`)
  if (e.organizer) lines.push(`ORGANIZER;CN=${escapeIcsText(e.organizer.name)}:mailto:${e.organizer.email}`)
  if (e.attendee) {
    const cn = e.attendee.name ? `;CN=${escapeIcsText(e.attendee.name)}` : ''
    lines.push(`ATTENDEE${cn};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${e.attendee.email}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
