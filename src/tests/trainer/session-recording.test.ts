/* ═══ التسجيلُ يصل وحدَه — ولا ينتهي في سطرٍ لا يُفتح (م٦) ═══

   «شغله» — قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦) في التسجيل السحابيّ.

   وهو قرارٌ من بابَين، ومن فتح أوّلَهما وحدَه أنتج عطبا صامتا تامّا:

     ① `auto_recording` كان `'none'`، فلا يبلّغ Zoom بتسجيلٍ أصلا. وصار
        `'cloud'`، ونقطةُ الأحداث تكتب صفَّه بلا يد.
     ② والشاشتان اللتان تعرضان التسجيلَ كانتا تقرآن `readUrl` وحدَه — وهو
        رابطُ الملفِّ **المرفوعِ عندنا**. فالواصلُ من Zoom (`externalUrl`)
        كان سيصير سطرا يُرى ويُنقر ولا يفتح: `href="#"` تعيد الصفحةَ إلى
        رأسها، ولا خطأَ يُقرأ في مكان.

   ── وما يُجرَّب هنا وما لا يُجرَّب ──

   الكتابةُ في القاعدة محروسةٌ في `server/tests/learning/zoom-recording` —
   ولا تعمل إلّا في CI. فانتُزع **القرارُ** إلى وحدةٍ خالصةٍ تُجرَّب هنا:
   أيُّ ملفٍّ يُنتقى، وما رابطُه، وكم مدّتُه. والبقيّةُ بنيويّة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pickRecording } from '@/application/learning/zoom-recording'
import { openableRecordings, recordingHref } from '@/application/learning/recording-href'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const ZOOM = code('server/services/zoom.service.ts')
const EVENTS = code('server/services/zoom-events.service.ts')
const CARD = code('src/pages/trainer/SessionsAndAttendance.tsx')
const JOURNEY = code('src/components/journey/StageWork.tsx')

const MP4 = {
  file_type: 'MP4',
  recording_type: 'shared_screen_with_speaker_view',
  status: 'completed',
  recording_start: '2026-12-01T09:02:00Z',
  recording_end: '2026-12-01T10:32:00Z',
  play_url: 'https://zoom.us/rec/play/one',
}

describe('① الاجتماع ينشأ طالبا تسجيلا سحابيّا', () => {
  it('⚠️ `auto_recording` صار `cloud` — وكان `none` فلا ينتج تسجيل أصلا', () => {
    expect(ZOOM, 'ما زال الإنشاء يطلب «لا تسجيل»').toContain("auto_recording: autoRecording ? 'cloud' : 'none'")
  })

  it('⚠️ وردّ ٤٠٠ يعيد المحاولة بلا الإعداد — فيسقط التسجيل لا الجلسة', () => {
    /* مسارُ الاعتماد يقرأ سقوطَ الإنشاء فيكتب `zoom.create_failed` **ويُلغي
       الجلسة**. والتسجيلُ السحابيُّ في المدفوع وحدَه — فحسابٌ لا يملكه كان
       يُلغي حصصا مجدوَلةً يحضرها ناس. */
    const at = ZOOM.indexOf('let autoRecording = true')
    expect(at, 'لا راية لحال التسجيل').toBeGreaterThan(0)
    const block = ZOOM.slice(at, at + 220)
    expect(block, 'لا محاولة أولى').toContain('let res = await attempt(true)')
    expect(block, 'الردّ ٤٠٠ يسقط الجلسة كما كان').toContain('if (res.status === 400) {')
    expect(block, 'الإعادة تطلب التسجيل ثانية — فتردّ ثانية').toContain('res = await attempt(false)')
  })

  it('⚠️ وما وقع يكتب في أثر الإنشاء — فلا يسأل بعد شهر بلا جواب', () => {
    const SVC = code('server/services/cohort.service.ts')
    const at = SVC.indexOf("action: 'zoom.create_api'")
    expect(at, 'لا أثر للإنشاء').toBeGreaterThan(0)
    expect(SVC.slice(at, at + 200), 'الأثر لا يقول أقبل التسجيل أم لا')
      .toContain('autoRecording: meeting.autoRecording')
  })
})

