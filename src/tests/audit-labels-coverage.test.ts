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
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditActionAr, entityTypeAr } from '@/application/audit/labels'
import { auditWeightOf } from '@/application/audit/weight'
import { NOTIFICATION_CATEGORIES } from '@/application/notifications/categories'
import { auditWindows, DYNAMIC, serverFiles, WRAPPED } from './helpers/audit-sites'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('معجمُ الأثر يغطّي ما تكتبه الخدمات', () => {
  /** كلُّ فعلٍ يُكتب في الأثر فعلا — حرفا كان أو قالبا أو شرطا */
  const collect = () => {
    const actions = new Set<string>()
    const templates = new Set<string>()
    for (const f of serverFiles()) {
      for (const w of auditWindows(readFileSync(f, 'utf8'))) {
        for (const m of w.matchAll(/action: '([a-z0-9._]+)'/g)) actions.add(m[1])
        /* الشرطُ: فرعاه كلاهما فعلٌ يُكتب */
        for (const m of w.matchAll(/action: [^,\n]*?\?\s*'([a-z0-9._]+)'\s*:\s*'([a-z0-9._]+)'/g)) {
          actions.add(m[1]); actions.add(m[2])
        }
        for (const m of w.matchAll(/action: `([^`]+)`/g)) {
          templates.add(m[1].replace(/\$\{([^}]+)\}/g, '@$1@'))
        }
      }
    }
    for (const [, keys] of Object.entries(WRAPPED)) for (const k of keys) actions.add(k)
    for (const t of templates) for (const k of DYNAMIC[t] ?? []) actions.add(k)
    return { actions, templates }
  }

  it('المسحُ يقرأ فعلا — وإلّا كان الحارسُ يخضرّ على فراغ', () => {
    const { actions } = collect()
    expect(actions.size, 'لم يُقرأ أيُّ فعلٍ من الشيفرة — تعطّل المسحُ نفسُه').toBeGreaterThan(100)
  })

  it('وكلُّ قالبٍ مبنيٍّ تُسمَّى توسّعاتُه — فلا يمرّ فعلٌ بلا اسم', () => {
    const { templates } = collect()
    const unnamed = [...templates].filter((t) => !DYNAMIC[t])
    expect(
      unnamed,
      `قوالبُ أفعالٍ بلا توسّعاتٍ مسمّاة: ${unnamed.join('، ')} — اكتبها في \`DYNAMIC\``,
    ).toEqual([])
    /* ولا اسمَ ميّتٍ يوسّع الثغرة: قالبٌ زال وبقي في القائمة */
    const stale = Object.keys(DYNAMIC).filter((t) => !templates.has(t))
    expect(stale, `قوالبُ في \`DYNAMIC\` لا وجودَ لها في الشيفرة: ${stale.join('، ')}`).toEqual([])
  })

  it('والغلافُ الذي يمرّر الفعلَ متغيّرا ما زال قائما', () => {
    for (const f of Object.keys(WRAPPED)) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, `${f} لم يعد يمرّر فعلا متغيّرا — راجِع \`WRAPPED\``).toMatch(/recordAudit\([\s\S]{0,200}?\baction,/)
    }
  })

  it('كلُّ فعلٍ في شيفرة الخادم له اسمٌ عربيّ', () => {
    /* سجلُّ الأثر يُعرض لصاحب المنصّة في `/admin/audit`. ومفتاحٌ لاتينيٌّ فيه
       يجعله سجلَّ مبرمجٍ لا سجلَّ عمل — وهو عطبٌ لا يُحمّر شيئا: الصفحةُ
       تعمل، والفعلُ يُكتب، ولا يفهمه قارئُه. */
    const { actions } = collect()
    const untranslated = [...actions].filter((a) => auditActionAr(a) === a)
    expect(untranslated, `أفعالٌ بلا اسمٍ عربيّ: ${untranslated.join(', ')}`).toEqual([])
  })

  /* ═══ ولكلِّ فعلٍ وزنُه — ي-١ ═══

     القائمةُ إلى جانب المعجم تُنسى: يُضاف الفعلُ الحادي والأربعون بعد
     المئتين **فلا يُرسل لأحد**، ولا شيءَ يُنبّه. فالوزنُ صفةٌ في الفعل،
     وهذا الحارسُ يقرأ الأفعالَ من الشيفرة نفسِها — **بالمِسحة نفسِها التي
     يقرأ بها الأسماء**، فلا يكون لـ«ما الأفعالُ القائمة؟» صاحبان. */
  it('ولكلِّ فعلٍ وزنٌ مُعلَن — فلا يُضاف فعلٌ لا يعرف أحدٌ أيصل صاحبَه أم لا', () => {
    const { actions } = collect()
    const unweighted = [...actions].filter((a) => auditWeightOf(a) === null)
    expect(
      unweighted,
      `أفعالٌ بلا وزن: ${unweighted.join('، ')} — صنِّفها في `
      + '`src/application/audit/weight.ts`: `high` لما يمسّ وصولَه أو مالَه أو سجلَّه، '
      + '`medium` لما يُرسَل ويحترم تفضيلاتِه، و`low` لما يغيّر النظامَ لا الإنسان.',
    ).toEqual([])
  })

  /* ═══ ولا وزنٌ يناقض ما قرّرته المنصّةُ قبله ═══

     `medium` معناه «يُرسَل ويحترم تفضيلاتِه». وفي الإشعارات أصنافٌ
     `silenceable: false` — لا يملك صاحبُها كتمَها، ولكلٍّ سببٌ مكتوب.

     فلو وُزن فعلٌ من صنفٍ لا يُكتم بـ`medium` لَشُحن تناقض: طبقةٌ تقول
     «اكتمه إن شئت» وأخرى تقول «لا تملك ذلك». وقد وقع فعلا في أوّل صياغةِ
     الأوزان — صُنّف التصحيحُ وعملُ الموظّف متوسّطَين، وكلاهما لا يُكتم. */
  it('وما لا يملك صاحبُه كتمَه لا يُوزن متوسّطا', () => {
    const { actions } = collect()
    const locked = new Set(
      NOTIFICATION_CATEGORIES.filter((c) => !c.silenceable).flatMap((c) => c.templateKeys),
    )
    const clash = [...actions].filter((a) => locked.has(a) && auditWeightOf(a) === 'medium')
    expect(
      clash,
      `أفعالٌ صنفُها لا يُكتم ووزنُها متوسّط: ${clash.join('، ')} — ارفعها إلى \`high\``,
    ).toEqual([])
  })

  it('وكلُّ نوعِ كيانٍ كذلك', () => {
    for (const t of ['user', 'cohort', 'enrollment', 'refund', 'trainer_application', 'support_ticket']) {
      expect(entityTypeAr(t), t).not.toBe(t)
    }
  })
})
