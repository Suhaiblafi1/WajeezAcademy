/* حارسُ المراقب — `scripts/deploy-watch.sh` وحدَه.

   يجاور `production-deploy-steps.test.ts` ولا يتداخل معه: ذاك يحرس **ما**
   يفعله الناشر، وهذا يحرس **متى** يُستدعى ومن يستدعيه. وحارسان على ملفٍّ
   واحدٍ يتنازعان، فحُدَّ كلٌّ بملفّه.

   ولماذا يُحرَس أصلا: أثرُ عطبه **غياب** — لا نشرة، ولا خطأ، ولا اختبارٌ
   يحمرّ. وقد وقع هذا مرّتين في يومين على هذا المستودَع بعينه: حُذف سيرُ عمل
   النشر فبقي المستودَع بلا نشرٍ آليٍّ ولم يلاحظ أحد؛ ثمّ حُذف المراقبُ تبعا
   لسكربتٍ كان يستدعيه، وهو مستقلٌّ عن المضيف.

   ⚠️ وحدُّه صريح: يُثبت أنّ المراقبَ مكتوبٌ كما يجب، **لا أنّ أحدا ركّبه في
   `crontab`**. وذاك لا يُقاس من المستودَع — يُقاس على الخادم. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const watchPath = join(root, 'scripts/deploy-watch.sh')
const wt = existsSync(watchPath) ? readFileSync(watchPath, 'utf8') : ''

/** بلا التعليقات — فذِكرُ أمرٍ في شرحٍ ليس تنفيذا له.

    وهذا درسٌ دُفع ثمنُه: بقي حارسٌ أخضرَ بعد نزع استدعاءٍ، لأنّ اسمَه كان
    باقيا في تعليقٍ فوقه. */
const code = (s: string) => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

