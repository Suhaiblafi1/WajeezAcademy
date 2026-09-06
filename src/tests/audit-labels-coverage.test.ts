/* معجمُ أسماء الأثر يغطّي كلَّ فعلٍ في الخادم — في المسار السريع.

   ── لماذا هنا، وقد كان في `server/tests/audit/entity-timeline.test.ts` ──

   هذا الفحصُ **نصّيٌّ محض**: يقرأ ملفّاتِ `server/` ويطابق ما فيها بالمعجم.
   لا قاعدةَ بيانات، ولا خادما، ولا بذرَ أدوار. زمنُه أجزاءٌ من الثانية.

   وكان ساكنا في ملفٍّ يُقلع Postgres ويبذر الصلاحيّات ويستورد الكتالوج ويبني
   التطبيق (`beforeAll` بمهلة ٢٤٠ ثانية)، داخل حزمةٍ زمنُها ٧٢٠ ثانية. فصار
   فحصٌ يُقاس بالملّيثانية محبوسا خلف بوّابةٍ من اثنتي عشرة دقيقة.

   وأثرُ ذلك مقيسٌ لا متوقَّع: في ٦ سبتمبر أُضيف الفعلُ `auth.founder.promoted`
   بلا اسمٍ عربيّ. شُغّلت `server/tests/auth` — ولم تُشغَّل `server/tests/audit`
   لأنّ ثمنَها اثنتا عشرة دقيقة. فوصل الخطأُ إلى `main` واحمرّت البوّابةُ
   ثلاثَ دفعاتٍ متتالية.

   **والدرسُ أنّ حارسا لا يُشغَّل ليس حارسا.** فما لا يحتاج قاعدةً يُنقل إلى
   حيث يُشغَّل في كلّ تغيير — والمسارُ السريع (`src/`) زمنُه خمسٌ وعشرون ثانية.

   ولا يبقى منه أثرٌ هناك: حارسان على قاعدةٍ واحدةٍ يتنازعان، فحُدَّ بملفّه. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditActionAr, entityTypeAr } from '@/application/audit/labels'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** كلُّ ملفّات `server/` عدا اختباراتِها — منها تُقرأ الأفعال */
function serverFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'tests' && name !== 'node_modules') walk(full)
      } else if (name.endsWith('.ts')) out.push(full)
    }
  }
  walk(join(root, 'server'))
  return out
}

describe('معجمُ الأثر يغطّي ما تكتبه الخدمات', () => {
  it('كلُّ فعلٍ في شيفرة الخادم له اسمٌ عربيّ', () => {
    /* سجلُّ الأثر يُعرض لصاحب المنصّة في `/admin/audit`. ومفتاحٌ لاتينيٌّ فيه
       يجعله سجلَّ مبرمجٍ لا سجلَّ عمل — وهو عطبٌ لا يُحمّر شيئا: الصفحةُ
       تعمل، والفعلُ يُكتب، ولا يفهمه قارئُه. */
    const actions = new Set<string>()
    for (const f of serverFiles()) {
      for (const m of readFileSync(f, 'utf8').matchAll(/action: '([a-z0-9._]+)'/g)) {
        actions.add(m[1])
      }
    }
    expect(actions.size, 'لم يُقرأ أيُّ فعلٍ من الشيفرة — تعطّل المسحُ نفسُه').toBeGreaterThan(100)
    const untranslated = [...actions].filter((a) => auditActionAr(a) === a)
    expect(untranslated, `أفعالٌ بلا اسمٍ عربيّ: ${untranslated.join(', ')}`).toEqual([])
  })

  it('وكلُّ نوعِ كيانٍ كذلك', () => {
    for (const t of ['user', 'cohort', 'enrollment', 'refund', 'trainer_application', 'support_ticket']) {
      expect(entityTypeAr(t), t).not.toBe(t)
    }
  })
})
