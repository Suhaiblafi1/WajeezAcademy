/* نسبُ العقد وجمعُه: القصّةُ الواحدةُ تُقرأ واحدةً.
 *
 * ── السؤالُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦)، أمام ثلاثة صفوفٍ لمدرّبٍ واحد: «لم أفهم
 * لماذا هذا التكرار؟». ولم يكن تكرارا: كان كلُّ صفٍّ جيلا من عقدٍ واحد —
 * فوثيقةٌ مسَّها توقيعٌ لا تُحرَّر في مكانها، يُغلَق الأصلُ ويُركَّب بديل.
 *
 * ── وأدقُّ ما يُقاس: أنّ السلسلةَ المعطوبةَ لا تعلّق الشاشة ──
 *
 * المشيُ في `replacesContractId` مشيٌ في بياناتٍ قد تكذب: صفٌّ يشير إلى
 * نفسه، أو اثنان يشير كلٌّ منهما إلى الآخر، أو أبٌ خارج المئتَين المحمَّلة.
 * وثلاثتُها حلقاتٌ لا نهائيّةٌ لو مُشيت بسذاجة — والشاشةُ تجمد على مدير
 * ينظر إليها. فتُقاس الثلاثةُ بمُدخلها، ولا يُنتظَر وقوعُها.
 *
 * ── والجمعُ لا يدّعي نسبا ──
 *
 * الجمعُ للعرض بصاحب العقد، والجيلُ لا يُقال إلّا حيث سُجّل الأبُ فعلا.
 * فعقودُ ما قبل المرحلة الثالثة بلا أبٍ مكتوب، ولا يُلفَّق لها واحد: ربطُ
 * وثيقتَين موقَّعتَين بقرينةٍ حدْسٌ يُقرأ بعد سنةٍ حقيقةً.
 */

import { describe, expect, it } from 'vitest'
import { groupContracts, readLineage } from '@/application/trainer/contract-lineage'

const row = (id: string, replacesContractId: string | null = null) => ({ id, replacesContractId })

describe('النسبُ يُقرأ حيث سُجّل', () => {
  it('ثلاثةُ أجيالٍ تُعَدّ أوّلا وثانيا وثالثا', () => {
    const rows = [row('c3', 'c2'), row('c2', 'c1'), row('c1')]
    const l = readLineage(rows)
    expect(l.get('c1')!.generation).toBe(1)
    expect(l.get('c2')!.generation).toBe(2)
    expect(l.get('c3')!.generation).toBe(3)
  })

  it('ومن له خلَفٌ يُعرَف خلَفُه، ورأسُ السلسلة بلا خلَف', () => {
    const rows = [row('c3', 'c2'), row('c2', 'c1'), row('c1')]
    const l = readLineage(rows)
    expect(l.get('c1')!.successorId).toBe('c2')
    expect(l.get('c2')!.successorId).toBe('c3')
    expect(l.get('c3')!.successorId, 'رأسُ السلسلة نُسب إليه خلَف').toBeNull()
  })

  it('وأبٌ خارجَ المحمَّل لا يُحسَب — والقائمةُ تأخذ مئتَين لا الكلّ', () => {
    /* لو حُسب لَقال «الجيل ٢» عن عقدٍ لا يُعرَض سلفُه، فيبحث عنه المديرُ
       في الشاشة ولا يجده. */
    const l = readLineage([row('c9', 'gone')])
    expect(l.get('c9')!.generation, 'عُدَّ سلفٌ غيرُ محمَّل').toBe(1)
    expect(l.get('c9')!.successorId).toBeNull()
  })

  it('ومن لا أبَ له فهو الجيلُ الأوّل — وهي حالُ كلِّ ما رُكّب قبل تسجيل النسب', () => {
    const l = readLineage([row('a'), row('b'), row('c')])
    for (const id of ['a', 'b', 'c']) {
      expect(l.get(id)!.generation, `لُفِّق نسبٌ لعقدٍ بلا أب (${id})`).toBe(1)
      expect(l.get(id)!.successorId).toBeNull()
    }
  })
})

