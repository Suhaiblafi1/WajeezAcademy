/* تهيئةُ لقاء التعارف — ما يُقال لمن حجز، وأين يُقال.

   ═══ ما يُحرَس ═══

   ① **المدّةُ رقمٌ واحدٌ في المنصّة** — بطاقةُ الحجز تقولها، ودعوةُ
      التقويم تحملها، وهذه الأسطر تعيدها. فلو كُتبت رقما هنا لَانحرفت يوما
      عن الدعوة التي تصل بريدَه — ولا يُحمِّر ذلك شيئا.
   ② **والبابان يقرآن الأسطرَ نفسَها** — صفحةُ حسابه وصفحةُ المتابعة
      بالبريد: إنسانٌ واحدٌ ومدخلان. وقد افترقا من قبلُ فحجز مرّتَين.
   ③ **ولا تهيئةَ قبل حجز** — الأسطرُ تحت الموعد، فمن لم يحجز يُعرض له
      الحجزُ لا الاستعدادُ للقاءٍ بلا وقت.
   ④ **وما يقع عند الغياب مقولٌ سلفا** — من لم يحضر يعود طلبُه إلى
      الانتظار (`interview-outcome.ts`). فيُقال قبل أن يقع، ويُعطى بابُ
      التعديل بدل الاختفاء.
   ⑤ **ولا يُطلب ما لا يُنظر فيه** — «عرضٌ» و«سيرةٌ مطبوعة» ليسا من اللقاء،
      والملفُّ يصل المُقابِلَ مقروءا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRAINER_INTERVIEW } from '@/application/trainer/application-options'
import {
  forArabicNoun, INTERVIEW_PREP, PREP_MISSED_AR, PREP_TITLE_AR,
} from '@/application/trainer/interview-prep'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PREP_SOURCE = read('src/application/trainer/interview-prep.ts')

describe('① المدّةُ من الثابت لا رقما مكتوبا', () => {
  it('سطرُ المدّة يقرأ `TRAINER_INTERVIEW.minutes`', () => {
    const shape = INTERVIEW_PREP.find((l) => l.key === 'shape')
    expect(shape, 'لا سطرَ يقول ما يقع في اللقاء').toBeDefined()
    expect(shape!.labelAr).toBe(`${TRAINER_INTERVIEW.minutes} دقيقة`)
  })

  it('ولا رقمَ مكتوبا في الوحدة — لا في السطر ولا في غيره', () => {
    /* نصُّ الوحدة بلا تعليقاتها: التعليقُ يشرح ولا يُعرض */
    const code = PREP_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(
      code,
      `المدّةُ مكتوبةٌ رقما — وهي ${TRAINER_INTERVIEW.minutes} في بطاقة الحجز وفي دعوة التقويم`,
    ).not.toMatch(new RegExp(String(TRAINER_INTERVIEW.minutes)))
  })

  it('ودعوةُ التقويم تقرأ الثابتَ نفسَه — فلا تفترق عمّا قرأه', () => {
    for (const file of [
      'server/services/trainer-review.service.ts',
      'server/services/calendar/calendar.service.ts',
    ]) {
      const src = read(file)
      const line = src.split('\n').find((l) => l.includes('durationMinutes') && l.includes('TRAINER_INTERVIEW'))
      expect(line, `${file}: مدّةُ دعوة التقويم مكتوبةٌ رقما لا مقروءةً من الثابت`).toBeTruthy()
    }
  })
})

