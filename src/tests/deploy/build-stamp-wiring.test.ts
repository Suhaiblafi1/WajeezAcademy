/* بصمةُ الالتزام تصل الصورةَ — حارسُ سؤالٍ لا يُجاب بدونه.

   `/api/version` بُني ليجيب سؤالا واحدا: **هل ما يخدمه الخادمُ هو آخرُ ما
   دُمج؟** وقد أجاب على الإنتاج الحيّ (٦ سبتمبر ١٦:١٨): «الالتزام: null ·
   مصدرُ البصمة: مجهول».

   والسببُ سلسلةٌ من ثلاث حلقات، تنكسر بأيّ واحدة:

     `.dockerignore` يستثني `.git` — وهو صواب: تاريخُ المستودَع لا مكانَ له
     في صورةِ إنتاج. فلا نسخةَ Git داخل البناء، ولا يقرأ
     `write-build-stamp.ts` الالتزامَ من قرصٍ لا يحمله.

   فيُمرَّر من الخارج: `deploy.sh` يصدّره ← `compose` يمرّره وسيطَ بناء ←
   `Dockerfile` يحوّله متغيّرَ بيئةٍ يقرؤه السكربت.

   وأثرُ كسرِ أيٍّ منها **غياب**: البناءُ ينجح، والموقعُ يعمل، والاختباراتُ
   خضراء — ولا يستطيع أحدٌ أن يقول «النشرةُ وصلت» ولا «لم تصل». وهو بعينه ما
   أبقى سؤالَ «لماذا أرى موقعا قديما؟» مفتوحا أسبوعا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (s: string) => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

describe('سلسلةُ بصمة الالتزام إلى داخل الصورة', () => {
  it('`.dockerignore` يستثني `.git` — فالقراءةُ من القرص مستحيلةٌ داخل البناء', () => {
    /* لا يُطلب تغييرُه: إدخالُ `.git` إلى صورة الإنتاج يضخّمها ويسرّب تاريخا
       لا حاجةَ به. المقصودُ إثباتُ أنّ هذا هو الواقعُ الذي بُنيت عليه السلسلة. */
    expect(bare(read('.dockerignore'))).toMatch(/^\.git$/m)
  })

  it('والناشرُ يصدّر الالتزامَ قبل البناء', () => {
    const sh = bare(read('deploy/deploy.sh'))
    expect(sh, 'بلا تصدير، الوسيطُ فارغٌ والختمُ أعمى').toMatch(/export GIT_COMMIT_SHA=/)
    const exportAt = sh.indexOf('export GIT_COMMIT_SHA=')
    const buildAt = sh.indexOf('build app')
    expect(exportAt, 'التصديرُ بعد البناء لا ينفع شيئا').toBeLessThan(buildAt)
  })

  it('والمنظومةُ تمرّره وسيطَ بناء', () => {
    const y = bare(read('deploy/compose.prod.yml'))
    expect(y).toMatch(/GIT_COMMIT_SHA:\s*\$\{GIT_COMMIT_SHA/)
  })

  it('والصورةُ تستقبله وتحوّله متغيّرَ بيئة', () => {
    const d = read('Dockerfile')
    expect(d, 'ARG بلا ENV لا يراه السكربتُ وقتَ التشغيل').toMatch(/ARG GIT_COMMIT_SHA/)
    expect(d).toMatch(/ENV GIT_COMMIT_SHA=\$GIT_COMMIT_SHA/)

    /* والترتيبُ يُقاس على المتن لا على التعليقات — وتعليقٌ يذكر أمرَ البناء
       فوق الـARG كان يُزحزح الموضعَ ويمرّ الحارسُ وهو لا يقيس شيئا. */
    const body = bare(d)
    const argAt = body.indexOf('ARG GIT_COMMIT_SHA')
    const buildAt = body.search(/^RUN .*npm run build/m)
    expect(buildAt, 'لا سطرَ بناءٍ في Dockerfile — تغيّرت بنيتُه').toBeGreaterThan(-1)
    expect(argAt, 'الوسيطُ بعد البناء لا يبلغ السكربت').toBeLessThan(buildAt)
  })

  it('وأمرُ البناء في الصورة يمرّ بخطّافٍ يكتب الختم', () => {
    /* الحلقةُ الرابعة، ولم تكن محروسة. كان الحارسُ يبحث عن نصّ
       `npm run build` حرفا، فيمرّ على `npm run build:image` **لأنّ الاسمَ
       جزءٌ من اسم** — وهو بعينه العطبُ الذي تحذّر منه CLAUDE.md.

       والكسرُ الحقيقيّ صامت: `npm run build` يجري `prebuild` تلقائيا فيُكتب
       الختم. فمن استبدله بـ`vite build` مباشرةً، أو بسكربتٍ بلا `pre`، بنى
       صورةً بلا ختم — **والبناءُ ناجح، والموقعُ يعمل، والاختباراتُ خضراء** —
       ويعود `/api/version` إلى «الالتزام: null»، وهو السؤالُ الذي بُني له.

       فيُقرأ الاسمُ من Dockerfile نفسِه لا يُكتب هنا: من غيّره وأبقى
       السلسلةَ مرّ، ومن قطعها سقط. */
    const m = bare(read('Dockerfile')).match(/^RUN .*\bnpm run (\S+)/m)
    expect(m, 'لا أمرَ `npm run` للبناء في Dockerfile').toBeTruthy()
    const script = m![1]

    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(
      pkg.scripts[script],
      `Dockerfile ينادي «${script}» ولا وجودَ له في package.json`,
    ).toBeTruthy()

    const hook = pkg.scripts[`pre${script}`]
    expect(hook, `«${script}» بلا خطّاف «pre${script}» — تُبنى صورةٌ بلا ختم`).toBeTruthy()
    expect(hook, 'الخطّافُ موجودٌ ولا يكتب الختم').toMatch(/write-build-stamp/)
  })

  it('والاسمُ الذي يُصدَّر هو الذي يُقرأ — فلا حلقةٌ تسمّي غيرَ ما تسمّي الأخرى', () => {
    const stamp = read('server/build-stamp.ts')
    expect(stamp, 'اسمٌ يُصدَّر ولا يُقرأ يكسر السلسلةَ صامتا').toMatch(/'GIT_COMMIT_SHA'/)
  })

  it('ولا يُسقط غيابُه البناء — الموقعُ أهمُّ من ختمه', () => {
    expect(read('Dockerfile'), 'وسيطٌ بلا افتراضٍ يُفشل البناءَ لمن يبني بلا Git')
      .toMatch(/ARG GIT_COMMIT_SHA=""/)
  })
})
