/* حارسُ خطّ النشر — لأنّ عطبَه لا يظهر في اختبارٍ يفشل.

   القصّةُ التي وُلد منها هذا الملفّ: كان في المستودَع ملفُّ نشرٍ يَنشُر إلى
   تصميمٍ لم يُستعمل قطّ (`deploy/deploy.sh` على خادمٍ ذاتيّ). فحُذف التصميمُ
   وحُذف معه ملفُّ النشر — بحجّةٍ صحيحةٍ في وقتها. **وبقي المستودَع بلا نشرٍ
   آليٍّ إطلاقا، ولا اختبارَ واحدٌ لاحظ.** كلُّ شيءٍ أخضر، والنشرةُ صارت سبعةَ
   أوامرَ يدويّةٍ يسهل نسيانُ إحداها — وقد نُسيت فعلا: `npm run build` جرى
   وعمليّةُ Node بقيت بالشيفرة القديمة، فعرضت الواجهةُ الجديدَ والـAPI القديم.

   فالحرسُ هنا مصدريٌّ لأنّ الأثرَ ليس فشلا يُرى: هو **غيابُ** نشرة. ومن حذف
   هذا الملفَّ غدا أو نزع منه خطوةَ إعادة التشغيل لن يُسقط شيئا — إلّا هذا. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const workflowPath = join(root, '.github/workflows/deploy.yml')
const scriptPath = join(root, 'scripts/deploy-cloudways.sh')

describe('خطُّ النشر موجودٌ ويصل إلى الإنتاج', () => {
  it('ملفُّ النشر موجود — وغيابُه يعني أنّ كلّ نشرةٍ يدويّة', () => {
    expect(existsSync(workflowPath), 'لا ملفَّ نشرٍ في .github/workflows').toBe(true)
  })

  const wf = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : ''

  it('يُشغَّل بعد خضرة CI على main — لا على الدفع مباشرةً', () => {
    expect(wf).toMatch(/workflow_run:/)
    expect(wf).toMatch(/workflows:\s*\["CI"\]/)
    expect(wf).toMatch(/branches:\s*\[main\]/)
    /* `on: push` يعني نشرا قبل أن تخضرّ البوابات */
    const onBlock = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(wf)?.[1] ?? ''
    expect(onBlock, 'تعذّر قراءةُ كتلة on').not.toBe('')
    expect(onBlock, 'الدفعُ المباشرُ ينشر قبل نجاح الفحص').not.toMatch(/^\s*push:/m)
  })

  it('ولا يُنشَر إلّا من نجاحٍ فعليّ', () => {
    expect(wf).toMatch(/workflow_run\.conclusion == 'success'/)
    expect(wf).toMatch(/workflow_run\.head_branch == 'main'/)
  })

  it('ولا يُقطع نشرٌ في منتصفه', () => {
    expect(wf).toMatch(/group:\s*deploy-production/)
    expect(wf).toMatch(/cancel-in-progress:\s*false/)
  })

  it('ويُشغّل سكربتَ المستودَع لا ملفّ التصميم المحذوف', () => {
    expect(wf).toMatch(/scripts\/deploy-cloudways\.sh/)
    /* التعليقاتُ تذكر الملفَّ المحذوفَ لتشرح لماذا رحل — والمفحوصُ ما يُنفَّذ
       لا ما يُشرَح. فتُنزع أسطرُ التعليق قبل الحكم. */
    const executable = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')
    expect(executable, 'deploy/deploy.sh حُذف مع التصميم الذاتيّ — استدعاؤه نشرٌ إلى لا شيء')
      .not.toMatch(/deploy\/deploy\.sh/)
  })

  it('ويتحقّق من وصول النشرة بدل أن يفترضها', () => {
    expect(wf, 'النشرةُ تُعلَن ناجحةً حين يقولها الخادمُ الحيّ لا حين ترجع الأوامرُ بصفر')
      .toMatch(/api\/version/)
  })

  it('ولا يبدأ بإعدادٍ ناقصٍ ثمّ يفشل بلا سبب', () => {
    for (const key of ['SSH_HOST', 'SSH_USER', 'SSH_KEY', 'SSH_KNOWN_HOSTS', 'APP_PATH']) {
      expect(wf, `${key} لا يُفحص قبل البدء`).toContain(key)
    }
  })
})

describe('سكربتُ النشر يفعل ما تصفه الوثيقة', () => {
  it('موجودٌ في المستودَع — لا مكتوبا بيدٍ على الخادم', () => {
    expect(existsSync(scriptPath), 'أمرُ نشرٍ خارج المستودَع لا يُراجَع ولا يتحدّث').toBe(true)
  })

  const sh = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : ''

  it('ويقف عند أوّل خطأٍ بدل أن يكمل على عطب', () => {
    expect(sh).toMatch(/set -euo pipefail/)
  })

  it.each([
    ['npx prisma migrate deploy', 'انحرافُ مخطَّطٍ يُسقط مساراتِ الخادم بـ٥٠٠'],
    ['npm run build', 'الواجهةُ لا تُبنى'],
    ['npm run catalog:import', 'الكتالوجُ الذي يراه المتعلّمُ يتجمّد — الجداولُ الحيّة لا تتغيّر'],
    ['npm run catalog:publish', 'محرّكُ التشخيص يتجمّد على لقطته القديمة'],
  ])('يحوي «%s» — وبدونه: %s', (cmd) => {
    expect(sh).toContain(cmd)
  })

  it('وأخطرُها: إعادةُ تشغيل عمليّة Node — بلا هذا لا يتغيّر الـAPI أبدا', () => {
    expect(sh).toMatch(/supervisorctl restart all/)
  })

  it('ويفرّغ Varnish أو يقول لماذا لم يفعل — لا تفريغَ صامتا', () => {
    expect(sh).toMatch(/varnishadm/)
    expect(sh).toMatch(/Purge Varnish/)
  })
})
