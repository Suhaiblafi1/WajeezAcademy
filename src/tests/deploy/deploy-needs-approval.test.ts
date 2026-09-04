/* النشرُ بموافقةِ صاحب المنصّة في كلّ مرّة — قرارُه في ٤ سبتمبر ٢٠٢٦.

   سُئل: نشرٌ تلقائيٌّ بعد خضرة CI على `main`، أم بموافقةٍ منه في كلّ مرّة؟
   فاختار الثانية. والفرقُ ليس في الراحة: مفتاحُ نشرٍ في أسرار GitHub يعني
   أنّ من يدفع على `main` يبلغ الخادم، والموافقةُ اليدويّة هي الفاصلُ بين
   «اختبارٌ أخضر» و«إنتاجٌ تغيّر».

   وهذا الملفُّ يحرس القرارَ لا الشيفرة: إعادةُ `workflow_run` سطرا واحدا
   تُحوّل النشرَ إلى تلقائيٍّ **بلا أن يسقط شيء** — لا اختبارٌ ولا بناءٌ ولا
   مراجعة. فيسقط هذا.

   وطبقةُ الحماية الثانية في إعدادات المستودع لا في اليمل:
     Settings ← Environments ← production ← Required reviewers
   وهي التي تُلزِم الموافقةَ حتّى لو أُعيد التلقائيُّ سهوا. ولا تُقرأ من
   الشيفرة، فالمحروسُ هنا شرطُها: أنّ الوظيفةَ تُعلن `environment: production`
   أصلا — فبلا هذا السطر لا يجد الإعدادُ ما يوقفه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const deploy = readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8')

/** الأسطرُ العاملة — بلا تعليقات */
const live = deploy
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

describe('النشر لا يقع بلا موافقة', () => {
  it('لا مُشغِّلٌ تلقائيٌّ عاملٌ — `workflow_dispatch` وحدَه', () => {
    /* كتلةُ `on:` وحدَها: شرطُ `if` يذكر `workflow_run` بحقٍّ — فهو يفحص
       نتيجتَه يومَ يُعاد، وذكرُه هناك ليس تشغيلا. */
    const onBlock = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(live)?.[1] ?? ''
    expect(onBlock, 'تعذّر قراءةُ كتلة on من deploy.yml').not.toBe('')
    expect(onBlock, 'workflow_run عاملٌ يعني نشرا بلا موافقة').not.toMatch(/workflow_run/)
    expect(onBlock, 'دفعٌ مباشرٌ يعني نشرا بلا موافقة').not.toMatch(/push:/)
    expect(onBlock).toMatch(/workflow_dispatch:/)
  })

  it('والوظيفةُ تُعلن بيئةَ الإنتاج — وبها يعمل حارسُ «Required reviewers»', () => {
    expect(live).toMatch(/environment:\s*production/)
  })

  it('ولا تنشر إلّا من `main` وبعد نجاح CI', () => {
    expect(live).toMatch(/workflow_run\.conclusion == 'success'|github\.event_name == 'workflow_dispatch'/)
    expect(live).toMatch(/head_branch == 'main'/)
  })

  it('والدخولُ لا يقبل أيَّ خادمٍ يجيب — المضيفُ معروفٌ صراحةً', () => {
    expect(live).toMatch(/known_hosts/)
    expect(live, 'StrictHostKeyChecking=no بابُ اعتراضٍ في الطريق').not.toMatch(/StrictHostKeyChecking=no/)
  })

  it('والمفتاحُ يُمسح بعد النشر ولو أخفق', () => {
    expect(live).toMatch(/if:\s*always\(\)/)
    expect(live).toMatch(/rm -f ~\/\.ssh\/id_ed25519/)
  })
})
