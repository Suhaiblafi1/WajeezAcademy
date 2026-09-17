/* أمرُ التحقّق يطابق البوّابةَ — حارسُ الخطإ الذي كلّفني دفعتَين حمراوَين.
 *
 * ── ما وقع أوّلا ──
 *
 * شغّلتُ `npx tsc --noEmit` قبل كلّ دمجٍ فمرّ نظيفا. **و`tsconfig.json` ملفُّ
 * حلٍّ بمراجعَ فقط: فحصُه لا يفحص شيئا** — والتعليقُ فوق خطوة البوّابة يقول
 * ذلك حرفا. فمرّت ٩٤ خطأَ نوعٍ إلى `main` واحمرّت البوّابةُ دفعتَين.
 *
 * ── وما وقع ثانيا: هذا الحارسُ نفسُه كان أخضرَ وهو لا يحرس ──
 *
 * كُتب فوقُ: «فإن أُضيفت خطوةٌ إلى البوّابة ولم تُضَف إلى `verify`، احمرّ هذا
 * الاختبارُ وقال أيَّها». **ولم يكن يفعل.** كان يقارن بقائمةٍ مكتوبةٍ باليد
 * من أربع خطوات، والبوّابةُ أربعَ عشرة. فمرّت `ci:locale` سنينَ خارجَ
 * `verify` والحارسُ أخضر — حتّى احمرّت البوّابةُ على `toLocaleDateString("ar")`
 * في شاشةٍ شُحنت بعد `verify` نظيف (١٤ سبتمبر ٢٠٢٦).
 *
 * وهو عينُ العطب الذي يحرسه: فرقٌ بين ما أشغّله وما تشغّله البوّابة. وقد
 * كُتب في `ci.yml` نفسِه مرّتَين عن بوّاباتٍ أخرى: «معرَّفةٌ ولا يناديها
 * أحد». فالقائمةُ اليدويّةُ هي الداء لا الدواء.
 *
 * ── والعلاج: تُقرأ الخطواتُ من `ci.yml` نفسِه ──
 *
 * فما يُضاف إلى البوّابة غدا يدخل هذا الفحصَ بلا أن يذكره أحد. وما لا
 * يُشغَّل محلّيّا يُسمّى هنا **بزمنِه المقيس** — استثناءٌ مُعلَنٌ لا نسيان. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
const ci = read('.github/workflows/ci.yml')

/** يُفَكّ `npm run x` إلى ما يعنيه — فالمقارنةُ على الأمر لا على اسمه */
function expand(cmd: string, depth = 0): string {
  if (depth > 5) return cmd
  return cmd.replace(/npm run ([\w:-]+)/g, (whole, name: string) =>
    pkg.scripts[name] ? expand(pkg.scripts[name], depth + 1) : whole)
}

/** `npx` زينةٌ في المقارنة: البوّابةُ تكتبه و`package.json` لا يكتبه */
const norm = (s: string) => s.replace(/\bnpx\s+/g, '').replace(/\s+/g, ' ').trim()

/* خطواتُ الوظيفة السريعة كما هي في `ci.yml` — تُقرأ ولا تُكتب هنا.

   وتُستبعد خطواتُ التهيئة (`npm ci` و`prisma generate`) لأنّها ليست فحصا،
   والخطواتُ متعدّدةُ الأسطر (`run: |`) لأنّها سكربتاتٌ لا أمرٌ واحد. */
function gateSteps(): string[] {
  const fast = ci.slice(ci.indexOf('  fast:'), ci.indexOf('\n  server:') + 1 || undefined)
  const out: string[] = []
  for (const m of fast.matchAll(/^ {8}run: (?!\|)(.+)$/gm)) {
    const cmd = norm(m[1])
    if (/^npm ci$/.test(cmd) || /prisma generate/.test(cmd)) continue
    out.push(cmd)
  }
  return out
}

/** ما لا يُشغَّل في `verify` — ومعه زمنُه المقيس، فالاستثناءُ قرارٌ لا سهو.
 *
 *  ── والأرقامُ مقيسةٌ على هذا الجهاز في ١٤ سبتمبر ٢٠٢٦ ──
 *
 *  كلُّ بوّابةٍ وحدَها: ترحيلاتٌ ٠ث · تراكباتٌ ١ث · رحلاتٌ ١ث · تغطيةٌ ١ث ·
 *  فضاءُ التوصيات ١ث · كتالوجٌ ٢ث · لغةٌ ٠٫٣ث · تأليفٌ ١٤ث.
 *
 *  فضُمَّت ثمانيتُها. و`verify` بعدها **٣ دقائقَ و١٥ ثانية** — لا مجموعَ
 *  أزمنتها وحدَه: لكلِّ `npx tsx` إقلاعٌ باردٌ يُحسب. والزيادةُ نحوُ دقيقة،
 *  ثمنا لثغرةٍ كلّفت دفعةً حمراءَ بعد `verify` نظيف.
 *
 *  وما بقي خارجا أُقصي بزمنه لا بظنّ.
 *
 *  ── ثمّ رُفع استثناءُ `ci:question-waste` (١٧ سبتمبر ٢٠٢٦) ──
 *
 *  كان مستثنى بحجّةِ أنّه «يضاعف زمنَ الأمر»، وأنّ أمرا يطول يُهجَر. وقرّر
 *  صاحبُ المنصّة ضمَّه، فقيس الزمنُ على هذا الجهاز بدلَ تقديره:
 *
 *    `verify` بلا البوّابة **١٢٨ث** · ومعها **١٧٢ث** — زيادةٌ ٤٤ث، أي ٣٤٪.
 *
 *  فالمضاعفةُ لم تقع. والثغرةُ التي سدَّها الضمُّ وقعت: دفعتان حمراوان في
 *  طلب الدمج ١٩٥ على هذه البوّابة وحدَها، بعد `verify` نظيفٍ في كلتَيهما. */
