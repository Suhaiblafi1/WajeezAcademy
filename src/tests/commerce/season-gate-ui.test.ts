/* أبوابُ الشراء في الواجهة تقول «لم يُفتح بعد» وتأخذ البريد.

   ─────────── ما يقيسه هذا الملفّ، ولمَ نصّيّا ───────────

   لا jsdom في هذا المستودع ولا testing-library، فالفحصُ على **بنية المصدر**
   لا على شجرةٍ مُصيَّرة. وهذا يفرض دقّةً: ورودُ حرفٍ في ملفٍّ ليس دليلا —
   وقد مرّ في هذه المنصّة ثلاثةُ حرّاسٍ خضراءَ لأسبابٍ خاطئة، طابقوا نصّا في
   تعليقٍ أو اسما جزءا من اسم. فما يُفحص هنا **استيرادٌ وتصيير ونداءُ مسار**،
   وكلُّها تُقرأ بأنماطٍ لا تصدق على تعليق.

   ─────────── والحارسُ الحقيقيُّ ليس هنا ───────────

   المنعُ في الخادم (`server/tests/commerce/season-gate.test.ts`)، وهذا يحرس
   أنّ من رُدَّ **يُقال له لماذا ويُؤخذ بريدُه** — فبابٌ يردّ بلا أن يقول
   يطرد من جاء يشتري، وهو ما وُضعت له هذه الشاشة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

/** أبوابُ الشراء التي يصلها زائرٌ بلا حساب — وهي التي يُؤخذ فيها البريد */
const PUBLIC_BUY_DOORS = ['components/BuyPanel.tsx', 'components/BuyCohort.tsx']

/** استيرادُ وحدةٍ فعلا — لا ذكرُ اسمها في تعليق */
const imports = (body: string, module: string) =>
  new RegExp(`import\\s+[^;]*from\\s+["'][^"']*${module}["']`).test(body)

/** تصييرُ مكوّنٍ فعلا — `<Name` بحرفٍ كبيرٍ لا يقع في نصٍّ عربيّ */
const renders = (body: string, component: string) =>
  new RegExp(`<${component}[\\s/>]`).test(body)

describe('كلُّ بابِ شراءٍ عامٍّ يعرض الرسالةَ ويأخذ البريد', () => {
  it('يستورد اللوحَ ويصيّره — لا يكتفي بردٍّ أحمرَ في أسفل الشاشة', () => {
    const gaps: string[] = []
    for (const f of PUBLIC_BUY_DOORS) {
      const body = read(f)
      if (!imports(body, 'RegistrationClosedNotice')) gaps.push(`${f}: لا يستورد اللوح`)
      else if (!renders(body, 'RegistrationClosedNotice')) gaps.push(`${f}: يستورده ولا يصيّره`)
    }
    expect(gaps).toEqual([])
  })

  it('ويعرف القفلَ من الطريقَين: قدراتِ المنصّة قبل النقر، وردِّ الخادم بعده', () => {
    const gaps: string[] = []
    for (const f of PUBLIC_BUY_DOORS) {
      const body = read(f)
      /* `/api/config` — فلا يملأ المشتري سلّةً ثمّ يُردّ */
      if (!imports(body, 'usePlatformConfig')) gaps.push(`${f}: لا يقرأ حالَ الباب قبل النقر`)
      /* ورمزُ الردّ — لتبويبٍ فُتح قبل الإغلاق، أو قدراتٍ تعذّر تحميلُها */
      if (!body.includes('"season_closed"')) gaps.push(`${f}: لا يلتقط ردَّ الخادم بعد النقر`)
    }
    expect(gaps).toEqual([])
  })
})

describe('جملةُ الإغلاق مصدرُها واحد', () => {
  /* تُكتب من شاشة الفصول وتُقرأ من `/api/config`. ولو نُسخت في الواجهة لَرأى
     الزائرُ جملةً وكتب الإداريُّ أخرى — ولا شيءَ يقول له إنّ تعديلَه لم يصل. */
  it('اللوحُ لا يحمل جملةً مكتوبةً فيه بل يأخذها خاصّيّةً', () => {
    const body = read('components/RegistrationClosedNotice.tsx')
    /* نصُّ القرار حرفيّا — يقع في تعليق الرأس، فيُفحص خارجَ التعليقات وحدَها */
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toContain('لم يفتح باب التسجيل')
    /* ويأخذها خاصّيّةً من مناديه */
    expect(code).toMatch(/messageAr[:\s]/)
  })

  it('وأبوابُ الشراء تمرّرها كما وصلت لا تؤلّف بديلا', () => {
    for (const f of PUBLIC_BUY_DOORS) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(code, `${f} يكتب جملةَ الإغلاق بيده`).not.toContain('لم يفتح باب التسجيل')
      expect(code, `${f} لا يمرّر الجملةَ إلى اللوح`).toMatch(/messageAr=\{/)
    }
  })
})

describe('اللوحُ ينادي مسارا موجودا', () => {
  /* زوجُ الواجهةِ والمسار يفترق بإعادةِ تسميةِ أحدهما، ولا يُكتشف إلّا بزائرٍ
     يترك بريدَه فيضيع. فيُفحص الطرفان معا. */
  const ROUTE = '/api/public/registration-interest'

  it('والمسارُ مسجَّلٌ في الخادم بالاسم نفسِه', () => {
    expect(read('components/RegistrationClosedNotice.tsx')).toContain(`"${ROUTE}"`)
    const routes = readFileSync(join(process.cwd(), 'server/http/routes/public.routes.ts'), 'utf8')
    expect(routes).toMatch(new RegExp(`app\\.post\\(\\s*'${ROUTE}'`))
  })
})

describe('افتراضُ القدرات يُستورَد لا يُنسَخ', () => {
  /* كان الافتراضُ مكتوبا مرّتين — في الخدمة وفي الخطّاف. فكلُّ قدرةٍ تُضاف
     تحتاج موضعَين، وأحدُهما يُنسى: خطّافٌ يقول «مغلق» وخدمةٌ تقول «مفتوح». */
  it('الخطّافُ يستورد الافتراضَ من الخدمة', () => {
    const hook = read('hooks/usePlatformConfig.ts')
    expect(hook).toContain('PLATFORM_CONFIG_FALLBACK')
    expect(hook).not.toMatch(/fileUploads:\s*(true|false)/)
  })
})
