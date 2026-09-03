/* الموعدُ الذي لا يدخل تقويمَ صاحبه موعدٌ يُنسى.

   سأل صاحبُ المنصّة: هل الموقعُ مربوطٌ بقوقل كلندر لنرسل دعواتٍ
   للمقابلات ومواعيد الشعب؟ والجواب كان: لا، ولا سطرَ واحد.

   ولم نختر واجهةَ قوقل: تلزمها OAuth ومشروعٌ سحابيّ ورموزٌ تُجدَّد،
   وتربطنا بمزوّدٍ واحد فلا يستفيد منها من يستعمل آبل أو أوتلوك. و**ICS**
   معيارٌ (RFC 5545) يفتحه الثلاثةُ جميعا بلا حساب ولا إذن: مرفَقٌ في
   البريد أو ملفٌّ يُنزَّل.

   وما يُحرَس هنا ما ينكسر صامتا: سطرٌ لا يُطوى فيُرفض الملفّ، وفاصلةٌ
   في العنوان تقصمه، ومعرّفٌ غيرُ ثابت يُنتج نسخةً ثانية من الموعد نفسه
   في تقويم صاحبه بدل تحديث الأولى. */

import { describe, expect, it } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine } from '../../services/calendar/ics'

const AT = new Date('2026-09-08T15:00:00Z')

describe('دعوةُ تقويم', () => {
  it('١) هيكلٌ صحيح يفتحه قوقل وآبل وأوتلوك', () => {
    const ics = buildIcs({
      uid: 'interview-1@wajeez', title: 'مقابلة انضمام', startsAt: AT, durationMinutes: 45,
    })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:interview-1@wajeez')
    expect(ics).toContain('SUMMARY:مقابلة انضمام')
  })

  it('٢) الأسطر تنتهي بـCRLF — والملفّ بغيرها يُرفض عند بعض العملاء', () => {
    const ics = buildIcs({ uid: 'u@w', title: 'جلسة', startsAt: AT, durationMinutes: 60 })
    const lines = ics.split('\r\n')
    expect(lines.length).toBeGreaterThan(8)
    expect(ics.includes('\n\n'), 'سطرٌ بلا CR').toBe(false)
  })

  it('٣) الوقتُ بتوقيت UTC بصيغة المعيار', () => {
    const ics = buildIcs({ uid: 'u@w', title: 'جلسة', startsAt: AT, durationMinutes: 60 })
    expect(ics).toContain('DTSTART:20260908T150000Z')
    expect(ics).toContain('DTEND:20260908T160000Z')
  })

  it('٤) الفاصلةُ والفاصلةُ المنقوطة تُهرَّب — وإلّا قصمت الحقل', () => {
    /* `'\;'` في JS تساوي `';'` — فكان الاختبارُ يتوقّع الخطأ نفسَه فيمرّ.
       والمخرَجُ الصحيح شرطةٌ مائلة ثمّ فاصلةٌ منقوطة، كما يفرض RFC 5545. */
    expect(escapeIcsText('جلسة, ومراجعة; غدا')).toBe('جلسة\\, ومراجعة\\; غدا')
    expect(escapeIcsText('سطر\nثانٍ')).toBe('سطر\\nثانٍ')
    expect(escapeIcsText('شرطة\\مائلة')).toBe('شرطة\\\\مائلة')
  })

  it('٥) والوصفُ الطويل يُطوى عند ٧٥ ثمانيّة — لا سطرٌ يتجاوز الحدّ', () => {
    const long = 'DESCRIPTION:' + 'ا'.repeat(300)
    const folded = foldIcsLine(long)
    for (const line of folded.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8'), `سطرٌ أطول من الحدّ: ${line.slice(0, 30)}`).toBeLessThanOrEqual(75)
    }
    /* والطيُّ يبدأ بمسافة — فيُعاد وصلُه عند القراءة */
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true)
  })

  it('٦) ولا يُقطع حرفٌ عربيّ نصفين عند الطيّ', () => {
    const folded = foldIcsLine('SUMMARY:' + 'مرحبا بالعالم '.repeat(20))
    /* لو قُطع محرفٌ متعدّدُ الثمانيّات لظهر محرفُ الاستبدال عند فكّ الترميز */
    const rejoined = folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')
    expect(rejoined).not.toContain('�')
    expect(rejoined).toContain('مرحبا بالعالم')
  })

  it('٧) المعرّفُ ثابتٌ للموعد نفسه — وإلّا تكرّر في تقويم صاحبه', () => {
    const a = buildIcs({ uid: 'session-42@wajeez', title: 'جلسة', startsAt: AT, durationMinutes: 60, sequence: 0 })
    const b = buildIcs({ uid: 'session-42@wajeez', title: 'جلسة (موعدٌ جديد)', startsAt: new Date('2026-09-09T15:00:00Z'), durationMinutes: 60, sequence: 1 })
    expect(a).toContain('UID:session-42@wajeez')
    expect(b).toContain('UID:session-42@wajeez')
    /* والتسلسلُ يرتفع فيعرف التقويمُ أنّه تحديثٌ لا موعدٌ ثانٍ */
    expect(a).toContain('SEQUENCE:0')
    expect(b).toContain('SEQUENCE:1')
  })

  it('٨) الإلغاءُ يُرسَل بحالةٍ يفهمها التقويم فيمسح الموعد', () => {
    const ics = buildIcs({ uid: 'u@w', title: 'جلسة', startsAt: AT, durationMinutes: 60, cancelled: true })
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
  })

  it('٩) والرابطُ والوصفُ والمكان تُكتب حين تُعطى فقط', () => {
    const bare = buildIcs({ uid: 'u@w', title: 'جلسة', startsAt: AT, durationMinutes: 60 })
    expect(bare).not.toContain('LOCATION:')
    const full = buildIcs({
      uid: 'u@w', title: 'جلسة', startsAt: AT, durationMinutes: 60,
      description: 'رابط الجلسة في بوّابتك', url: 'https://wajeez-academy.vercel.app/student',
    })
    expect(full).toContain('DESCRIPTION:')
    expect(full).toContain('URL:https://wajeez-academy.vercel.app/student')
  })

  it('١٠) المنظِّمُ والمدعوُّ يُكتبان بصيغة العنوان البريديّ', () => {
    const ics = buildIcs({
      uid: 'u@w', title: 'مقابلة', startsAt: AT, durationMinutes: 45,
      organizer: { name: 'أكاديمية وجيز', email: 'Academy@wajeez.co' },
      attendee: { name: 'محمد', email: 'm@x.co' },
    })
    expect(ics).toContain('ORGANIZER;CN=أكاديمية وجيز:mailto:Academy@wajeez.co')
    expect(ics).toContain('mailto:m@x.co')
  })
})