describe('والسلسلةُ المعطوبةُ تُقطَع ولا تعلّق', () => {
  it('صفٌّ يشير إلى نفسه', () => {
    const l = readLineage([row('x', 'x')])
    expect(l.get('x')!.generation).toBe(1)
    expect(l.get('x')!.successorId, 'جُعل العقدُ خلَفَ نفسِه').toBeNull()
  })

  it('واثنان يشير كلٌّ منهما إلى الآخر', () => {
    const l = readLineage([row('p', 'q'), row('q', 'p')])
    /* لا يُشترَط رقمٌ بعينه — المطلوبُ أن تعود القراءةُ أصلا، وأن يبقى
       العددُ في حدوده لا يهرب إلى ما لا نهاية. */
    expect(l.get('p')!.generation).toBeLessThanOrEqual(64)
    expect(l.get('q')!.generation).toBeLessThanOrEqual(64)
  })

  it('وسلسلةٌ أطولُ من الحدّ تقف عنده', () => {
    const rows = [row('n0')]
    for (let i = 1; i < 300; i += 1) rows.push(row(`n${i}`, `n${i - 1}`))
    const l = readLineage(rows)
    expect(l.get('n299')!.generation, 'تجاوزت القراءةُ حدَّها').toBeLessThanOrEqual(64)
  })
})

describe('والجمعُ بصاحبه: أحدثُها رأسا وما قبله تحته', () => {
  it('ثلاثةُ عقودٍ لمدرّبٍ واحدٍ تصير مجموعةً واحدة', () => {
    const rows = [
      { id: 'c3', replacesContractId: null, who: 'p1' },
      { id: 'c2', replacesContractId: null, who: 'p1' },
      { id: 'c1', replacesContractId: null, who: 'p1' },
    ]
    const g = groupContracts(rows, (r) => r.who)
    expect(g.length, 'لم تُجمَع عقودُ المدرّب الواحد').toBe(1)
    expect(g[0].head.id, 'الرأسُ ليس أوّلَ ما ورد').toBe('c3')
    expect(g[0].past.map((p) => p.id)).toEqual(['c2', 'c1'])
  })

  it('والرأسُ أوّلُ ما ورد — فترتيبُ الخادم هو الحاكم', () => {
    /* القائمةُ تصل مرتَّبةً بالأحدث. ولو أعاد الجمعُ ترتيبَها لَخالفت
       الشاشةُ ما رتّبه من رتّبه، ولَصار الرأسُ عقدا مضى. */
    const rows = [
      { id: 'old', replacesContractId: null, who: 'p1' },
      { id: 'new', replacesContractId: null, who: 'p1' },
    ]
    expect(groupContracts(rows, (r) => r.who)[0].head.id).toBe('old')
  })

  it('ومدرّبان لا يُجمعان', () => {
    const rows = [
      { id: 'a1', replacesContractId: null, who: 'p1' },
      { id: 'b1', replacesContractId: null, who: 'p2' },
      { id: 'a2', replacesContractId: null, who: 'p1' },
    ]
    const g = groupContracts(rows, (r) => r.who)
    expect(g.length).toBe(2)
    expect(g[0].head.id).toBe('a1')
    expect(g[0].past.map((p) => p.id)).toEqual(['a2'])
    expect(g[1].head.id).toBe('b1')
    expect(g[1].past).toEqual([])
  })

  it('ومن لا صاحبَ له يقف وحدَه ولا يُكوَّم مع أمثاله', () => {
    /* عقدان بلا مدرّبٍ ليسا عقدَي مدرّبٍ واحد. ولو جُمعا بمفتاحٍ فارغٍ
       لَطُوي أحدُهما تحت الآخر وغاب عن القائمة. */
    const rows = [
      { id: 'x', replacesContractId: null, who: null },
      { id: 'y', replacesContractId: null, who: null },
    ]
    const g = groupContracts(rows, (r) => r.who)
    expect(g.length, 'كُوِّم عقدان بلا صاحبٍ في مجموعةٍ واحدة').toBe(2)
    expect(g.every((one) => one.past.length === 0)).toBe(true)
  })

  it('ولا يضيع صفٌّ في الجمع — مجموعُ الرؤوس وما تحتها هو المُدخَل', () => {
    const rows = [
      { id: 'a', replacesContractId: null, who: 'p1' },
      { id: 'b', replacesContractId: null, who: null },
      { id: 'c', replacesContractId: null, who: 'p1' },
      { id: 'd', replacesContractId: null, who: 'p2' },
    ]
    const g = groupContracts(rows, (r) => r.who)
    const seen = g.flatMap((one) => [one.head.id, ...one.past.map((p) => p.id)])
    expect(seen.sort(), 'ضاع صفٌّ في الجمع أو تكرّر').toEqual(['a', 'b', 'c', 'd'])
  })
})
