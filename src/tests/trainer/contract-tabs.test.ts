/* ═══ تبويبُ شاشة العقود ═══
 *
 * قال صاحبُ المنصّة: «صفحه العقود مكركبه.. اجعلها تابات او ابني فلتر
 * لاستطيع التميز بينهم وسهوله التنقل بينهم».
 *
 * ── وأخطرُ ما في التبويب ──
 *
 * حالةٌ لا تبويبَ لها تعني عقدا **لا يُرى في الشاشة أصلا**. والزحامُ الذي
 * شكا منه يُرى ويُبحث فيه، أمّا الغائبُ فلا يُعلَم أنّه غاب — فيبقى مدرّبٌ
 * ينتظر ولا صفَّ له. فالتغطيةُ تُقاس على مفاتيح `STATUS_AR` نفسِها في
 * الشاشة، لا على قائمةٍ تُكتب هنا وتفترق عنها.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CONTRACT_TABS, defaultTab, inTab, tabOfStatus, type ContractTabId,
} from '@/application/trainer/contract-tabs'
import { statusColumns } from '../../../scripts/status-checks'

/* ═══ ومن أين تُقرأ الحالات ═══

   قُرئت أوّلا من `STATUS_AR` في الشاشة — وتلك دائرة: هي **معجمُ العرض**،
   فمن حذف منها حالةً ضاقت القائمةُ المقيسةُ معها ومرّ الفحصُ. وقد جُرّب:
   رُفع وسمُ `amendment_requested` فلم يسقط شيء.

   والعقدُ الحقيقيُّ تعليقُ المخطّط — «التعليقُ عقدٌ، أو ليس شيئا» كما في
   رأس `status-checks.ts`، وقيدُ القاعدة مشتقٌّ منه. فمنه تُقرأ، فيسقط
   الفحصُ على حالةٍ بلا وسمٍ وعلى حالةٍ بلا تبويبٍ جميعا. */
const SCREEN = readFileSync(
  resolve(__dirname, '../../pages/admin/TrainerContracts.tsx'), 'utf8',
)
const STATUSES = (() => {
  const col = statusColumns().find((c) => c.model === 'TrainerContract' && c.field === 'status')
  if (!col) throw new Error('لم يُقرأ عمودُ حالة العقد من المخطّط — تبدّل اسمُه أو تعليقُه')
  return col.values
})()
/** وسمُ الشاشة لحالةٍ — `undefined` يعني أنّها تُعرَض بالإنجليزيّة خاما */
const labelOf = (st: string): string | undefined => {
  const block = /const STATUS_AR: Record<string, string> = \{([\s\S]*?)\n\}/.exec(SCREEN)
  return new RegExp(`\\b${st}:\\s*"([^"]+)"`).exec(block?.[1] ?? '')?.[1]
}

describe('كلُّ حالةٍ لها تبويبٌ يُرى فيه', () => {
  it('المسحُ قرأ الحالاتِ فعلا — فلا يمرّ الفحصُ على فراغ', () => {
    /* حارسُ الحارس: تبدّلُ شكلِ `STATUS_AR` يجعل القائمةَ فارغةً فيخضرّ
       المنعُ على لا شيء — وقد مرّ ذلك في هذه المنصّة ثلاثَ مرّات. */
    expect(STATUSES.length, 'لم تُقرأ أيُّ حالةٍ من المخطّط').toBeGreaterThan(5)
    expect(STATUSES, 'الحالةُ المحوريّةُ غائبةٌ عن المقروء').toContain('signed')
  })

  it('⚠️ ولا حالةَ بلا تبويب — فلا يغيب عقدٌ عن الشاشة', () => {
    const homeless = STATUSES.filter(
      (st) => !CONTRACT_TABS.some((t) => t.statuses?.includes(st)),
    )
    expect(homeless, 'حالةٌ بلا تبويب: عقدُها لا يُرى إلّا في «الكلّ»، ومن لم يفتحه لم يعلم')
      .toEqual([])
  })

  /* وحالةٌ بلا وسمٍ تُعرَض «amendment_requested» إلى جنب اسم المدرّب —
     وقد كانت كذلك فعلا قبل هذه الدفعة. */
  it('⚠️ ولا حالةَ بلا وسمٍ عربيٍّ في الشاشة', () => {
    const bare = STATUSES.filter((st) => !labelOf(st))
    expect(bare, 'حالةٌ بلا وسم: تُعرَض بالإنجليزيّة خاما لمن يقرأ الشاشة').toEqual([])
  })

  it('ولا حالةَ في تبويبَين — فلا يُعَدّ عقدٌ مرّتين', () => {
    for (const st of STATUSES) {
      const homes = CONTRACT_TABS.filter((t) => t.statuses?.includes(st)).map((t) => t.id)
      expect(homes.length, `الحالة «${st}» في تبويبَين: ${homes.join(' · ')}`).toBe(1)
    }
  })

  it('و«الكلّ» يسع كلَّ حالةٍ — شبكةُ أمانٍ لا يسقط منها صفّ', () => {
    for (const st of [...STATUSES, 'حالةٌ لم تولد بعد']) {
      expect(inTab('all', st), `«الكلّ» لا يسع «${st}»`).toBe(true)
    }
  })

  /* وما لا يُعرَف يسكن الأرشيفَ لا العدم: الاختبارُ أعلاه يمسكه قبل الدفع،
     فإن مرّ مع ذلك رآه «منتهية» و«الكلّ». */
  it('وحالةٌ طارئةٌ لا تختفي — تسكن «منتهية»', () => {
    expect(tabOfStatus('طورٌ لم يُكتب له تبويب')).toBe('closed')
  })
})

