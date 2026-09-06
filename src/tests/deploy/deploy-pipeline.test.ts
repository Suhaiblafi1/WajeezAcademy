/* حارسُ خطّ النشر — لأنّ عطبَه لا يظهر في اختبارٍ يفشل.

   القصّةُ التي وُلد منها هذا الملفّ: حُذف `deploy/` وسيرُ عمل النشر معا،
   بادّعاءٍ أنّهما «لم يُستعملا قطّ في الإنتاج». **وبقي المستودَع بلا نشرٍ
   آليٍّ إطلاقا، ولا اختبارَ واحدٌ لاحظ** — كلُّ شيءٍ أخضر، والغائبُ نشرةٌ لا
   فحص. ثمّ تبيّن أنّ الادّعاء نفسَه خطأ: `deploy/` هو إعدادُ الخادم الذي يخدم
   النطاق فعلا، فأُعيد.

   ⚠️ وهذا الحارسُ صُحّح معه في ٦ سبتمبر: كان يحرس `scripts/deploy-cloudways.sh`
   بوصفه ناشرَ الإنتاج، وذلك بُني على وثيقةٍ تقول Cloudways. والقياسُ كذّبها
   (`dig +short www.wajeezacademy.com` = 5.9.82.49 · Hetzner)، والناشرُ الفعليّ
   `deploy/deploy.sh`. فصار الحرسُ على ما يُنفَّذ فعلا: **أنّ المراقبَ يستدعي
   الناشرَ الحقيقيّ** — ولا يفحص متنَ ذلك الناشر، فله أهلُه، وحارسان على ملفٍّ
   واحدٍ يتنازعان.

   والنموذجُ المعتمَد **سحبٌ لا دفع**: الخادمُ يسأل عن `main` ويشتغل بنفسه،
   فلا يخرج منه مفتاحٌ ولا سرّ. وهذا قرارُ صاحب المنصّة بعد اعتراضٍ محقٍّ على
   وضع مفاتيح الخادم عند طرفٍ ثالث. ولذلك **لا يُفحص هنا ملفُّ سير عمل**:
   غيابُه مقصود، ووجودُه بلا أسرارٍ يُنتج علامةً حمراءَ دائمةً تُعلّم القارئَ
   تجاهلَ الأحمر.

   فالحرسُ مصدريٌّ لأنّ الأثرَ ليس فشلا يُرى: هو **غيابُ** نشرة. ومن حذف
   السكربتَين غدا أو نزع منهما خطوةً لن يُسقط شيئا — إلّا هذا. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const deployPath = join(root, 'deploy/deploy.sh')
const watchPath = join(root, 'scripts/deploy-watch.sh')
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

/* التعليقاتُ في هذين الملفّين تشرح ما يفعلانه وتذكر أسماءَ ما حُذف — فالحكمُ
   عليها كالحكم على الشيفرة يجعل الحارسَ يمرّ على تعليقٍ ويظنّه تنفيذا. وقد
   وقع ذلك فعلا: حارسُ «سؤالِ الخادم المحلّيّ» بقي أخضرَ بعد نزع الاستدعاء،
   لأنّ `127.0.0.1` باقيةٌ في تعليقٍ فوقه. فما يُفحَص هو ما يُنفَّذ. */
const code = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

describe('ناشرُ الإنتاج موجود', () => {
  it('`deploy/deploy.sh` في المستودَع — وهو ما يستدعيه المراقب', () => {
    expect(existsSync(deployPath), 'حُذف مرّةً بادّعاءٍ أنّه غيرُ مستعمَل، وكان يخدم النطاق').toBe(true)
  })

  it('ويقف عند أوّل خطأٍ بدل أن يكمل على عطب', () => {
    expect(read(deployPath)).toMatch(/set -euo pipefail/)
  })
})

describe('ومراقبُ النشر يجعله يقع بلا يدٍ تشغّله', () => {
  it('موجودٌ — وبدونه يبقى النشرُ متوقّفا على أن يتذكّره إنسان', () => {
    expect(existsSync(watchPath)).toBe(true)
  })

  const wt = read(watchPath)

  it('ويقارن نسختَه بـ`origin/main` قبل أن يفعل شيئا', () => {
    expect(code(wt)).toMatch(/git fetch origin main/)
    expect(code(wt)).toMatch(/rev-parse origin\/main/)
  })

  it('ويُشغّل ناشرَ الإنتاج نفسَه — لا نسخةً ثانيةً تفترق عنه', () => {
    expect(code(wt), 'المراقبُ يقرّر متى يُنشَر لا كيف').toMatch(/deploy\/deploy\.sh/)
    expect(code(wt), 'ناشرُ Cloudways ليس ناشرَ الإنتاج — استدعاؤه نشرٌ إلى خادمٍ آخر')
      .not.toMatch(/deploy-cloudways\.sh/)
  })

  it('وقفلٌ يمنع نشرتَين متداخلتَين — ويُحرَّر مهما كانت النهاية', () => {
    expect(code(wt), 'دورةُ الجدولة أقصرُ من النشرة، فبلا قفلٍ تبدأ الثانيةُ فوق الأولى')
      .toMatch(/mkdir "\$LOCK"/)
    expect(code(wt)).toMatch(/trap .*rmdir/)
  })

  it('ولا يَنشُر من فرعٍ غيرِ main', () => {
    expect(code(wt)).toMatch(/rev-parse --abbrev-ref HEAD/)
  })

  it('ولا يبتلع الفشل — يكتبه في السجلّ بعلامةٍ تُبحَث', () => {
    expect(code(wt)).toMatch(/✖/)
  })

  it('ولا يُغرق السجلَّ حين لا جديد', () => {
    /* سطرٌ كلَّ خمس دقائق يجعل السجلَّ لا يُقرأ حين يهمّ */
    const noChange = /\$LOCAL" = "\$REMOTE"/.test(code(wt))
    expect(noChange, 'لا فرعَ لحالة «لا جديد»').toBe(true)
  })
})
