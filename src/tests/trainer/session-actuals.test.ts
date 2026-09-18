/* ═══ ما تكتبه زووم ولا يراه أحد (م٥) ═══

   «ويُعرَض في بطاقة اللقاء ما تكتبه زووم اليومَ ولا يراه أحد: انعقد متى ·
   كم دقيقة · كم حضر» — قرارُ صاحب المنصّة.

   ── وهذا الجزءُ لا ينتظر شراءَ زووم ──

   الأعمدةُ تُملأ من أحداثٍ **قائمةٍ تعمل اليوم** (`meeting.started` و
   `meeting.ended` وتقريرُ المشاركين)، وتعليقُ المخطّط يقولها: «ما وقع فعلا
   — يملؤه webhook لا يدٌ. والمجدولُ نيّةٌ، وهذا خبر». والعطبُ أنّ الإسقاطَ
   الذي يبني ما يصل الشاشةَ كان يُسقطها كلَّها.

   ── وعطبٌ ثانٍ من جنسه ──

   `syncError` كُتب في الخدمة أنّه «يُكتب في `syncError` فيُقرأ في الشاشة»،
   ولا شاشةَ كانت تقرؤه. فتسقط مزامنةُ الحضور، ويبقى المدرّبُ ينتظر أسماءً
   لا تأتي ولا يعرف أنّها لن تأتي — وهو عطبٌ **صامت**: لا يسقط شيء، بل
   يُنتظَر ما لا يجيء.

   والفحصُ بنيويٌّ: الحقولُ في الإسقاط، والشاشةُ تقرؤها. أمّا كتابتُها من
   أحداث زووم فمحروسةٌ في `server/tests/learning/zoom-*`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const ROUTES = code('server/http/routes/learning-portal.routes.ts')
const CARD = code('src/pages/trainer/SessionsAndAttendance.tsx')
/** إسقاطُ محتوى الشعبة وحدَه — الملفُّ فيه عشراتُ المسالك */
const SIGN = ROUTES.slice(ROUTES.indexOf('function signCohortContent'), ROUTES.indexOf('export function registerLearningPortalRoutes'))

describe('① الإسقاطُ يحمل ما وقع فعلا — وكان يُسقطه', () => {
  it('⚠️ الثلاثةُ التي يقولها القرار تعبر إلى الشاشة', () => {
    expect(SIGN, 'لم يُعثر على الإسقاط').not.toBe('')
    for (const field of ['actualStartAt', 'durationMin', 'participantCount']) {
      expect(SIGN, `${field} ما زال يُسقَط قبل الشاشة`).toContain(`${field}: (s.zoom as`)
    }
  })

  it('⚠️ وحالةُ المزامنة وسببُ سقوطها معها', () => {
    expect(SIGN, 'حالةُ المزامنة لا تعبر').toContain('syncState: (s.zoom as')
    expect(SIGN, 'سببُ السقوط لا يعبر — وقد كُتب أنّه «يُقرأ في الشاشة»').toContain('syncError: (s.zoom as')
  })

  it('ورمزُ الاجتماع يبقى محروسا بالإذن — لا يُفتَح البابُ بتوسيعه', () => {
    /* التوسعةُ أضافت حقولا، ولا تمسّ ما كان محجوبا: الرمزُ يُكشف لمن له
       حقُّه وحدَه، ولا يخرج `passcodeEnc` خاما. */
    expect(SIGN).toContain('passcode: opts.revealPasscode ? s.zoom.passcodeEnc : null')
    expect(SIGN, 'الرمزُ المعمّى يخرج باسمه').not.toMatch(/passcodeEnc: \(s\.zoom as/)
  })
})

describe('② وبطاقةُ اللقاء تقرؤها', () => {
  it('⚠️ «انعقد متى · كم دقيقة · كم حضر» في البطاقة', () => {
    expect(CARD, 'الحقولُ غيرُ معلَنةٍ في نوع الشاشة').toMatch(/actualStartAt: string \| null/)
    /* ⚠ والمطابقةُ على **فتحِ التصيير** `{s.zoom?.actualStartAt && (` لا على
       الشرط وحدَه: تعطيلُه بـ`false &&` يُبقي نصَّ الشرط في الملفّ، فيمرّ
       حارسٌ يطابقه وحدَه — وهي المصيدةُ التي وقع فيها هذا الملفُّ أوّلَ مرّة. */
    const at = CARD.indexOf('{s.zoom?.actualStartAt && (')
    expect(at, 'لا سطرَ لما وقع فعلا — أو عُطِّل تصييرُه').toBeGreaterThan(-1)
    const block = CARD.slice(at, at + 700)
    expect(block, 'لا يُقال متى انعقد').toContain('انعقد {fmtDateTimeAr(s.zoom.actualStartAt)}')
    expect(block, 'لا تُقال المدّة').toContain('s.zoom.durationMin')
    expect(block, 'لا يُقال كم حضر').toContain('s.zoom.participantCount')
  })

  it('⚠️ ولا يُعرض شيءٌ عن لقاءٍ لم ينعقد — الفراغُ ليس صفرا', () => {
    /* بطاقةُ لقاءٍ لم يأتِ موعدُه بعد لا تقول «حضره ٠» — ذاك خبرٌ كاذبٌ عن
       شيءٍ لم يقع. فالسطرُ كلُّه خلف وجود `actualStartAt`. */
    const at = CARD.indexOf('{s.zoom?.actualStartAt && (')
    expect(at, 'السطرُ بلا حارسِ وقوع').toBeGreaterThan(-1)
    expect(CARD.slice(at, at + 700), 'المدّةُ تُعرض بلا قيمة').toContain('s.zoom.durationMin !== null &&')
    expect(CARD.slice(at, at + 700), 'العددُ يُعرض بلا قيمة').toContain('s.zoom.participantCount !== null &&')
  })

  it('⚠️ وسقوطُ المزامنة يُقال لصاحبه ومعه ما يفعل', () => {
    const at = CARD.indexOf('{s.zoom?.syncState === "failed" && (')
    expect(at, 'لا سطرَ لسقوط المزامنة — أو عُطِّل تصييرُه').toBeGreaterThan(-1)
    const block = CARD.slice(at, at + 500)
    expect(block, 'يُقال العطبُ ولا يُقال الفعل').toContain('سجّله بيدك')
    expect(block, 'السببُ لا يُعرض').toContain('s.zoom.syncError')
  })

  it('والصيغةُ لا تُرتجَل — «دقيقتان» لا «٢ دقيقة»', () => {
    expect(CARD).toContain('countAr(s.zoom.durationMin, MINUTE_FORMS)')
    expect(CARD).toContain('countAr(s.zoom.participantCount, PERSON_FORMS)')
  })
})