describe('والتبويبُ يفرز ما وُضع له', () => {
  /* ═══ والدورُ لا الورقة ═══
     الموقَّعُ ينتظر ختمَنا، ومن طلب تعديلا ينتظر جوابَنا — وكلاهما عملٌ على
     مكتبنا وإن اختلفت حالُ ورقتهما. */
  it('«ينتظرك» للموقَّع ولمن طلب تعديلا — فالدورُ علينا فيهما', () => {
    expect(inTab('awaiting_you', 'signed')).toBe(true)
    expect(inTab('awaiting_you', 'amendment_requested'), 'طلبُ التعديل يُحسَب انتظارا منه').toBe(true)
    for (const st of ['sent', 'draft', 'countersigned', 'revoked']) {
      expect(inTab('awaiting_you', st), `«${st}» ظهر في «ينتظرك»`).toBe(false)
    }
  })

  it('و«ينتظرهم» للمرسَل وحدَه — هو الذي عليه أن يوقّع', () => {
    expect(inTab('awaiting_them', 'sent')).toBe(true)
    expect(inTab('awaiting_them', 'amendment_requested'), 'من ينتظر جوابَنا عُدّ متأخّرا عن التوقيع').toBe(false)
    expect(inTab('awaiting_them', 'signed')).toBe(false)
  })

  it('و«منتهية» تجمع الأربعةَ المغلقة', () => {
    for (const st of ['declined', 'revoked', 'expired', 'terminated']) {
      expect(inTab('closed', st), `«${st}» ليست في «منتهية»`).toBe(true)
    }
    expect(inTab('closed', 'countersigned'), 'النافذُ عُدّ منتهيا').toBe(false)
  })
})

describe('ويُفتَح على أوّل ما فيه عمل', () => {
  const counts = (o: Partial<Record<ContractTabId, number>>) =>
    (t: ContractTabId) => o[t] ?? 0

  it('⚠️ فإن كان ثمّة ما ينتظرك فهو المفتوح', () => {
    expect(defaultTab(counts({ awaiting_you: 1, awaiting_them: 9, closed: 40 })))
      .toBe('awaiting_you')
  })

  it('وإلّا فما ينتظرهم — لا الأرشيف', () => {
    expect(defaultTab(counts({ awaiting_them: 3, closed: 40 }))).toBe('awaiting_them')
  })

  /* ولا يُفتَح على «منتهية» وفيها أربعون صفّا بينما «نافذة» فيها عملٌ حيّ */
  it('والنافذُ يسبق المنتهي', () => {
    expect(defaultTab(counts({ live: 2, closed: 40 }))).toBe('live')
  })

  it('وشاشةٌ لا عقدَ فيها تُفتَح على «الكلّ» — فيُقرأ فراغُها مرّةً واحدة', () => {
    expect(defaultTab(counts({}))).toBe('all')
  })
})

describe('وكلُّ تبويبٍ يقول شيئا حين يخلو', () => {
  it('⚠️ فلا «لا نتائج» عاريةٌ في موضع', () => {
    for (const t of CONTRACT_TABS) {
      expect(t.emptyAr.trim().length, `«${t.labelAr}» بلا جملةِ فراغ`).toBeGreaterThan(15)
      expect(t.labelAr.trim().length, `تبويبٌ بلا اسم`).toBeGreaterThan(2)
    }
  })

  it('ولا تبويبَ مكرَّرُ المعرِّف', () => {
    const ids = CONTRACT_TABS.map((t) => t.id)
    expect(new Set(ids).size, 'معرِّفٌ مكرَّر — فأيُّهما يُفتَح؟').toBe(ids.length)
  })

  it('و«الكلّ» آخرُها — فالعملُ يتقدّم على الأرشيف', () => {
    expect(CONTRACT_TABS[CONTRACT_TABS.length - 1].id).toBe('all')
    expect(CONTRACT_TABS[0].id, 'أوّلُ التبويب ليس ما ينتظرك').toBe('awaiting_you')
  })
})