describe('② والبلاغ ينتقى منه المرئيّ وحده', () => {
  it('⚠️ «الشاشة مع المتحدّث» تقدّم — لا أوّل ملفّ جاء', () => {
    const picked = pickRecording({
      recording_files: [
        { ...MP4, recording_type: 'speaker_view', play_url: 'https://zoom.us/rec/play/speaker' },
        { ...MP4, play_url: 'https://zoom.us/rec/play/screen' },
      ],
    })
    expect(picked?.url, 'انتقي وجه المدرّب دون شاشته').toBe('https://zoom.us/rec/play/screen')
  })

  it('⚠️ والدردشة والصوت لا يصيران «تسجيل اللقاء»', () => {
    const picked = pickRecording({
      recording_files: [
        { file_type: 'CHAT', status: 'completed', play_url: 'https://zoom.us/rec/play/chat' },
        { file_type: 'M4A', status: 'completed', play_url: 'https://zoom.us/rec/play/audio' },
      ],
    })
    expect(picked, 'نصّ دردشة عرض على المتعلّم درسا').toBeNull()
  })

  it('⚠️ وبلا رابط لا صفّ — والصفّ الذي لا يفتح يسكت طابور «لم يرفع»', () => {
    expect(pickRecording({}), 'كتب صفّ بلا باب').toBeNull()
    expect(pickRecording({ recording_files: [] })).toBeNull()
  })

  it('وملفّ لم يجهز بعد يتخطّى — وحالة غائبة تقرأ «جاهز»', () => {
    expect(
      pickRecording({ recording_files: [{ ...MP4, status: 'processing' }] }),
      'عرض ملفّ ما زال يعالج',
    ).toBeNull()
    /* Zoom لا يرسل `status` في كلّ صيغة — وقراءتُها نقصا تُسقط تامّا */
    const noStatus = Object.fromEntries(Object.entries(MP4).filter(([k]) => k !== 'status'))
    expect(pickRecording({ recording_files: [noStatus] })?.url).toBe(MP4.play_url)
  })
})

describe('③ والرمز يلحق بالرابط — وإلّا فتح صفحة تسأل عمّا لا يملكه', () => {
  it('⚠️ رمز التشغيل في الرابط حين يرسله Zoom', () => {
    const picked = pickRecording({
      share_url: 'https://zoom.us/rec/share/abc',
      recording_play_passcode: 'p@ss w/d',
      recording_files: [MP4],
    })
    expect(picked?.url, 'الرمز سقط — فالرابط يفتح سؤالا لا درسا')
      .toBe(`https://zoom.us/rec/share/abc?pwd=${encodeURIComponent('p@ss w/d')}`)
  })

  it('⚠️ ورابط فيه استفهام يوصل بـ`&` لا بـ`?` ثانية', () => {
    const picked = pickRecording({
      share_url: 'https://zoom.us/rec/share/abc?src=mail',
      recording_play_passcode: 'x1',
      recording_files: [MP4],
    })
    expect(picked?.url, 'استفهامان في عنوان واحد يكسران الوسيط الثاني')
      .toBe('https://zoom.us/rec/share/abc?src=mail&pwd=x1')
  })

  it('وبلا رمز يبقى الرابط كما جاء — لا يلحق فراغ', () => {
    const picked = pickRecording({ share_url: 'https://zoom.us/rec/share/abc', recording_files: [MP4] })
    expect(picked?.url).toBe('https://zoom.us/rec/share/abc')
  })

  it('ورابط المشاركة يقدّم على رابط ملفّ واحد', () => {
    expect(pickRecording({ share_url: 'https://zoom.us/rec/share/abc', recording_files: [MP4] })?.url)
      .toBe('https://zoom.us/rec/share/abc')
  })
})

describe('④ والمدّة من مدى الملفّ — ودقائق اللقاء بديلها', () => {
  it('⚠️ من `recording_start` إلى `recording_end` بالثواني', () => {
    expect(pickRecording({ share_url: 'u', recording_files: [MP4] })?.durationSec).toBe(90 * 60)
  })

  it('⚠️ وبلا مدى تقرأ دقائق اللقاء — والدقيقة ستّون ثانية', () => {
    const picked = pickRecording({
      share_url: 'u', duration: 45,
      recording_files: [{ file_type: 'MP4', status: 'completed', play_url: 'u' }],
    })
    expect(picked?.durationSec, 'الدقائق عرضت ثواني — «٤٥ ثانية» لدرس من ٤٥ دقيقة').toBe(2700)
  })

  it('وبلا هذا ولا ذاك تبقى فارغة — لا صفر يختلق', () => {
    const picked = pickRecording({
      share_url: 'u',
      recording_files: [{ file_type: 'MP4', status: 'completed', play_url: 'u' }],
    })
    expect(picked?.durationSec).toBeNull()
  })
})

