/* قائمةُ حالاتِ صندوق الموظّف: أسماءٌ موجودةٌ فعلا، ومُنَمَّطةٌ فلا تُخترَع.
 *
 * ── العطبُ الذي وُلد منه ──
 *
 * `staff-inbox.service.ts` كانت تعدّ «طلباتُ انضمامٍ في مرحلةٍ تنتظرك» بـ
 * `['submitted', 'in_review', 'shortlisted', 'demo_scheduled', 'academic_review']`
 * — و`in_review` و`demo_scheduled` **ليستا من حالات طلب المدرّب**: الصحيحُ
 * `under_review` و`demo_requested`.
 *
 * و`in_review` حالةٌ صحيحةٌ لنماذجَ أخرى (طلبُ المتعلّم، وطلبُ تعديل المحتوى،
 * ومسوّدةُ التأليف)، وتُقرأ في الملفّ نفسِه على بُعد عشرين سطرا — فالأرجحُ
 * أنّها نُسخت من هناك.
 *
 * وأثرُه أنّ **«قيد المراجعة» — أكثرَ حالات الطابور ورودا — لم تكن تُعَدّ**.
 * وبطاقةٌ تعدّ أقلَّ ممّا في الطابور لا تصرخ: تُطمئن كذبا، وتُقرأ سنةً.
 *
 * ── ولمَ ليس هذا حارسا على المستودع كلِّه ──
 *
 * أوّلُ صياغةٍ له مسحت خدماتِ الخادم كلَّها عن كلّ `status: { in: [...] }`
 * قرب استعلامٍ على `trainerApplication`. وسقطت مرّتين:
 *
 * · **صرخت على الصواب**: `sent` و`signed` و`countersigned` في
 *   `profile: { is: { contracts: { none: { status: … } } } }` — حالاتُ
 *   **عقد** متشعّبةٌ علاقتَين تحت استعلام الطلب.
 * · **ثمّ صارت تقيس الفراغ** حين قُطعت النافذةُ عند أوّل علاقة: لم يبقَ لها
 *   شيءٌ تقرؤه أصلا.
 *
 * والسببُ أنّ مسحا نصّيّا لا يعرف **لأيِّ نموذجٍ** يعود مرشِّحٌ متشعّب: ذلك
 * عملُ المصرِّف لا عملُ `regex`. وحارسٌ يصرخ على الصواب يُتجاوَز، فيُتجاوَز
 * معه اليومَ الذي يصرخ فيه بحقّ — وهو أسوأُ من لا حارس.
 *
 * **فالحارسُ الحقيقيُّ هو التنميط**: `TrainerStatus[]` يجعل الاسمَ المخترَعَ
 * يسقط في `tsc` قبل أن يُدفَع. وهذا يُثبت أنّ التنميطَ قائمٌ ولم يُنقَض،
 * وأنّ ما تعدّه البطاقةُ هو ما اتُّفق عليه.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAINER_STATUSES } from '../../../server/services/trainer-application.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const INBOX = readFileSync(join(root, 'server/services/staff-inbox.service.ts'), 'utf8')

/** القائمةُ كما كُتبت في الملفّ — تُقرأ نصّا لأنّها غيرُ مُصدَّرة */
function inboxStatuses(): string[] {
  const m = /const TRAINER_INBOX_STATUSES: TrainerStatus\[\] = \[([^\]]*)\]/.exec(INBOX)
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : []
}

describe('ما تعدّه بطاقةُ طلبات الانضمام', () => {
  it('القائمةُ مقروءةٌ ومُنَمَّطة — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(INBOX, 'القائمةُ غيرُ منمَّطة — فاسمٌ مخترَعٌ لا يسقط في المصرِّف')
      .toMatch(/const TRAINER_INBOX_STATUSES: TrainerStatus\[\]/)
    expect(inboxStatuses().length, 'لم تُقرأ القائمة').toBeGreaterThan(0)
  })

  it('وكلُّ اسمٍ فيها حالةٌ موجودةٌ في معجم طلب المدرّب', () => {
    const wrong = inboxStatuses().filter((v) => !(TRAINER_STATUSES as readonly string[]).includes(v))
    expect(wrong, `أسماءٌ لا وجودَ لها: ${wrong.join('، ')}`).toEqual([])
  })

  it('ولا اسمَ من معجمِ نموذجٍ آخرَ يشبهه', () => {
    /* `in_review` و`demo_scheduled` بعينهما: صحيحتان في مواضعَ أخرى من هذا
       الملفّ، ومخترَعتان هنا. وهذا الفحصُ يمنع عودةَ النسخ من الجار. */
    for (const alien of ['in_review', 'demo_scheduled']) {
      expect(inboxStatuses(), `عاد «${alien}» إلى قائمة طلبات المدرّبين`).not.toContain(alien)
    }
  })

  it('وتعدّ ما ينتظرك أنت — قرارُ ٢٦ سبتمبر ٢٠٢٦', () => {
    /* خرجت `demo_requested`: تنتظر المتقدّمَ أن يقدّم ديمو لا تنتظرك.
       ودخلت `conditionally_approved`: عندك فعلا — أتعابُه ودوراتُه وعقدُه. */
    expect(inboxStatuses().sort()).toEqual(
      ['academic_review', 'conditionally_approved', 'shortlisted', 'submitted', 'under_review'],
    )
  })

  it('والعدُّ يقرأ القائمةَ لا مصفوفةً حرّةً كُتبت في موضعها', () => {
    expect(INBOX, 'عادت المصفوفةُ الحرّةُ إلى موضع العدّ')
      .toMatch(/trainerApplication\.count\(\{\s*\n\s*where: \{ status: \{ in: TRAINER_INBOX_STATUSES \} \}/)
  })
})
