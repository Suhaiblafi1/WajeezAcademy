/* مركِّبُ بابِ النشر من GitHub — حارسُ ما يفشل صامتا على خادم الإنتاج.

   ═══ ولمَ حارسٌ لسكربتٍ لا يجري في الفحص ═══

   هو سكربتٌ يُنفَّذ **مرّةً** على خادمٍ لا يراه أحدٌ منّا، ويكتب في
   `authorized_keys` — أي في بابِ الدخول إلى الإنتاج. وخطؤه لا يحمرّ: النشرُ
   يعمل، والبابُ صار أوسعَ ممّا أُريد له؛ أو لا يعمل، ويُقرأ الفشلُ «مفتاحٌ
   خطأ» والعلّةُ في الإذن.

   وحدُّه كحدِّ أخيه (`install-auto-deploy.test.ts`): يُثبت أنّ المركِّبَ
   **مكتوبٌ كما يجب**، لا أنّ أحدا شغّله — وذاك لا يُقاس من المستودَع.

   ═══ وما يُفحص، وكلُّ واحدٍ منها عطبٌ وقع أو يقع ═══

   ① **الأمرُ المفروضُ كاملٌ، ويطابق ما تَعِد به الوثيقة.** هو الأمانُ كلُّه:
      بدونه مفتاحُ نشرٍ يصير صَدَفةً على الإنتاج. ولو سقط قيدٌ من أربعةٍ —
      أو تفرّق ما في السكربت عمّا في `DEPLOYMENT.md` — لم يحمرَّ شيء.
   ② **ولا يُطبع السرُّ بلا طلبٍ صريح.** تشغيلٌ عاديٌّ يطبع مفتاحا خاصّا
      يتركه في سجلّ الطرفيّة ولمن يقرأ الشاشة بعدك.
   ③ **ولا يُكتب فوق مفتاحٍ قائم.** ما في GitHub لن يوافق الجديد، فتفشل
      النشرةُ بعد أسبوعٍ بلا سببٍ ظاهر.
   ④ **ونسخةٌ قبل تعديل `authorized_keys`.** خطأٌ فيه يُقفل الخادمَ على صاحبه.
   ⑤ **والإذنُ يُضبط.** sshd يتجاهل الملفَّ إن كان أوسعَ — بلا سطرٍ في سجلّ.
   ⑥ **وميناءٌ غيرُ ٢٢ يُردّ** — لأنّ `deploy.yml` لا يمرّر `-p`، فالبابُ
      المركَّبُ عليه لا يُفتح أبدا.
   ⑦ **والأسماءُ الأربعةُ هي التي يفحصها السيرُ نفسُه** — فلا يطبع السكربتُ
      سرّا باسمٍ لا يقرؤه أحد.

   والفحصُ على البنية لا على ورودِ حرف: الشيفرةُ تُقرأ بلا تعليقاتها، فذِكرُ
   أمرٍ في شرحٍ ليس تنفيذا له. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const p = join(root, 'scripts/install-github-deploy.sh')
const src = existsSync(p) ? readFileSync(p, 'utf8') : ''

/** بلا التعليقات — فذِكرُ أمرٍ في شرحٍ ليس تنفيذا له */
const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

const doc = readFileSync(join(root, 'docs/DEPLOYMENT.md'), 'utf8')
const wf = readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8')

/** قيودُ `authorized_keys` في سطرٍ ما — مجموعةٌ تُقارَن بمجموعة */
const restrictionsIn = (text: string): string[] =>
  (text.match(/no-(?:agent-forwarding|port-forwarding|pty|X11-forwarding)/g) ?? []).sort()

