/* نشرُ الإنتاج من GitHub — الحواجزُ التي بها وحدَها يصحّ وضعُ مفتاحٍ هناك.

   ── ولمَ حارسٌ لسيرِ عملٍ لا يُشغَّل في الفحص ──

   هذا الملفُّ يحمل مفتاحا يفتح خادمَ الإنتاج. وخطؤه لا يظهر في اختبارٍ أحمر،
   بل في نشرةٍ لم تقع وظُنّت واقعة، أو في مفتاحٍ صار يفتح أكثرَ ممّا أُريد له.
   فالمقيسُ هنا الخصائصُ التي إن سقطت واحدةٌ منها سقط الأمانُ كلُّه:

   · **لا يُنشَر إلّا أخضر** — المحفّزُ نجاحُ CI لا مجرّدُ الدفع على `main`.
   · **ولا يختار هذا السيرُ ما يُنفَّذ** — لا أمرَ بعد عنوان المضيف، فالأمرُ
     مفروضٌ في `authorized_keys`. ومن غيّر هذا حوّل مفتاحَ نشرٍ إلى صَدَفة.
   · **وبصمةُ المضيف مثبّتة** — ولو صار `StrictHostKeyChecking` إلى `no`
     لَقبِل أيَّ خادمٍ يعترض الطريقَ وسلّمه المفتاح.
   · **والنجاحُ يُقاس بعلامةٍ من `deploy.sh` نفسِه** — ولو سقط الأمرُ المفروض
     لَخرج `ssh` بصفرٍ بلا نشر. والعلامةُ تُقابَل بالملفّ الذي يطبعها، فلا
     تبقى سلسلةً تُطابَق في فراغ.
   · **ولا يُكتب سرٌّ في متن أمرٍ صَدَفيّ** — `${{ secrets.… }}` داخل `run`
     يضعه في سطر الأمر، وسطرُ الأمر يُرى. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const wf = readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8')
const deployScript = readFileSync(join(root, 'deploy/deploy.sh'), 'utf8')

/** كتلةُ `on:` وحدَها — إلى أوّل مفتاحٍ في الجذر بعدها */
const onBlock = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(wf)?.[1] ?? ''
/** كتلُ `run:` كلُّها — وهي وحدَها ما يصير سطرَ أمرٍ في المُشغِّل.

    ويُقرأ بالإزاحة لا بتعبيرٍ نمطيّ: كتلةُ النصّ تنتهي عند أوّل سطرٍ إزاحتُه
    أقلُّ أو تساوي إزاحةَ `run:` نفسِها. وأوّلُ محاولةٍ هنا قرأت بالنمط
    فابتلعت `env:` الخطوةِ التالية — فمرّ الحارسُ على سرٍّ ليس في `run` أصلا،
    وسقط سقوطا كاذبا. والقياسُ بالبنية لا بالنصّ. */
function runBlocksOf(yaml: string): string[] {
  const lines = yaml.split('\n')
  const blocks: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const head = /^(\s*)run: \|/.exec(lines[i])
    if (!head) continue
    const indent = head[1].length
    const body: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (line.trim() === '') { body.push(line); continue }
      if ((/^\s*/.exec(line)?.[0].length ?? 0) <= indent) break
      body.push(line)
    }
    blocks.push(body.join('\n'))
  }
  return blocks
}

const runBlocks = runBlocksOf(wf)

describe('نشرُ الإنتاج لا يقع إلّا على أخضر', () => {
  it('المحفّزُ نجاحُ CI لا الدفعُ على main', () => {
    expect(onBlock, 'تعذّر قراءةُ كتلة on').not.toBe('')
    expect(onBlock, 'لا يتبع CI').toMatch(/workflow_run/)
    expect(onBlock, 'الدفعُ المباشر ينشر قبل أن يُفحَص').not.toMatch(/^\s*push:/m)
    expect(wf, 'لا يشترط نجاحَ CI').toMatch(/workflow_run\.conclusion\s*==\s*'success'/)
    expect(wf, 'لا يقصر النشرَ على main').toMatch(/workflow_run\.head_branch\s*==\s*'main'/)
  })

  it('ولا يُلغى نشرٌ جارٍ — فالتبديلُ في منتصفه يترك حاوياتٍ نصفَ مبدَّلة', () => {
    expect(wf).toMatch(/group:\s*deploy-production/)
    expect(wf, 'إلغاءُ نشرٍ جارٍ يترك الخادمَ بين حالتين').toMatch(/cancel-in-progress:\s*false/)
  })

  it('والسرُّ في بيئةٍ تُسمّى — فتُحكَم بقواعدها لا بمن يملك الكتابة وحدَه', () => {
    /* ويُقاس على مفتاحٍ حقيقيٍّ لا على ورودِ العبارة: أوّلُ صياغةٍ هنا كانت
       `toMatch(/environment:\s*production/)` فمرّ عليها نقضُ حذفِ المفتاح —
       لأنّ رأسَ الملفّ يشرح البيئةَ في **تعليق**، فطابقه الحارس. وهو بعينه
       ما يحذّر منه عرفُ المستودَع: الفحصُ على البنية لا على ورودِ حرف. */
    const declared = wf.split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .some((l) => /^\s+environment:\s*production\s*$/.test(l))
    expect(declared, 'لا مفتاحَ `environment` في الوظيفة — والتعليقُ لا يحمي سرّا').toBe(true)
  })
})

