/* سطرُ «رفعُ الملفّات» في صحّة النظام يقول الحقّ عن المسارات.

   ═══ ما كان ═══

   كان السطرُ يقول «غيرُ مفعَّل (مطفأٌ عمدا)» ويعلّل بأنّ «التخزينَ لم يُبنَ
   إلّا لوثائقِ طلبِ الانضمام». وكلاهما لم يعد صحيحا: المخزنُ بُني، و**وثائقُ
   طلبِ الانضمام ترفع فعلا والمفتاحُ مطفأ** — إذ لم تكن خلفه قطّ.

   وثبت ذلك على خادم الإنتاج (١٤ سبتمبر ٢٠٢٦): أربعةٌ وعشرون ملفّا في
   `/app/storage` و`FILE_UPLOADS` مطفأ. فسطرُ «مطفأ» يقول غيرَ الحقّ لمن
   يقرأ «صحّةَ النظام» ليعرف حالَ منصّته.

   ═══ ما يحرسه هذا الملفّ ═══

   أنّ **ما يقوله السطرُ يطابق ما تفعله الشيفرة**. فلو حُرست وثائقُ الانضمام
   غدا، أو رُفع الحارسُ عن مسارٍ آخر، صار النصُّ كذبا — ولا شيءَ يقوله. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/** مُصدِرو روابطِ الرفع الستّة — كلٌّ بملفّه والمسمّى الذي يظهر للقارئ */
const ISSUERS = [
  { file: 'server/services/trainer-application.service.ts', labelAr: 'وثائقُ طلبِ الانضمام', gated: false },
  { file: 'server/services/cv.service.ts', labelAr: 'السيرةُ الذاتيّة', gated: true },
  { file: 'server/services/cohort.service.ts', labelAr: 'موادُّ الشعبة', gated: true },
  { file: 'server/services/assessment.service.ts', labelAr: 'ملفُّ التسليم', gated: true },
  { file: 'server/services/trainer-review.service.ts', labelAr: 'صورةُ المدرّب', gated: true },
] as const

const HEALTH = 'server/services/system-health.service.ts'

describe('مَن يُصدر رابطَ رفعٍ ومَن يحرسه', () => {
  it('كلُّ مُصدِرٍ يُصدر فعلا — وإلّا فالقائمةُ تصف ماضيا', () => {
    for (const i of ISSUERS) {
      expect(code(i.file), `${i.file} لم يعد يُصدر رابطَ رفع`).toMatch(/signKey\([^)]*'write'\)/)
    }
  })

  it('وخمسةٌ خلف الحارس، ووثائقُ الانضمام وحدَها أمامه', () => {
    /* هذه هي الحقيقةُ التي يصفها السطر. وتغيُّرها بلا تغيُّر النصّ هو
       العطبُ بعينه — فمن غيّر الحراسةَ يجد هذا الحارسَ يسقط. */
    for (const i of ISSUERS) {
      const has = code(i.file).includes('assertFileUploadsEnabled(')
      expect(has, `${i.labelAr} (${i.file}): الحراسةُ ${has ? 'مضافة' : 'منزوعة'} خلافا للموصوف`).toBe(i.gated)
    }
  })
})

describe('والسطرُ يصف ذلك بأسمائه', () => {
  const health = code(HEALTH)
  const block = health.slice(health.indexOf("key: 'file_uploads'"), health.indexOf("key: 'documents_in_db'"))

  /* والفرعان يُفحصان **كلٌّ على حدة**. وحارسٌ يفحص الكتلةَ كلَّها يمرّ وإن
     سقط اسمٌ من أحد الفرعين، ما دام باقيا في الآخر — جُرّب فمرّ، فقُسّم. */
  const ON = block.slice(block.indexOf('المساراتُ الستّةُ'), block.indexOf('يعمل الآن:'))
  const OFF = block.slice(block.indexOf('يعمل الآن:'))

  it('فرعُ المفعَّل يسمّي الستّةَ كلَّها', () => {
    for (const i of ISSUERS) {
      expect(ON, `فرعُ المفعَّل لا يذكر ${i.labelAr}`).toContain(i.labelAr)
    }
    expect(ON, 'تسجيلاتُ الجلسات غيرُ مذكورة').toContain('تسجيلاتُ الجلسات')
  })

  it('وفرعُ المطفأ يسمّي الخمسةَ المطفأةَ كلَّها', () => {
    const off = OFF.slice(OFF.indexOf('مطفأة'))
    for (const i of ISSUERS.filter((x) => x.gated)) {
      expect(off, `فرعُ المطفأ لا يذكر ${i.labelAr}`).toContain(i.labelAr)
    }
    expect(off, 'تسجيلاتُ الجلسات غيرُ مذكورة في المطفأ').toContain('تسجيلاتُ الجلسات')
  })

  it('ولا يقول «مطفأ» عمّا يعمل — فوثائقُ الانضمام تُذكر عاملةً في الحالتين', () => {
    /* الفحصُ على **موضع** الاسم لا على وروده: في فرع «مطفأ» يجب أن يقع
       اسمُها في الجزء الذي يعدّد العامل، قبل ذكرِ ما هو مطفأ. */
    const off = block.slice(block.indexOf('يعمل الآن:'))
    expect(off, 'لا فرعَ يقول ما الذي يعمل رغم الإطفاء').not.toBe('')
    const working = off.slice(0, off.indexOf('مطفأة'))
    expect(working, 'وثائقُ الانضمام ليست في قائمة العامل').toContain('وثائقُ طلبِ الانضمام')
    for (const i of ISSUERS.filter((x) => x.gated)) {
      expect(working, `${i.labelAr} عُدّت عاملةً وهي محروسة`).not.toContain(i.labelAr)
    }
  })

  it('والقيمةُ لا تقول «غيرُ مفعَّل» وحدَها — فالمنصّةُ ترفع شيئا فعلا', () => {
    expect(block, 'القيمةُ عادت تنفي الرفعَ كلَّه').not.toMatch(/valueAr:[^,]*'غيرُ مفعَّل/)
  })

  it('والفعلُ يقول أين يُشعَل لا رقمَ مهمّةٍ في خطّةٍ قديمة', () => {
    expect(block).toContain('FILE_UPLOADS=on')
    expect(block).toContain('deploy/.env.production')
  })
})

describe('وعدُّ «وثائقُ في القاعدة» على العمود لا على الصفوف', () => {
  const health = code(HEALTH)

  it('يُستعلَم عمّا بقي في `content` — لا عن كلّ صفّ', () => {
    /* `count()` مجرّدةً تعدّ وثائقَ بايتاتُها على القرص وتقول إنّها في
       القاعدة، وتطلب هجرةً تمّت. */
    expect(health).toMatch(/trainerApplicationDocument\.count\(\{ where: \{ content: \{ not: null \} \} \}\)/)
  })

  it('والصفرُ حالٌ سليمةٌ لا تنبيه', () => {
    const block = health.slice(health.indexOf("key: 'documents_in_db'"))
    expect(block.slice(0, 700)).toMatch(/level: docs > 0 \? 'attention' : 'ok'/)
  })
})