describe('مركِّبُ بابِ النشر من GitHub', () => {
  it('موجودٌ وقابلٌ للتنفيذ', () => {
    expect(existsSync(p), 'السكربتُ مفقود').toBe(true)
    /* وأخواتُه في `scripts/` قابلةٌ للتنفيذ — فمن نسخ الأمرَ من الوثيقة
       بـ`bash script.sh` لا يتعثّر، ومن شغّله مباشرةً كذلك. */
    expect(statSync(p).mode & 0o111, 'بلا بتِّ تنفيذ').toBeGreaterThan(0)
    expect(code, 'بلا `set -euo pipefail` يمضي بعد أوّل فشل').toMatch(/set -euo pipefail/)
  })

  it('⚠️ ① الأمرُ المفروضُ كاملٌ بقيوده الأربعة — وهو الأمانُ كلُّه', () => {
    const forced = /FORCED="[^\n]*"/.exec(code)?.[0] ?? ''
    expect(forced, 'لم يُقرأ الأمرُ المفروض').not.toBe('')
    /* ويُفرَض أمرٌ بعينه: `deploy.sh` من هذه الشجرة لا أمرٌ يختاره الداعي */
    expect(forced, 'لا أمرَ مفروضٌ على المفتاح — فهو صَدَفةٌ على الإنتاج')
      .toMatch(/command=\\"bash \$ROOT\/deploy\/deploy\.sh\\"/)
    /* والقيودُ مجموعةٌ واحدةٌ يقرؤها الأمر — لا نسخةٌ ثانيةٌ تنحرف عنها */
    expect(forced, 'الأمرُ لا يقرأ مجموعةَ القيود').toContain(',$RESTRICTIONS')
    const set = /^RESTRICTIONS='([^']+)'$/m.exec(code)?.[1] ?? ''
    expect(set, 'مجموعةُ القيود مفقودة').not.toBe('')
    expect(restrictionsIn(set), 'قيدٌ ساقطٌ من الأربعة').toEqual([
      'no-X11-forwarding', 'no-agent-forwarding', 'no-port-forwarding', 'no-pty',
    ])
  })

  it('⚠️ وقيودُه هي قيودُ الوثيقة نفسُها — فلا تَعِد الوثيقةُ بما لا يُركَّب', () => {
    /* الوثيقةُ (§٢-جـ-٢) تكتب السطرَ ليُنسخ باليد، وهذا السكربتُ يكتبه
       بالآلة. ولو تفرّقا لَقرأ القارئُ أمانا ورُكِّب غيرُه. */
    const inDoc = /command="bash [^"]+\/deploy\.sh"[^\s]*/.exec(doc)?.[0] ?? ''
    expect(inDoc, 'سطرُ الأمر المفروض غائبٌ عن docs/DEPLOYMENT.md').not.toBe('')
    expect(restrictionsIn(code), 'قيودُ السكربت تخالف قيودَ الوثيقة')
      .toEqual(restrictionsIn(inDoc))
  })

  it('⚠️ ② ولا يُطبع المفتاحُ الخاصُّ إلّا بطلبٍ صريح', () => {
    /* والمقيسُ **موضعُ** الطباعة لا وجودُها: `cat "$KEY"` مسموحٌ داخل فرع
       `--print-key` وحدَه. ولو خرج منه لَطبع كلُّ تشغيلٍ عاديٍّ سرّا. */
    const branch = /if \[ "\$MODE" = 'print-key' \]; then([\s\S]*?)\nfi/.exec(code)
    expect(branch, 'لا فرعَ خاصٌّ لطباعة المفتاح').not.toBeNull()
    expect(branch![1], 'فرعُ الطباعة لا يطبع المفتاح').toMatch(/cat "\$KEY"/)
    const outside = code.replace(branch![0], '')
    expect(outside, 'المفتاحُ الخاصُّ يُطبع خارج فرعه — سرٌّ في سجلّ الطرفيّة')
      .not.toMatch(/(cat|echo|printf)[^\n]*"\$KEY"/)
    /* وقيمتُه لا تُسرَّب في سطرِ القيم: يُذكر مسارُه لا محتواه */
    const values = /cat <<VALUES([\s\S]*?)VALUES/.exec(code)?.[1] ?? ''
    expect(values, 'كتلةُ القيم مفقودة').not.toBe('')
    expect(values, 'كتلةُ القيم تطبع محتوى المفتاح').not.toMatch(/\$\(cat "\$KEY"\)/)
  })

  it('⚠️ ③ ولا يُولَّد مفتاحٌ فوق مفتاحٍ قائم', () => {
    const gen = /ssh-keygen[^\n]*/.exec(code)?.[0] ?? ''
    expect(gen, 'لا توليدَ أصلا').not.toBe('')
    expect(gen, 'توليدٌ صامتُ الكتابةِ فوق القائم (-y أو -q مع الإجبار)').not.toMatch(/\s-y\b/)
    /* والشرطُ بنيةً: التوليدُ في فرعِ «لا مفتاحَ هنا» */
    const guarded = /if \[ -f "\$KEY" \]; then[\s\S]*?else\n[\s\S]*?ssh-keygen/.test(code)
    expect(guarded, 'التوليدُ غيرُ محميٍّ بوجود المفتاح — يُبدَّل ما في GitHub صامتا').toBe(true)
  })

  it('⚠️ ④ ونسخةٌ تُحفظ قبل تعديل authorized_keys — فهو بابُ دخولك', () => {
    const rewrite = code.indexOf('grep -vF "$BODY"')
    expect(rewrite, 'لا استبدالَ أصلا').toBeGreaterThan(-1)
    const before = code.slice(0, rewrite)
    expect(before, 'يُعاد كتابةُ الملفّ بلا نسخةٍ قبله').toMatch(/cp -p "\$AUTH"/)
    /* والاستبدالُ يسقط سطرَ هذا المفتاح وحدَه — لا يمحو مفاتيحَ صاحبه */
    expect(code, 'الاستبدالُ يُفرغ الملفَّ بدل أن يسقط سطرا').toMatch(/grep -vF "\$BODY" "\$AUTH"/)
  })

  it('⚠️ ⑤ والإذنُ يُضبط — وإلّا تجاهل sshd المفتاحَ بلا كلمة', () => {
    expect(code, 'إذنُ ~/.ssh لا يُضبط').toMatch(/chmod 700 "\$HOME\/\.ssh"/)
    expect(code, 'إذنُ authorized_keys لا يُضبط').toMatch(/chmod 600 "\$AUTH"/)
    expect(code, 'إذنُ المفتاح الخاصّ لا يُضبط').toMatch(/chmod 600 "\$KEY"/)
  })

  it('⚠️ ⑥ وميناءٌ غيرُ ٢٢ يُردّ — لأنّ السيرَ لا يمرّر -p', () => {
    const sshCall = /ssh -T[\s\S]*?"\$DEPLOY_USER@\$DEPLOY_HOST"/.exec(wf)?.[0] ?? ''
    expect(sshCall, 'لم يُقرأ استدعاءُ ssh في السير').not.toBe('')
    expect(sshCall, 'السيرُ صار يمرّر ميناءً — فلْيُرفع الردُّ من السكربت')
      .not.toMatch(/\s-p\s/)
    expect(code, 'السكربتُ لا يفحص الميناء — فيركّب بابا لا يُفتح').toMatch(/SSH_PORT/)
    const guard = /\[ "\$SSH_PORT" = '22' \][\s\S]{0,200}?fail/.test(code)
    expect(guard, 'ميناءٌ غيرُ ٢٢ يمرّ بلا ردّ').toBe(true)
  })

  it('⚠️ ⑦ والأسماءُ التي يطبعها هي التي يفحصها السيرُ', () => {
    /* ولو تفرّقا: يطبع السكربتُ سرّا باسمٍ لا يقرؤه السير، فيُلصَق ويُتخطّى
       النشرُ ويُقال «ينقص» — وقد لُصق. */
    const checked = /for key in ([^;]+);/.exec(wf)?.[1]?.trim().split(/\s+/) ?? []
    expect(checked.length, 'لم تُقرأ قائمةُ الأسرار من السير').toBe(4)
    const values = /cat <<VALUES([\s\S]*?)VALUES/.exec(code)?.[1] ?? ''
    for (const key of checked) {
      expect(values, `السرُّ ${key} لا يُطبع في كتلة القيم`).toContain(key)
    }
  })

  it('وآمنُ الإعادة: يُفتَّش قبل أن يُضاف سطر', () => {
    const append = code.indexOf('printf \'%s\\n\' "$LINE" >> "$AUTH"')
    expect(append, 'لا إضافةَ أصلا').toBeGreaterThan(-1)
    expect(code.slice(0, append), 'يُضاف السطرُ بلا تفتيشٍ — فيتكرّر في كلّ تشغيل')
      .toMatch(/grep -qxF "\$LINE" "\$AUTH"/)
  })

  it('ولا يلمس GitHub ولا يرفع سرّا إلى شبكة', () => {
    /* قاعدةُ المستودَع: «لا يُنقل مفتاحٌ في محادثة» — ولا في سكربتٍ يرفعه.
       فالسكربتُ يطبع ما تلصقه بيدك، ولا اتّصالَ شبكيّا فيه أصلا. */
    expect(code, 'اتّصالٌ شبكيٌّ في مركِّبٍ محلّيّ').not.toMatch(/\b(curl|wget|nc)\b/)
    expect(code, 'رمزُ GitHub في سكربتٍ يجري على الخادم').not.toMatch(/GH_TOKEN|GITHUB_TOKEN|api\.github\.com/)
  })
})
