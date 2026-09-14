/* بلاغُ الاختيار — أين يُعرض، وهل يُكتم، وهل يُهرَب منه (ن-١٠).

   ═══ ثلاثةُ أعطابٍ يحرسها هذا الملفّ، ولكلٍّ ضحيّةٌ معلومة ═══

   ① **بلاغٌ في صفحةٍ واحدة.** لو رُكّب في «رحلتي» وحدَها لرآه من فتحها
      ولم يره من فتح «فواتيري» — ومالُه معلّقٌ في الحالتَين. فموضعُه إطارُ
      البوّابة: أيَّ صفحةٍ فتح وجده. والفحصُ على **التركيب** لا على وجود
      الاسم في ملفّ.
   ② **زرُّ «لاحقا».** بلاغُ التوثيق يُطوى بحقّ — تقصيرُ صاحبه وحدُّه
      معلوم. وهذا إخلالُ المنصّة، فالطيُّ فيه يخدمها وحدَها. والخطرُ عمليٌّ:
      الملفُّ المجاور يحمل الطيَّ كاملا (`safeSet` ومفتاحُ تخزين)، ونسخُه
      سطرٌ واحد.
   ③ **كتمُ الصنف.** شاشةُ التفضيلات تُتيح كتمَ أصنافٍ — ولو كان «تغييرٌ في
      شعبتك» منها لصار «لم يخبرني أحد» صحيحا في الظاهر، وهو عينُ ما يحذّر
      منه `categories.ts` في رأسه. والفحصُ يقرأ السجلَّ لا نصَّ التعليق.

   وحارسٌ رابعٌ على المعجم: الخياران يُقرآن في البريد وفي الزرّ، فمن زاد
   ثالثا ولم يكتب عبارتَه وجد زرّا فارغا يقرّر به مصيرَ ماله. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHOICE_LABEL_AR, LEARNER_CHOICES } from '../../application/trainer/departure-rules'
import { isSilenceable, NOTIFICATION_CATEGORIES } from '../../application/notifications/categories'
import { destinationFor } from '../../application/notifications/destinations'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** بلا تعليقاتٍ — فلا يمرّ حارسٌ لأنّ الكلمةَ وردت في شرح */
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const NOTICE = 'src/components/DepartureChoiceNotice.tsx'
const FRAME = 'src/pages/student/PortalLayout.tsx'

describe('ن-١٠ · بلاغُ الاختيار', () => {
  it('① يُركَّب في إطار البوّابة لا في صفحةٍ منها', () => {
    const frame = code(FRAME)
    expect(frame, 'الإطارُ لا يستورده').toContain('DepartureChoiceNotice')
    expect(frame, 'مستورَدٌ ولا يُركَّب — استيرادٌ لا يعرض شيئا')
      .toMatch(/<DepartureChoiceNotice\b/)
  })

  it('ولا يُركَّب في صفحةٍ بعينها — فمن فتح غيرَها لم يره', () => {
    const pages = ['Journey', 'Dashboard', 'Billing', 'Account', 'Inbox', 'Notifications']
    for (const p of pages) {
      expect(code(`src/pages/student/${p}.tsx`), `${p} تركّبه دون الإطار`)
        .not.toMatch(/<DepartureChoiceNotice\b/)
    }
  })

  it('② لا يُطوى ولا يُخفى — ولا نسخةَ من طيِّ بلاغ التوثيق', () => {
    const notice = code(NOTICE)
    /* آلةُ الطيِّ في الملفّ المجاور: تخزينٌ محلّيٌّ وحالةُ `folded`.
       ووجودُ أيٍّ منها هنا يعني بابا للتأجيل. */
    expect(notice, 'تخزينٌ محلّيٌّ — والطيُّ يُحفظ فيه').not.toMatch(/safeSet|safeGet|localStorage/)
    expect(notice, 'حالةُ طيٍّ أو إخفاء').not.toMatch(/folded|dismiss|hidden|لاحقا/i)
  })

  it('ويُرسم الخياران من المعجم لا نسخا — فلا يفترق ما في البريد عمّا في الزرّ', () => {
    const notice = code(NOTICE)
    expect(notice, 'لا يقرأ المعجم').toContain('CHOICE_LABEL_AR')
    for (const c of LEARNER_CHOICES) {
      expect(notice, `عبارةُ «${c}» منسوخةٌ في الشاشة — تُعدَّل في موضعٍ فتبقى في الآخر`)
        .not.toContain(CHOICE_LABEL_AR[c])
    }
  })

  it('③ تغييرُ الشعبة لا يُكتم — ومعه سببُ قفله', () => {
    const cat = NOTIFICATION_CATEGORIES.find((c) => c.key === 'enrollment_change')
    expect(cat, 'لا صنفَ لتغييرِ الشعبة أصلا').toBeTruthy()
    expect(cat!.silenceable, '«لم يخبرني أحد» يصير صحيحا في الظاهر').toBe(false)
    expect(cat!.lockedWhyAr, 'قفلٌ بلا تفسيرٍ في شاشة التفضيلات').toBeTruthy()
    for (const key of cat!.templateKeys) {
      expect(isSilenceable(key), `${key} يُكتَم`).toBe(false)
      expect(destinationFor(key, 'learner'), `${key} بلا وجهةٍ — رسالةٌ بلا زرّ`).toBeTruthy()
    }
  })

  it('وعرضُ الاختيار وقرارُه كلاهما في الصنف — لا أحدُهما', () => {
    const cat = NOTIFICATION_CATEGORIES.find((c) => c.key === 'enrollment_change')!
    for (const key of ['departure.choice', 'departure.resolved']) {
      expect(cat.templateKeys, `${key} خارجَ الصنف`).toContain(key)
    }
  })

  it('④ لكلّ خيارٍ عبارةٌ يقرؤها صاحبُه — ولا تتشابه عبارتان', () => {
    const seen = new Set<string>()
    for (const c of LEARNER_CHOICES) {
      const label = CHOICE_LABEL_AR[c]
      expect(label?.trim().length ?? 0, `«${c}» بلا عبارة`).toBeGreaterThan(8)
      expect(seen.has(label), `عبارتان متطابقتان — لا يُفرَّق بين الخيارَين`).toBe(false)
      seen.add(label)
    }
  })
})
