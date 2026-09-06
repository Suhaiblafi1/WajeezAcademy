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
})
