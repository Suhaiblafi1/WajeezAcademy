/* تسجيلاتُ دورات المتقدّم — سؤالٌ وجوابُه يفتح سؤالا.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): يُسأل هل عنده تسجيلاتٌ جاهزةٌ لدوراته،
   فإن قال لا سُئل هل يرغب في تسجيلها — «لأنّ المحتوى الأفضل يكون تسجيلاتٍ
   مسجّلةً وحلقاتٍ مباشرةً مع الطلاب».

   ═══ وثلاثةُ أعطابٍ تسكن سؤالا تابعا لسؤال ═══

   ① **أن يُقرأ الصمتُ نفيا.** العمودان يقبلان العدم، و`null` فيهما «لم
      يُسأل» — وهي حالُ كلِّ طلبٍ سبق هذا السؤال. فمن قرأ `!hasCourseRecordings`
      جوابا بالنفي نسب إلى كلّ متقدّمٍ قديمٍ أنّه قال «لا تسجيلات عندي»، وهو
      لم يُسأل أصلا. والفرقُ ليس تجميلا: على «لا» وحدَها يُفتح السؤالُ الثاني.
   ② **وأن تبقى رغبةٌ عن حالٍ تغيّرت.** من قال «لا» ثمّ «أرغب»، ثمّ عاد
      فقال «عندي تسجيلات» — يبقى في القاعدة أنّه يرغب في تسجيلِ ما عنده.
      تناقضٌ صامتٌ يقرؤه المراجعُ ولا يعرف أيُّهما الصحيح.
   ③ **وأن يفترق شرطُ الشاشة عن شرط الخادم.** الشاشةُ تُخفي السؤالَ الثاني،
      والخادمُ يكتب ما يصله. فلو كُتب الشرطُ مرّتين كتب الخادمُ ما لا تعرضه
      الشاشة — وهو بابُ العطب ② نفسُه من جهةٍ أخرى.

   ولهذا القرارُ في دالّةٍ واحدةٍ (`recordingAnswerPatch`) تُفحص سلوكا هنا،
   والشاشتان تُفحصان على أنّهما تناديانها لا على أنّهما تكرّرانها. */

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  boolToRecordingAnswer, RECORDING_ANSWERS, RECORDINGS_WHY,
  recordingAnswerPatch, recordingAnswerToBool, recordingsSummaryAr, WANTS_RECORDING_ANSWERS,
} from '@/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** الشيفرةُ بلا تعليقاتها — فلا يُقاس شرحٌ مكانَ شيفرةٍ تعمل */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('الجوابُ ثلاثُ حالاتٍ لا اثنتان', () => {
  it('«نعم» و«لا» تُخزَّنان منطقيّتَين، وما سواهما لا جواب', () => {
    expect(recordingAnswerToBool('yes')).toBe(true)
    expect(recordingAnswerToBool('no')).toBe(false)
    /* ولا `false`: `undefined` وحدَها تقول «لم يُجب» */
    expect(recordingAnswerToBool('')).toBeUndefined()
    expect(recordingAnswerToBool(null)).toBeUndefined()
    expect(recordingAnswerToBool(undefined)).toBeUndefined()
  })

  it('والعودةُ منها إليهما تحفظ الحالاتِ الثلاث', () => {
    expect(boolToRecordingAnswer(true)).toBe('yes')
    expect(boolToRecordingAnswer(false)).toBe('no')
    expect(boolToRecordingAnswer(null), 'صار الصمتُ نفيا').toBe('')
    expect(boolToRecordingAnswer(undefined)).toBe('')
  })
})

