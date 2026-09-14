/* `deploy/status.sh` يُقرأ ولا يكتب — والوعدُ يُحرَس لا يُوعَد به.

   أمرٌ يقال عنه «اطّلاعٌ فقط» يُشغَّل بلا تردّدٍ على الإنتاج، ومن أضاف فيه
   كتابةً غدا لم يعد أحدٌ يتردّد. فالفحصُ على **ما يستطيعه النصّ** لا على ما
   يقوله تعليقُه: لا تعديلَ ملفّ، ولا كتابةَ في قاعدة، ولا نقلَ كائنٍ إلى
   وجهةِ النسخ، ولا لمسَ حاوية.

   وأخطرُ ما يُحرَس منه `--verify`: يكتب إثباتَ الاسترجاع الذي تشترطه إعادةُ
   ضبط الحسابات — محوٌ لا رجعةَ فيه. فتشخيصٌ يناديه يوقّع على نسخةٍ لم
   يفحصها من شغّله. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const raw = readFileSync(join(process.cwd(), 'deploy/status.sh'), 'utf8')
/* بلا تعليقات: ذكرُ «backup.sh --verify» في شرحٍ تحذيريٍّ ليس نداءً له */
const code = raw.replace(/^\s*#.*$/gm, '')

describe('لا يكتب شيئا', () => {
  it('لا يعدّل ملفّا في مكانه', () => {
    expect(code, 'sed -i يعدّل ملفّا').not.toMatch(/\bsed\s+-i\b/)
    expect(code, 'tee يكتب').not.toMatch(/\|\s*tee\b/)
  })

  it('ولا يحوّل مخرَجا إلى ملفّ — و`/dev/null` ليس ملفّا', () => {
    /* `>/dev/null` و`2>/dev/null` كتمٌ لا كتابة. وما عداهما إنشاءُ ملفّ. */
    const redirects = [...code.matchAll(/(?:^|[^0-9&])>>?\s*(\S+)/g)]
      /* الهدفُ قد يلتصق به فاصلٌ أو قوس: `>&2;` و`>/dev/null)` — يُقشَّر */
      .map((m) => m[1].replace(/[;)'"&|]+$/, ''))
    const toFiles = redirects.filter((t) => t !== '/dev/null' && t !== '&2' && t !== '&1')
    expect(toFiles, `تحويلٌ إلى ملفّ: ${toFiles.join(' · ')}`).toEqual([])
  })

  it('ولا يكتب في القاعدة — القراءةُ `select` وحدَها', () => {
    for (const verb of ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate']) {
      expect(code.toLowerCase(), `«${verb}» في أمرِ قاعدة`).not.toMatch(new RegExp(`-c\\s+['"][^'"]*\\b${verb}\\b`))
    }
    expect(code.toLowerCase(), 'لا استعلامَ قراءةٍ أصلا — أهذا الملفّ الصحيح؟').toMatch(/select /)
  })

  it('ولا ينقل كائنا إلى وجهة النسخ ولا يمسّ حاوية', () => {
    expect(code, 'rclone ينقل').not.toMatch(/\brclone\s+(copy|copyto|sync|move|delete|purge|mkdir)\b/)
    /* `listremotes` و`config file` قراءةٌ محضة — وهما المسموحان */
    expect(code, 'docker يغيّر حالَ الحاويات').not.toMatch(/\b(up|down|restart|stop|start|rm)\s+-?d?\b.*docker|docker[^\n]*\s(up|down|restart|stop|start)\b/)
  })

  it('ولا ينادي النسخَ الاحتياطيّ ولا إثباتَه', () => {
    /* `--verify` يكتب إثباتَ الاسترجاع الذي تشترطه إعادةُ ضبط الحسابات.

       والفحصُ على **موضع الأمر** لا على ورودِ الاسم: التقريرُ يذكر
       «bash deploy/backup.sh --verify» في سطرِ نصحٍ يطبعه، وذلك ذكرٌ لا نداء. */
    expect(code, 'يشغّل backup.sh').not.toMatch(/^\s*(bash|sh|source|\.)\s+\S*backup\.sh/m)
  })

  it('ولا يهاجر وثيقةً ولا يفرّغ عمودا', () => {
    expect(code, 'يشغّل الهجرة').not.toMatch(/storage:migrate/)
  })
})

describe('ولا يُخرج سرّا', () => {
  it('يقرأ مفاتيحَ بعينها ولا يسكب الملفّ', () => {
    expect(code, 'يطبع الملفَّ كلَّه').not.toMatch(/\bcat\s+.*\.env/)
    /* و`source`/`.` يحمّل كلَّ سرٍّ في الصدفة ثمّ يُوسَع في `echo` سهوا */
    expect(code, 'يحمّل الملفَّ في الصدفة').not.toMatch(/^\s*(\.|source)\s+.*\.env/m)
    expect(code, 'لا يقرأ المفاتيحَ بـgrep').toMatch(/grep -E "\^\$1="/)
  })
})