const OUTSIDE: { run: string; whyAr: string }[] = [
  {
    run: 'npm run build',
    whyAr: 'بناءُ الإنتاج — و`typecheck` يمسك أخطاءَ الأنواع قبله، فما يزيده '
      + 'البناءُ وحدَه نادرٌ وثمنُه في كلّ تحقّقٍ غيرُ مقبول.',
  },
]

describe('«npm run verify» يطابق ما تفحصه البوّابة', () => {
  const steps = gateSteps()
  const verifyAll = norm(`${expand(pkg.scripts.verify)} ${expand(pkg.scripts.typecheck)}`)

  it('الأمرُ معرَّفٌ — فلا يُخترع في كلّ مرّة', () => {
    expect(pkg.scripts.verify, 'لا أمرَ تحقّقٍ واحد').toBeTruthy()
    expect(pkg.scripts.typecheck).toBeTruthy()
  })

  it('والقراءةُ من `ci.yml` تجد خطواتِ البوّابة فعلا — فلا يمرّ بصفرٍ كاذب', () => {
    /* الحارسُ القديمُ كان يقارن بأربعٍ مكتوبةٍ باليد والبوّابةُ أربعَ عشرة.
       فإن عاد المسحُ بعددٍ صغيرٍ فالعطبُ في القراءة لا في البوّابة. */
    expect(steps.length, 'تعطّلت قراءةُ `ci.yml` نفسُها').toBeGreaterThanOrEqual(10)
    expect(steps).toContain('tsc --noEmit -p tsconfig.app.json')
    expect(steps).toContain('vitest run src/tests')
  })

  it('كلُّ خطوةٍ في البوّابة إمّا في `verify` وإمّا مُسمّاةٌ بسببها', () => {
    const missing = steps.filter((s) =>
      !verifyAll.includes(norm(expand(s))) && !OUTSIDE.some((o) => norm(expand(o.run)) === norm(expand(s))))
    expect(
      missing,
      'البوّابةُ تفحصها و«verify» لا يفحصها ولا هي في `OUTSIDE` بسببها:\n' + missing.join('\n'),
    ).toEqual([])
  })

  it('وما استُثني ما زال في البوّابة — فلا يُحرَس عذرٌ لخطوةٍ زالت', () => {
    /* استثناءٌ لخطوةٍ حُذفت من `ci.yml` يُطيل القائمةَ بلا معنى ويخفي أنّها زالت */
    for (const o of OUTSIDE) {
      expect(steps.map((s) => norm(expand(s))), `استثناءٌ لا وجودَ له في البوّابة: ${o.run}`)
        .toContain(norm(expand(o.run)))
      expect(o.whyAr.length, `استثناءٌ بلا سبب: ${o.run}`).toBeGreaterThan(40)
    }
  })

  it('ولا استثناءَ يُدّعى وهو في `verify` — فنصفُ نقلةٍ لا تمرّ', () => {
    /* حين نُقلت `ci:question-waste` إلى `verify` بقي عذرُها في `OUTSIDE` لحظةً.
       والاختباراتُ فوقُ تخضرّ على هذا الحال كلُّها: كلٌّ منها يسأل «إمّا في
       `verify` وإمّا مستثناة» لا «ليست في الاثنتين معا». فيبقى في السجلّ عذرٌ
       يقول إنّ البوّابةَ لا تُشغَّل محلّيّا وهي تُشغَّل — والقارئُ يصدّقه. */
    const both = OUTSIDE.filter((o) => verifyAll.includes(norm(expand(o.run))))
    expect(both.map((o) => o.run), 'استثناءٌ مكتوبٌ لخطوةٍ يشغّلها `verify` فعلا').toEqual([])
  })

  it('ولا يفحص `tsconfig.json` — ملفُّ حلٍّ بمراجعَ لا يفحص شيئا', () => {
    /* هذا بعينه الخطأُ الذي كلّف دفعتَين: `tsc --noEmit` بلا `-p` يقرؤه */
    expect(pkg.scripts.typecheck).not.toMatch(/tsc --noEmit(?! -p)/)
  })

  it('وبوّابةُ اللغة فيه — وهي الخطوةُ التي أثبتت أنّ القائمةَ اليدويّة لا تحرس', () => {
    expect(verifyAll, '`ci:locale` خارجَ `verify` ثانيةً').toContain('scripts/audit-locale.ts --check')
  })
})