describe('والمفتاحُ لا يفتح إلّا بابا واحدا', () => {
  it('لا أمرَ يُمرَّر إلى ssh — فالأمرُ مفروضٌ على المفتاح في الخادم', () => {
    const ssh = /ssh -T[\s\S]*?"\$DEPLOY_USER@\$DEPLOY_HOST"([^\n]*)/.exec(wf)
    expect(ssh, 'لم يُقرأ استدعاءُ ssh').not.toBeNull()
    const trailing = (ssh![1] ?? '').replace(/2>&1\s*\|\s*tee\s+\S+/, '').trim()
    expect(trailing, `أمرٌ بعد عنوان المضيف: «${trailing}» — فالسيرُ يختار ما يُنفَّذ`).toBe('')
  })

  it('وبصمةُ المضيف مثبّتةٌ ولا تُقبل على عواهنها', () => {
    expect(wf).toMatch(/StrictHostKeyChecking=yes/)
    expect(wf, 'قبولُ أيّ مضيفٍ يسلّم المفتاحَ لمن يعترض الطريق')
      .not.toMatch(/StrictHostKeyChecking=(no|accept-new)/)
    expect(wf, 'بلا known_hosts لا معنى للتثبيت').toMatch(/UserKnownHostsFile=/)
    expect(wf, 'وبلا IdentitiesOnly قد يُجرَّب مفتاحٌ آخر').toMatch(/IdentitiesOnly=yes/)
  })

  it('والمفتاحُ يُمحى بعد الاستعمال ولو فشل النشر', () => {
    const wipe = /- name: محوُ المفتاح\n([\s\S]*?)(?=\n {6}- name:|\n*$)/.exec(wf)?.[1] ?? ''
    expect(wipe, 'لا خطوةَ محو').not.toBe('')
    expect(wipe, 'المحوُ لا يقع عند الفشل').toMatch(/if:\s*always\(\)/)
  })
})

/* ═══ ولا يحمرّ قبل أن يُضبَط ═══

   §٢-ب من `docs/DEPLOYMENT.md` تسجّل أنّ `deploy.yml` كان في هذا المستودَع
   قبلُ وحُذف في #30، وقياسُ حذفه: **تسعُ تشغيلات — سبعُ فشلٍ واثنتا تخطٍّ
   وصفرُ نجاح**، وسببُ الفشل أنّ أسرارَه كلَّها فارغة. فبقي يحمرّ على كلّ
   دمجةٍ حتّى صار الأحمرُ لا يُقرأ، ثمّ حُذف.

   فمن أعاد هذا المسارَ لزمه ألّا يعيد ذلك: ما لم تُضبَط الأسرارُ لا يُتّصل
   بشيء، ويُقال ما ينقص بالاسم. والأحمرُ يبقى لما يستحقّه — اتّصالٌ فشل، أو
   اتّصالٌ نجح ولم ينشر. */