describe('⑤ والشاشتان تقرآن البابين — لا بابا واحدا', () => {
  it('⚠️ المرفوع أوّلا، والواصل من Zoom حين لا مرفوع', () => {
    expect(recordingHref({ id: '1', title: 't', readUrl: '/signed/a', externalUrl: 'https://zoom/b' })).toBe('/signed/a')
    expect(recordingHref({ id: '1', title: 't', readUrl: null, externalUrl: 'https://zoom/b' })).toBe('https://zoom/b')
    expect(recordingHref({ id: '1', title: 't', readUrl: null, externalUrl: null })).toBeNull()
  })

  it('⚠️ وما لا رابط له يسقط من القائمة — لا يعرض سطر لا يفتح', () => {
    const out = openableRecordings([
      { id: 'a', title: 'أ', readUrl: null, externalUrl: null },
      { id: 'b', title: 'ب', readUrl: null, externalUrl: 'https://zoom/b' },
    ])
    expect(out.map((r) => r.id), 'عرض صفّ بلا باب').toEqual(['b'])
    expect(out[0].href).toBe('https://zoom/b')
  })

  it('⚠️ وبطاقة المدرّب تنادي القاعدة — لا `readUrl ?? "#"`', () => {
    expect(CARD, 'الشاشة لا تقرأ الواصل من Zoom').toContain('openableRecordings(s.recordings)')
    expect(CARD, 'عاد السطر الذي يفتح على رأس الصفحة').not.toMatch(/href=\{r\.readUrl \?\? "#"\}/)
    expect(CARD, '`externalUrl` غير معلن في نوع الشاشة').toMatch(/externalUrl: string \| null/)
  })

  it('⚠️ ورحلة المتعلّم كذلك', () => {
    expect(JOURNEY, 'رحلة المتعلّم لا تقرأ الواصل من Zoom').toContain('openableRecordings(')
    expect(JOURNEY, 'عاد السطر الذي يفتح على رأس الصفحة').not.toMatch(/href=\{rec\.readUrl \?\? "#"\}/)
    const DETAIL = code('src/services/enrollment-detail.ts')
    expect(DETAIL, '`externalUrl` لا يصل نوع المتعلّم').toMatch(/recordings: \{[^}]*externalUrl: string \| null/)
  })
})

describe('⑥ والخدمة تكتب ما انتقي — ولا تكرّره على إعادة إرسال', () => {
  it('⚠️ الحدث معالج أصلا — وكان يسقط في `default`', () => {
    expect(EVENTS, 'لا يعالج بلاغ التسجيل').toContain("case 'recording.completed':")
    expect(EVENTS, 'الخدمة تعيد الانتقاء بيدها بدل القاعدة المشتركة').toContain('pickRecording(object)')
  })

  it('⚠️ وإعادة الإرسال لا تكتب صفّا ثانيا', () => {
    /* Zoom يُعيد إرسالَ ما لم يُردَّ عليه سريعا — والصفّان لتسجيلٍ واحدٍ
       سطران متطابقان أمام المتعلّم. */
    const at = EVENTS.indexOf('private async saveRecording')
    expect(at, 'لا كاتب للتسجيل').toBeGreaterThan(0)
    const body = EVENTS.slice(at, at + 900)
    const look = body.indexOf('this.prisma.recording.findFirst')
    const write = body.indexOf('this.prisma.recording.create')
    expect(look, 'لا بحث عن صفّ سابق').toBeGreaterThan(-1)
    expect(write, 'لا كتابة').toBeGreaterThan(-1)
    expect(look, 'يكتب قبل أن يبحث').toBeLessThan(write)
    expect(body, 'البحث لا يقيّد بالرابط — فيخنق تسجيل ثان لجلسة واحدة')
      .toContain('externalUrl: picked.url')
  })

  it('⚠️ والحجم لا يكتب — عموده أربعة بايتات ولا يسع تسجيل ثلاث ساعات', () => {
    const at = EVENTS.indexOf('private async saveRecording')
    const body = EVENTS.slice(at, at + 900)
    expect(body, 'كتابة الحجم تسقط التسجيل كلّه لأجل رقم لا يقرؤه أحد').not.toContain('sizeBytes')
  })

  it('وشكل جسم الحدث يستورد في المسلك ولا ينسخ', () => {
    /* نسخةٌ في المسلك وأصلٌ في الخدمة يفترقان بأوّل حقلٍ يُضاف */
    const ROUTE = code('server/http/routes/zoom-webhook.routes.ts')
    expect(ROUTE).toContain("import type { ZoomEventObject } from '../../services/zoom-events.service'")
    expect(ROUTE, 'عادت نسخة الحقول في المسلك').not.toMatch(/participant\?: \{ user_name/)
  })
})