describe('والسؤالُ الثاني تابعٌ لا مستقلّ', () => {
  it('⚠️ يُخزَّن عند «لا» وحدَها', () => {
    expect(recordingAnswerPatch('no', 'yes')).toEqual({
      hasCourseRecordings: false, wantsToRecordCourses: true,
    })
    expect(recordingAnswerPatch('no', 'no')).toEqual({
      hasCourseRecordings: false, wantsToRecordCourses: false,
    })
  })

  it('⚠️ ويسقط عند «نعم» — فلا تبقى رغبةٌ في تسجيل ما هو مسجَّل', () => {
    /* العطبُ ②: من قال «لا» و«أرغب» ثمّ عاد فقال «عندي تسجيلات» */
    expect(recordingAnswerPatch('yes', 'yes').wantsToRecordCourses,
      'بقيت الرغبةُ بعد أن صار عنده تسجيلات').toBeUndefined()
    expect(recordingAnswerPatch('yes', 'no').wantsToRecordCourses).toBeUndefined()
  })

  it('⚠️ ويسقط قبل الجواب — فلا يُسجَّل جوابٌ عن سؤالٍ لم يُعرض', () => {
    /* العطبُ ①: مربّعٌ فارغٌ يفتح على كلّ متقدّمٍ سؤالا لم يُسأله أحد */
    expect(recordingAnswerPatch('', 'yes')).toEqual({
      hasCourseRecordings: undefined, wantsToRecordCourses: undefined,
    })
    expect(recordingAnswerPatch(null, 'no').wantsToRecordCourses).toBeUndefined()
  })
})

describe('والشاشتان تناديان القرارَ الواحد لا تكرّرانه', () => {
  it('⚠️ النموذجُ يُرسل بالدالّة نفسِها — لا بشرطٍ يُكتب بيده', () => {
    /* العطبُ ③: شرطٌ مكتوبٌ في الشاشة ينحرف عن شرط الخادم بعد أوّل تعديل */
    const page = code('src/pages/JoinTrainer.tsx')
    expect(page, 'النموذجُ لا ينادي القرارَ المشترك').toContain('recordingAnswerPatch(')
    const service = code('server/services/trainer-application.service.ts')
    expect(service, 'الخدمةُ تكتب الجوابَين بلا القرار المشترك').toContain('recordingAnswerPatch(')
  })

  it('⚠️ والسؤالُ الثاني لا يُعرض إلّا على من قال «لا» صراحةً', () => {
    const page = code('src/pages/JoinTrainer.tsx')
    expect(page, 'شرطُ العرض ليس «لا» صريحةً — فينفتح على من لم يُجب')
      .toMatch(/hasRecordings === "no" &&/)
    /* ولا يُفتح بنفيٍ فضفاض: `!hasRecordings` يشمل الفراغَ فينفتح للجميع */
    expect(page, 'فُتح السؤالُ الثاني بنفيٍ فضفاضٍ يشمل «لم يُجب»')
      .not.toMatch(/!hasRecordings\s*&&/)
  })

  it('⚠️ واختيارُ «نعم» يمحو رغبةً سُجّلت قبله', () => {
    const page = code('src/pages/JoinTrainer.tsx')
    expect(page, 'بقيت الرغبةُ في الشاشة بعد تبديل الجواب إلى «نعم»')
      .toMatch(/if \(v !== "no"\) setWantsRecording\(""\)/)
  })
})