describe('مراقبُ النشر — متى يُنشَر ومن يُستدعى', () => {
  it('موجودٌ — وبدونه يبقى النشرُ متوقّفا على أن يتذكّره إنسان', () => {
    expect(existsSync(watchPath)).toBe(true)
  })

  it('يستدعي ناشرَ الإنتاج نفسَه — لا نسخةً ثانيةً تفترق عنه', () => {
    expect(code(wt), 'المراقبُ يقرّر متى يُنشَر لا كيف').toMatch(/deploy\/deploy\.sh/)
  })

  it('ولا يستدعي سكربتَ مضيفٍ محذوف', () => {
    /* حُذف `deploy-cloudways.sh` في #30 لأنّه لم يوجد ذلك الخادمُ قطّ.
       واستدعاؤه من هنا نشرٌ إلى لا شيء — ويفشل صامتا في cron. */
    expect(code(wt)).not.toMatch(/deploy-cloudways\.sh/)
  })

  it('ويقارن نسختَه بـ`origin/main` قبل أن يفعل شيئا', () => {
    expect(code(wt)).toMatch(/git fetch origin main/)
    expect(code(wt)).toMatch(/rev-parse origin\/main/)
  })

  it('ولا يَنشُر من فرعٍ غيرِ main', () => {
    expect(code(wt), 'خادمٌ تُرك على فرعٍ بعد فحصٍ يدويّ لا يُسحَب إليه main صامتا')
      .toMatch(/rev-parse --abbrev-ref HEAD/)
  })

  it('وقفلٌ يمنع نشرتَين متداخلتَين — ويُحرَّر مهما كانت النهاية', () => {
    expect(code(wt), 'دورةُ الجدولة أقصرُ من النشرة، فبلا قفلٍ تبدأ الثانيةُ فوق الأولى')
      .toMatch(/mkdir "\$LOCK"/)
    expect(code(wt), 'قفلٌ لا يُحرَّر عند الفشل يوقف النشرَ إلى الأبد').toMatch(/trap .*rmdir/)
  })

  it('ولا يُغرق السجلَّ حين لا جديد', () => {
    expect(/\$LOCAL" = "\$REMOTE"/.test(code(wt)), 'لا فرعَ لحالة «لا جديد»').toBe(true)
  })

  it('ولا يبتلع الفشل — يكتبه بعلامةٍ تُبحَث', () => {
    expect(code(wt)).toMatch(/✖/)
  })

  it('ويقف عند أوّل خطأٍ بدل أن يكمل على عطب', () => {
    expect(wt).toMatch(/set -euo pipefail/)
  })

  /* ── النبضةُ إلى المراقب الخارجيّ ──

     ما يعمل على الخادم لا يبلّغ عن موت الخادم. فالنبضةُ مقلوبة: نُخبر خدمةً
     خارجيّةً أنّنا أحياء، وهي تُنذر حين ينقطع الخبر. وما يُحرَس هنا شكلُها،
     لا أنّ أحدا ضبط `WAJEEZ_PING_URL` — وذاك يُقاس على الخادم لا هنا. */

  it('النبضةُ اختياريّة — وبلا المتغيّر لا يقع شيء', () => {
    expect(code(wt), 'لا حارسَ على المتغيّر: النبضةُ ستُرسَل إلى فراغ')
      .toMatch(/\[ -n "\$\{WAJEEZ_PING_URL:-\}" \] \|\| return 0/)
  })

  it('⚠️ وفشلُ النبضة لا يُسقط نشرةً ناجحة', () => {
    /* `set -euo pipefail` أعلاه يعني أنّ curl راجعا بغير صفرٍ يقتل السكربت.
       ومراقبةٌ تُسقط نشرةً سليمةً أسوأُ من لا مراقبة. */
    const fn = code(wt).match(/ping_monitor\(\)[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fn, 'دالّةُ النبضة غير موجودة').not.toBe('')
    expect(fn, 'curl بلا `|| true` — فشلُ الشبكة يقتل النشرة').toMatch(/\|\| true/)
  })

  it('⚠️ وتُرسَل في الدورة السليمة لا عند النشر وحدَه', () => {
    /* النشرُ نادر. فمهلةٌ تنتظره تُنذر كذبا كلَّ يومٍ بلا دفعة — والدورةُ
       كلَّ خمس دقائق هي ما تقوم عليه المهلة. */
    const noChange = code(wt).match(/\$LOCAL" = "\$REMOTE"[\s\S]*?exit 0/)?.[0] ?? ''
    expect(noChange, 'فرعُ «لا جديد» غير موجود').not.toBe('')
    expect(noChange, 'لا نبضةَ في الدورة السليمة — فالمهلةُ ستُنذر كذبا')
      .toMatch(/ping_monitor/)
  })

  it('والفشلُ يُنذَر به فورا — لا يُنتظَر انقطاعُ الخبر', () => {
    expect(code(wt), 'لا نبضةَ فشلٍ عند سقوط النشرة').toMatch(/ping_monitor \/fail/)
  })

  it('وفرعٌ غيرُ main يُنذَر به كذلك — فالنشرُ متوقّفٌ صامتا', () => {
    const branch = code(wt).match(/BRANCH" != "main"[\s\S]*?exit 1/)?.[0] ?? ''
    expect(branch, 'حارسُ الفرع غير موجود').not.toBe('')
    expect(branch, 'خادمٌ عالقٌ على فرعٍ آخر لا يُنشَر منه — وهذا لا يُكتشف بلا إنذار')
      .toMatch(/ping_monitor \/fail/)
  })

  it('ولا تُرسَل حين يتعذّر الجلب — الصمتُ هناك هو الإشارة', () => {
    /* عطبُ شبكةٍ عابرٌ لا يستحقّ إنذارا. فإن دام، انقطع الخبرُ فأنذرت الخدمةُ
       من نفسها — وهو الترتيبُ الصحيح: لا ضجيجَ على العابر، ولا صمتَ على الدائم. */
    const fetchFail = code(wt).match(/git fetch origin main[\s\S]*?exit 0/)?.[0] ?? ''
    expect(fetchFail, 'فرعُ تعذّر الجلب غير موجود').not.toBe('')
    expect(fetchFail, 'نبضةٌ على تعذّر الجلب — فالعابرُ يصير ضجيجا').not.toMatch(/ping_monitor/)
  })
})