describe('ولا يحمرّ قبل أن يُضبَط — فالأحمرُ الدائمُ لا يُقرأ', () => {
  const steps = [...wf.matchAll(/^ {6}- name: (.+)$/gm)].map((m) => m[1].trim())

  it('أوّلُ خطوةٍ تفحص الأسرارَ الأربعةَ بأسمائها', () => {
    expect(steps[0], 'أوّلُ خطوةٍ ليست فحصَ الضبط').toMatch(/أمضبوط/)
    /* ويُقاس داخلَ قائمة الفحص نفسِها لا في الملفّ كلِّه: أوّلُ صياغةٍ هنا
       كانت `expect(wf).toContain(key)`، فمرّ عليها نقضُ إسقاطِ `DEPLOY_USER`
       من القائمة — لأنّ الاسمَ يرد بعدُ في `env` وفي سطر `ssh`. */
    const check = /- name: أمضبوطٌ المسارُ؟[\s\S]*?for key in ([^;]+);/.exec(wf)?.[1] ?? ''
    expect(check, 'لم تُقرأ قائمةُ الأسرار المفحوصة').not.toBe('')
    for (const key of ['DEPLOY_SSH_KEY', 'DEPLOY_KNOWN_HOSTS', 'DEPLOY_HOST', 'DEPLOY_USER']) {
      expect(check, `السرُّ ${key} خارجَ قائمة الفحص — فيُتّصل وهو فارغ`).toContain(key)
    }
  })

  it('ولا يُتّصل بالخادم إلّا إذا مرّ الفحص', () => {
    /* الخطوةُ التي تحمل `ssh` — ويُقرأ شرطُها من السطور التي تسبق `run:` فيها */
    const deployStep = /- name: النشر\n([\s\S]*?)\n {6}- name:/.exec(wf)?.[1] ?? ''
    expect(deployStep, 'لم تُقرأ خطوةُ النشر').not.toBe('')
    expect(deployStep, 'يتّصل بالخادم ولو لم تُضبط الأسرار')
      .toMatch(/if:\s*steps\.ready\.outputs\.ready == 'true'/)
  })
})

describe('والنجاحُ يُقاس بما طُبع لا بخروجٍ بصفر', () => {
  it('يُفتَّش عن علامة تمام النشر', () => {
    expect(wf, 'لا فحصَ لعلامة النشر — اتّصالٌ ناجحٌ بلا نشرٍ يمرّ صامتا')
      .toMatch(/grep -q '([^']+)' deploy-output\.txt/)
  })

  it('والعلامةُ يطبعها `deploy/deploy.sh` فعلا — لا سلسلةٌ تُطابَق في فراغ', () => {
    const marker = /grep -q '([^']+)' deploy-output\.txt/.exec(wf)?.[1] ?? ''
    expect(marker, 'لم تُقرأ العلامة').not.toBe('')
    expect(deployScript, `العلامةُ «${marker}» لا يطبعها deploy.sh — فالفحصُ لا يفحص شيئا`)
      .toContain(marker)
  })
})

describe('ولا يُكتب سرٌّ في متن أمرٍ صَدَفيّ', () => {
  it('الأسرارُ تُمرَّر بيئةً لا تُدرَج في سطر الأمر', () => {
    expect(runBlocks.length, 'لم تُقرأ كتلُ run').toBeGreaterThan(0)
    for (const block of runBlocks) {
      expect(block, 'سرٌّ مُدرَجٌ داخل run — وسطرُ الأمر يُرى').not.toMatch(/\$\{\{\s*secrets\./)
    }
    /* ويُفتَّش سطرا سطرا لا بتعبيرٍ يجمع `env:` بما تحته: أوّلُ صياغةٍ هنا
       كانت `env:\n(?:[ \t]+.*\n)*[ \t]+DEPLOY_SSH_KEY:` — ومُكمِّمان
       متداخلان على النصّ نفسِه، فحين لا يُطابق يستكشف المحرّكُ انقساماتٍ
       تتضاعف. وعلّقت العمليّةَ على ١٠٠٪ من المعالج دقيقتين حتّى قُتلت.
       والفحصُ على البنية أرخصُ وأوضح. */
    const passedAsEnv = wf.split('\n').some((l) => /^\s+DEPLOY_SSH_KEY:\s*\$\{\{\s*secrets\./.test(l))
    expect(passedAsEnv, 'لا سرَّ يُمرَّر بيئةً أصلا').toBe(true)
  })

  it('ولا يُطبع المفتاحُ ولا يُشغَّل التتبّعُ الصَّدَفيّ', () => {
    for (const block of runBlocks) {
      expect(block, 'تتبّعٌ صَدَفيٌّ يطبع ما يمرّ به').not.toMatch(/set -[a-z]*x/)
      expect(block, 'طباعةُ المفتاح').not.toMatch(/(echo|cat|printf)[^\n]*DEPLOY_SSH_KEY[^>]*$/m)
    }
  })
})