describe('وما يُقرأ في الملفّ يفرّق الصمتَ عن النفي', () => {
  it('⚠️ الصمتُ يُقال صمتا — لا «لا تسجيلاتٍ عنده»', () => {
    /* العطبُ ①: كلُّ طلبٍ سبق هذا السؤال يحمل `null`. فلو قُرئ نفيا لَنُسب
       إلى مئةِ متقدّمٍ جوابٌ لم يقولوه — وعليه يُبنى قرارُ اعتمادهم. */
    expect(recordingsSummaryAr(null, null)).toMatch(/لم يُسأل/)
    expect(recordingsSummaryAr(undefined, undefined)).toMatch(/لم يُسأل/)
    expect(recordingsSummaryAr(null, null), 'قُرئ الصمتُ نفيا').not.toMatch(/لا تسجيلات/)
  })

  it('⚠️ و«نعم» و«لا» يُقرآن على وجهَيهما', () => {
    expect(recordingsSummaryAr(true, null)).toMatch(/عنده تسجيلاتٌ جاهزة/)
    expect(recordingsSummaryAr(false, null)).toMatch(/لا تسجيلاتٍ عنده بعد/)
    expect(recordingsSummaryAr(false, true)).toMatch(/ويرغب في تسجيلها/)
    expect(recordingsSummaryAr(false, false)).toMatch(/ولا يرغب/)
  })

  it('⚠️ ولا تُقرأ رغبةٌ عند من عنده تسجيلات — ولو حملها العمودُ من قبل', () => {
    /* `recordingAnswerPatch` يمنع كتابتَها، وهذا يمنع قراءتَها: صفٌّ قديمٌ
       كُتب قبل القرار الواحد لا يُعرض متناقضا على المراجع. */
    expect(recordingsSummaryAr(true, true), 'عُرضت رغبةٌ على من عنده تسجيلات')
      .not.toMatch(/يرغب/)
  })

  it('⚠️ ولا شَرطةٌ بلا ما بعدها حين لا رغبةَ مذكورة', () => {
    /* الملفُّ يحرس هذا صراحةً: «بقيت شَرطةٌ بلا ما بعدها» */
    expect(recordingsSummaryAr(false, null).trimEnd()).not.toMatch(/[—-]$/)
  })

  it.each([
    ['server/services/trainer-dossier.service.ts', 'ملفُّ لجنة المراجعة'],
    ['src/pages/admin/ApplicationDossier.tsx', 'شاشةُ الإدارة'],
  ])('⚠️ و%s ينادي النصَّ الواحد لا يكرّره — %s', (file) => {
    const src = code(file)
    expect(src, 'الشاشةُ تكتب الشرطَ الثلاثيَّ بيدها — فينحرف عن أختها')
      .toContain('recordingsSummaryAr(')
    expect(src, 'بقي شرطٌ مكتوبٌ بيده بجانب النداء')
      .not.toMatch(/hasCourseRecordings === true/)
  })
})

describe('والعمودان يقبلان العدم، وترحيلُهما موجود', () => {
  it('⚠️ بلا قيمةٍ افتراضيّة — وإلّا صار كلُّ طلبٍ قديمٍ كأنّه أجاب «لا»', () => {
    const schema = read('prisma/schema.prisma')
    for (const col of ['hasCourseRecordings', 'wantsToRecordCourses']) {
      const line = new RegExp(`${col}\\s+Boolean\\?`).test(schema)
      expect(line, `${col} ليس \`Boolean?\` — فلا موضعَ لـ«لم يُسأل»`).toBe(true)
      expect(schema, `${col} أُعطي قيمةً افتراضيّةً تمحو الحالةَ الثالثة`)
        .not.toMatch(new RegExp(`${col}\\s+Boolean\\?[^\\n]*@default`))
    }
  })

  it('ويُنشئهما ترحيلٌ — فلا عمودَ في المخطَّط بلا SQL يخلقه', () => {
    const dir = join(root, 'prisma/migrations')
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(dir, d.name, 'migration.sql'))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    for (const col of ['hasCourseRecordings', 'wantsToRecordCourses']) {
      expect(sql, `لا ترحيلَ ينشئ ${col}`).toContain(`"${col}"`)
    }
  })
})

describe('ونصوصُ السؤال من مصدرٍ واحد', () => {
  it('جوابان لكلّ سؤال، لا ثالثَ لهما', () => {
    expect(RECORDING_ANSWERS.map((a) => a.value)).toEqual(['yes', 'no'])
    expect(WANTS_RECORDING_ANSWERS.map((a) => a.value)).toEqual(['yes', 'no'])
  })

  it('⚠️ ويُقال له لماذا نسأل — وأنّه لا يُفاضَل به', () => {
    /* سؤالٌ عن نقصٍ بلا سببٍ يُقرأ شرطا: من لا تسجيلاتِ عنده يظنّ بابَه
       أُغلق، فيترك النموذجَ عند سؤالٍ لا يُرجّح ولا يُضعف. */
    expect(RECORDINGS_WHY, 'لا يُذكر سببُ السؤال').toMatch(/مباشر/)
    const page = code('src/pages/JoinTrainer.tsx')
    expect(page, 'النموذجُ لا يعرض سببَ السؤال').toContain('RECORDINGS_WHY')
    expect(page, 'لا يُطمأن المتقدّمُ أنّ جوابَه لا يُفاضَل به')
      .toMatch(/لا يُرجّح طلبك ولا يُضعفه/)
  })
})
