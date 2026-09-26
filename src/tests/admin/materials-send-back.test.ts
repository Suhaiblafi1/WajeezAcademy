/* «أعِدِ الموادَّ بملاحظات» — قرارٌ مبنيٌّ كان بلا شاشة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * ثلاثةُ أشياءَ اجتمعت فصارت مصيدةً:
 *
 * ① `returnMaterialsWithNotes` مبنيّةٌ ولها مسارٌ محروس — **ولا شاشةَ
 *    تنادِيها**. وهي المسلكُ الوحيدُ الذي يرفع التجميدَ عن مهلة المدرّب.
 * ② قائمةُ العقود لم تكن تجلب أعمدةَ الشرط أصلا، فالطابورُ أعمى: يرى صفّا
 *    حالُه `signed` ولا شيءَ يقول إنّ موادَّ إنسانٍ عنده للتقييم منذ أسبوع.
 * ③ والعاملان (التذكيرُ ووسمُ التأخّر) يشترطان `conditionPausedAt: null`،
 *    فيتخطّيان المجمَّد — فلا جرسَ يُقرَع.
 *
 * فمن أعلن اكتمالَ موادّه ونقَصَ فيها شيءٌ بقي معلَّقا أبدا، والمخرجان
 * المتاحان «اعتمِدْ» (فيُعتمَد ما لم يُعتمَد) أو «ألغِ العقد» (فيُلغى عقدٌ
 * وقّعه) — وكلاهما جوابٌ عن سؤالٍ آخر.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  conditionPhase, CONDITION_PHASE_LABELS_AR,
} from '@/application/trainer/conditional-offer'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = 'src/pages/admin/TrainerContracts.tsx'
const SVC = 'server/services/trainer-review.service.ts'
const ROUTES = 'server/http/routes/admin-trainer.routes.ts'

/** جسمُ دالّةٍ بعينها لا إلى آخر الملفّ */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`async ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\n  async ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('القرارُ المبنيُّ تبلغه شاشة', () => {
  /* ═══ وهذا هو الفحصُ الذي كان غائبا ═══

     المسارُ موجودٌ محروسٌ مختبَرٌ بقاعدةٍ حقيقيّة، ولا شيءَ كان يقيس أنّ
     إنسانا يبلغه. فيُقاس على **الاستدعاء** لا على وجود المسار. */
  it('شاشةُ العقود تنادي مسارَ إعادة الموادّ', () => {
    expect(bare(SCREEN), 'المسارُ مبنيٌّ ولا شاشةَ تبلغه — وهو العطبُ بعينه')
      .toContain('/return-materials')
  })

  it('والمسارُ قائمٌ محروسٌ بصلاحيّة إدارة العقود', () => {
    const r = bare(ROUTES)
    const at = r.indexOf("'/api/admin/trainer-contracts/:contractId/return-materials'")
    expect(at, 'لا مسارَ للإعادة').toBeGreaterThan(0)
    /* والنافذةُ محدودةٌ بتسجيل المسار نفسِه لا بعددٍ من الأحرف: مسارٌ جارٌ
       يحمل الصلاحيّةَ نفسَها، فنافذةٌ واسعةٌ تخضرّ عليه. */
    const block = r.slice(at, r.indexOf('app.', at + 10))
    expect(block).toContain("requirePermission('trainer.contract.manage')")
  })

  it('وحقلُ الملاحظة لا يُرسَل أقصرَ من حدِّ الخادم', () => {
    /* الخادمُ يردّ ما دون خمسة أحرف (`no_notes`). وزرٌّ يُنقَر فيُردّ
       يُعلّم الموظّفَ أن يتجاهل الرسائل. */
    expect(bare(SVC), 'حدُّ الخادم تبدّل — فيُراجَع حدُّ الشاشة معه')
      .toContain('notes.length < 5')
    expect(bare(SCREEN), 'الشاشةُ لا تمنع ما يردُّه الخادم')
      .toContain('sendBack.notesAr.trim().length < 5')
  })

  /* ولا نصٌّ مقترَحٌ يُملأ سلفا: يصل المدرّبَ بحرفه، وعبارةٌ عامّةٌ تُرسَل
     كما هي توقف حلقةَ «يعدّل ويقدّم ثانيةً» عند أوّل دورة. */
  it('ولا تُملأ الملاحظةُ سلفا بنصٍّ عامٍّ يُرسَل كما هو', () => {
    expect(bare(SCREEN)).toContain('setSendBack({ id: c.id, notesAr: "" })')
  })

  /* ═══ وحقلانِ لا حقلٌ واحد ═══

     «اعتمِدْ» و«أعِدْها» قرارانِ متضادّان. وحقلٌ واحدٌ لهما يجعل ملاحظةَ
     الإعادة تُرسَل في خانةِ مطابقةِ الهويّة — أي تُحفَظ في `countersignNoteAr`
     بدل أن تصل المدرّب. */
  it('ونافذةُ الإعادة مستقلّةٌ عن نافذة الاعتماد', () => {
    const src = bare(SCREEN)
    expect(src).toMatch(/const \[sendBack, setSendBack\] = useState/)
    expect(src).toMatch(/const \[signOff, setSignOff\] = useState/)
  })
})

describe('والطورُ يُعرَض — فالطابورُ لم يكن يعرف أنّ للعقد طورا', () => {
  it('القائمةُ تجلب أعمدةَ الشرط', () => {
    const body = fnBody(bare(SVC), 'listContracts')
    expect(body, 'لم يُقرأ جسمُ `listContracts`').not.toBe('')
    for (const col of ['conditionPausedAt', 'conditionDeadlineAt', 'conditionMetAt']) {
      expect(body, `القائمةُ لا تجلب ${col} — فالشاشةُ عمياءُ عن الطور`).toContain(col)
    }
  })

  /* والتسميةُ من موضعها الواحد: رأسُ `conditional-offer.ts` يقول إنّ
     `CONDITION_PHASE_LABELS_AR` لـ«صفّ الطابور» كذلك — ولم تكن تصله. */
  it('والتسميةُ من مصدرها لا مكتوبةً في الشاشة', () => {
    const src = bare(SCREEN)
    expect(src).toContain('CONDITION_PHASE_LABELS_AR')
    expect(src).toContain('conditionPhase(')
    /* ولا تُنسَخ تسميةُ طورٍ حرفا في الشاشة */
    expect(src, 'نُسخت تسميةُ الطور في الشاشة — فتفترق عن مصدرها')
      .not.toContain(CONDITION_PHASE_LABELS_AR.under_review)
  })

  it('والطورُ المجمَّدُ يُقرأ `under_review` — وهو شرطُ ظهور الزرّ', () => {
    const paused = { conditionDeadlineAt: '2026-10-08T00:00:00.000Z', conditionPausedAt: '2026-10-02T00:00:00.000Z' }
    expect(conditionPhase(paused)).toBe('under_review')
    /* وغيرُ المجمَّد ليس كذلك — فلا يُعرَض له زرُّ إعادةٍ يردُّه الخادم */
    expect(conditionPhase({ conditionDeadlineAt: '2099-01-01T00:00:00.000Z' })).toBe('running')
    expect(conditionPhase({ conditionDeadlineAt: '2020-01-01T00:00:00.000Z' })).toBe('lapsed')
    expect(conditionPhase({ conditionMetAt: '2026-10-05T00:00:00.000Z' })).toBe('met')
  })

  /* وزرٌّ معطَّلٌ بلا سببٍ يُقرأ عطبا. فيُقال ما يُنتظَر بدله. */
  it('ومن لم يُعلن اكتمالَه يُقال له السببُ لا يُعرَض زرٌّ يُردّ', () => {
    expect(bare(SCREEN)).toContain('ولم يُعلن اكتمالَ موادّه بعد')
  })

  /* والمختومُ لا طورَ ينتظره — فلا لوحَ يُعرَض له */
  it('ولا يُعرَض اللوحُ لمختومٍ ولا لعقدٍ بلا شرط', () => {
    const src = bare(SCREEN)
    expect(src).toContain('c.gatesActivation')
    expect(src).toMatch(/!==\s*"met"/)
    expect(src).toMatch(/!==\s*"none"/)
  })
})
