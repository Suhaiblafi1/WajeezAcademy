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
    const argAt = d.indexOf('ARG GIT_COMMIT_SHA')
    const buildAt = d.indexOf('npm run build')
    expect(argAt, 'الوسيطُ بعد البناء لا يبلغ السكربت').toBeLessThan(buildAt)
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