/* ── الربطُ الحقيقيّ: من الصفّ في القاعدة إلى تقويم إنسان ── */
describe('أين تُستعمل الدعوة فعلا', () => {
  it('١١) المقابلةُ تُرسَل بريدا فيه دعوةٌ مرفَقة — لا تُجدوَل بصمت', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('server/services/trainer-review.service.ts', 'utf8')
    expect(src, 'الجدولةُ لا تُرسل شيئا — فيُنتظَر متقدّمٌ لا يعرف أنّ له موعدا').toContain('sendDirectEmail')
    expect(src, 'لا دعوةَ تقويمٍ مرفَقة').toContain('icsContent: ics')
    expect(src, 'المعرّفُ غيرُ مشتقٍّ من الموعد — فتتكرّر النسخ').toContain('uid: `interview-${interview.id}@wajeez-academy`')
  })

  it('١٢) والبريدُ يحمل المرفَق بنوعه واسمه — بعضُ العملاء يقرأ هذا وبعضُهم ذاك', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('server/services/mail.ts', 'utf8')
    expect(src).toContain("contentType: 'text/calendar; charset=utf-8; method=REQUEST'")
    expect(src).toContain("filename: input.icsFilename")
  })

  it('١٣) وللمتعلّم رابطٌ يضيف جلستَه بنفسه', async () => {
    const { readFileSync } = await import('node:fs')
    /* مساراتُ التقويم انتقلت إلى ملفّها حين قُطعت «العمليّات» بحسب المجال
       (كانت خمسَ مئةٍ وسبعةَ عشرَ سطرا لأربعة مجالات). والضمانُ لم يتغيّر —
       تغيّر بيتُه. */
    const routes = readFileSync('server/http/routes/calendar.routes.ts', 'utf8')
    expect(routes).toContain("'/api/calendar/cohort-sessions/:sessionId.ics'")
    expect(routes).toContain("'/api/calendar/trainer-interviews/:interviewId.ics'")
    const ui = readFileSync('src/pages/student/Dashboard.tsx', 'utf8')
    expect(ui, 'لا زرَّ «أضِفها لتقويمك»').toContain('/api/calendar/cohort-sessions/')
  })
})
