/* حارسُ خطّ النشر — لأنّ عطبَه لا يظهر في اختبارٍ يفشل.

   القصّةُ التي وُلد منها هذا الملفّ: كان في المستودَع ملفُّ نشرٍ يَنشُر إلى
   تصميمٍ لم يُستعمل قطّ (`deploy/deploy.sh` على خادمٍ ذاتيّ). فحُذف التصميمُ
   وحُذف معه ملفُّ النشر — بحجّةٍ صحيحةٍ في وقتها. **وبقي المستودَع بلا نشرٍ
   آليٍّ إطلاقا، ولا اختبارَ واحدٌ لاحظ.** كلُّ شيءٍ أخضر، والنشرةُ صارت سبعةَ
   أوامرَ يدويّةٍ يسهل نسيانُ إحداها — وقد نُسيت فعلا: `npm run build` جرى
   وعمليّةُ Node بقيت بالشيفرة القديمة، فعرضت الواجهةُ الجديدَ والـAPI القديم.

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
const deployPath = join(root, 'scripts/deploy-cloudways.sh')
const watchPath = join(root, 'scripts/deploy-watch.sh')
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

/* التعليقاتُ في هذين الملفّين تشرح ما يفعلانه وتذكر أسماءَ ما حُذف — فالحكمُ
   عليها كالحكم على الشيفرة يجعل الحارسَ يمرّ على تعليقٍ ويظنّه تنفيذا. وقد
   وقع ذلك فعلا: حارسُ «سؤالِ الخادم المحلّيّ» بقي أخضرَ بعد نزع الاستدعاء،
   لأنّ `127.0.0.1` باقيةٌ في تعليقٍ فوقه. فما يُفحَص هو ما يُنفَّذ. */
const code = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

describe('سكربتُ النشر يفعل ما تصفه الوثيقة', () => {
  it('موجودٌ في المستودَع — لا مكتوبا بيدٍ على الخادم', () => {
    expect(existsSync(deployPath), 'أمرُ نشرٍ خارج المستودَع لا يُراجَع ولا يتحدّث').toBe(true)
  })

  const sh = read(deployPath)

  it('ويقف عند أوّل خطأٍ بدل أن يكمل على عطب', () => {
    expect(sh).toMatch(/set -euo pipefail/)
  })

  it.each([
    /* وبلا السحب يبقى الخادمُ على شيفرته، فيراه المراقبُ متأخّرا في كلّ دورة
       فيَنشُر كلَّ خمس دقائق أبدا — حلقةٌ لا تنتهي ولا تُصلح شيئا. */
    ['git merge --ff-only origin/main', 'الخادمُ يبقى على شيفرته، ويُعاد النشرُ كلّ دورةٍ بلا نهاية'],
    ['npx prisma migrate deploy', 'انحرافُ مخطَّطٍ يُسقط مساراتِ الخادم بـ٥٠٠'],
    ['npm run build', 'الواجهةُ لا تُبنى'],
    ['npm run catalog:import', 'الكتالوجُ الذي يراه المتعلّمُ يتجمّد — الجداولُ الحيّة لا تتغيّر'],
    ['npm run catalog:publish', 'محرّكُ التشخيص يتجمّد على لقطته القديمة'],
  ])('يحوي «%s» — وبدونه: %s', (cmd) => {
    expect(sh).toContain(cmd)
  })

  it('وأخطرُها: إعادةُ تشغيل عمليّة Node — بلا هذا لا يتغيّر الـAPI أبدا', () => {
    expect(code(sh), 'الأمرُ الافتراضيّ').toMatch(/supervisorctl restart all/)
    /* والتنفيذُ لا التعيينُ وحدَه: نزعُ سطر التشغيل يترك الاسمَ في المتغيّر،
       فيبقى الحارسُ أخضرَ والنشرةُ لا تعيد تشغيل شيء. أُثبت هذا فعلا. */
    expect(code(sh), 'الأمرُ مُعيَّنٌ ولا يُنفَّذ').toMatch(/^eval "\$\{RESTART_CMD\}"$/m)
  })

  it('ويفرّغ Varnish أو يقول لماذا لم يفعل — لا تفريغَ صامتا', () => {
    expect(sh).toMatch(/varnishadm/)
    expect(sh).toMatch(/Purge Varnish/)
  })

  it('ولا يُعلن النجاحَ حتّى يعلن الخادمُ الالتزامَ المنشور', () => {
    expect(code(sh), 'التحقّقُ يسأل الخادمَ المحلّيّ — لا النطاقَ العامّ الذي يمرّ بـVarnish')
      .toMatch(/127\.0\.0\.1/)
    expect(code(sh)).toMatch(/api\/version/)
    /* المقارنةُ هي المقصود: استدعاءٌ بلا مقارنةٍ تحقّقٌ في الاسم وحدَه */
    expect(code(sh)).toMatch(/\$LIVE" != "\$\{DEPLOYED_SHA\}/)
  })

  it('ولا يستدعي ملفَّ التصميم المحذوف', () => {
    expect(code(sh), 'deploy/deploy.sh حُذف مع التصميم الذاتيّ — استدعاؤه نشرٌ إلى لا شيء')
      .not.toMatch(/deploy\/deploy\.sh/)
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

  it('ويُشغّل سكربتَ النشر نفسَه — لا نسخةً ثانيةً تفترق عنه', () => {
    expect(code(wt)).toMatch(/deploy-cloudways\.sh/)
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