describe('④⑤ ما تقوله الأسطر', () => {
  it('كلُّ سطرٍ له عنوانٌ ونصٌّ عربيّان', () => {
    expect(INTERVIEW_PREP.length, 'لا أسطرَ أصلا').toBeGreaterThanOrEqual(3)
    for (const line of INTERVIEW_PREP) {
      expect(line.labelAr, line.key).toMatch(/[؀-ۿ]/)
      expect(line.textAr.length, line.key).toBeGreaterThan(20)
    }
    expect(PREP_TITLE_AR).toContain(TRAINER_INTERVIEW.labelAr)
  })

  it('ولامُ العنوان مدغمةٌ لا مكتوبةً بشرطة', () => {
    /* «كيف تستعدّ للقاء التعارف» — لا «لـلقاء» ولا «تستعدّ لقاء» */
    expect(PREP_TITLE_AR).toBe('كيف تستعدّ للقاء التعارف')
    expect(PREP_TITLE_AR, 'شرطةٌ في متنٍ يقرؤه المتقدّم').not.toContain('ـ')
    /* والقاعدةُ تصحّ على اسمٍ معرَّفٍ بأل أيضا، فلا تتعلّق بهذه التسمية وحدَها */
    expect(forArabicNoun('المقابلة')).toBe('للمقابلة')
    expect(forArabicNoun('لقاء التعارف')).toBe('للقاء التعارف')
  })

  it('④ ويُقال ما يقع إن مضى الموعدُ بلا حضور', () => {
    /* وهو ليس تهديدا: من طرأ عليه أمرٌ يُعطى سببا ليضغط «عدّل» لا ليختفي */
    expect(PREP_MISSED_AR).toContain('عدّل موعدَك أو ألغِه')
    expect(PREP_MISSED_AR, 'لا يقول ما يقع للطلب — فيُقرأ تخويفا بلا خبر').toContain('يُعيد طلبَك إلى الانتظار')
  })

  it('⑤ ويُقال صراحةً ما لا يلزمه إحضارُه', () => {
    const noPitch = INTERVIEW_PREP.find((l) => l.key === 'no_pitch')
    expect(noPitch, 'لا سطرَ يرفع عنه ما لا يُنظر فيه').toBeDefined()
    expect(noPitch!.labelAr).toContain('لا يلزمك')
    /* والسببُ مقولٌ لا مجرّدَ نهي: ملفُّه يصل المُقابِلَ مقروءا */
    expect(noPitch!.textAr).toContain('مقروءة')
  })

  it('وعيّنةُ المادّة من عنده لا إعدادا جديدا — وهو ما يُحضِر المتردّد', () => {
    const sample = INTERVIEW_PREP.find((l) => l.key === 'sample')
    expect(sample?.textAr).toContain('ولا يلزمك إعدادُ جديد')
  })
})

describe('②③ أين تُعرض', () => {
  const STATUS = read('src/pages/ApplicantStatus.tsx')
  const LOOKUP = read('src/pages/JoinTrainer.tsx')

  it('② البابان يعرضانها — صفحةُ الحساب وصفحةُ المتابعة بالبريد', () => {
    for (const [name, src] of [['صفحةُ الحساب', STATUS], ['صفحةُ المتابعة', LOOKUP]] as const) {
      expect(src, `${name} لا تستورد المكوّن`).toContain("from \"@/components/InterviewPrep\"")
      expect(src, `${name} لا تعرضه`).toContain('<InterviewPrep')
    }
  })

  it('③ وتحت الموعد لا قبله — فلا تهيئةَ لمن لم يحجز', () => {
    /* القصُّ بحدَّين يُثبَت وجودُهما، وإلّا خضرّ الفحصُ على شريحةٍ فارغة */
    const from = STATUS.indexOf('{mine.interviews[0] && (')
    const to = STATUS.indexOf('{/* البريد والتواصل */}')
    expect(from, 'زال حدُّ كتلةِ الموعد في صفحة الحساب').toBeGreaterThan(-1)
    expect(to, 'زال حدُّ ما بعدها').toBeGreaterThan(from)
    expect(
      STATUS.slice(from, to),
      'التهيئةُ خارج كتلة الموعد — فتُعرض لمن لم يحجز بعد',
    ).toContain('<InterviewPrep')

    const lookupFrom = LOOKUP.indexOf('{lookupResult.hasInterview && lookupResult.interviewAt && (')
    const lookupTo = LOOKUP.indexOf('BOOKABLE_STATUSES.includes(lookupResult.status)', lookupFrom)
    expect(lookupFrom, 'زال حدُّ كتلةِ الموعد في صفحة المتابعة').toBeGreaterThan(-1)
    expect(lookupTo, 'زال حدُّ ما بعدها').toBeGreaterThan(lookupFrom)
    expect(LOOKUP.slice(lookupFrom, lookupTo)).toContain('<InterviewPrep')
  })

  it('ورابطُ تعديل الموعد في البابَين معا — لا في أحدهما', () => {
    expect(STATUS, 'صفحةُ الحساب تحيله إلى بريده ولا تعطيه الرابط').toContain('rescheduleUrl')
    expect(LOOKUP).toContain('interviewRescheduleUrl')
    /* والخادمُ يردّه فعلا لصاحب الحساب، وإلّا كان الشرطُ في الشاشة ميّتا */
    expect(
      read('server/services/trainer-application.service.ts'),
      'الخادمُ لا يُعيد رابطَ التعديل في طلب صاحب الحساب',
    ).toMatch(/canceledAt: true, rescheduleUrl: true/)
  })
})
