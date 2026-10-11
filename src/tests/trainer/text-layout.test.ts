/* النصُّ الطويلُ مرتّبا — لا جريدةً مكتظّة (١١ أكتوبر ٢٠٢٦، `text-layout.ts` و`LongText.tsx`).

   قرارُ صاحب المنصّة: «لماذا النصوصُ تبدو جريدةً مكتظّة… اختر تصميما بسيطا لا يغيّر مسارَ العمل، بل
   يحسّن الشكلَ فقط. والملاحظاتُ أيضا مكتظّةٌ جدّا».

   ① التعليماتُ: خطواتٌ مرقّمة، وحقولٌ بأسمائها، وجدولُ مستويات — والفقرةُ كما كُتبت.
   ② ولا يضيع منها حرف: كلُّ ما كُتب يُعرض.
   ③ والنواقصُ محورا محورا، و«كيف تُصلحه» مرّةً واحدة — وما ليس قائمةً يبقى نصّا.
   ④ والشاشاتُ الأربعُ تعرض التعليماتِ بها، وملاحظةُ الخطوة وبندُها في «المراجعة» كذلك. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { briefBlocks, briefHasLayout, gapLayout, type BriefBlock } from '@/application/trainer/text-layout'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/* تعليماتُ مشروع التخرّج كما في لقطة صاحب المنصّة */
const BRIEF = [
  '١) يُلقي الطفل خطابه الختامي أمام العائلة وفق النموذج الخماسي: افتتاح مؤثر — إغلاق قيادي.',
  '٢) صوّر الخطاب كاملًا.',
  '٣) قيّمه بورقة التقييم الختامية (10 معايير × 5 درجات = 50).',
  'المُسلَّم: رابط فيديو الخطاب + ورقة التقييم + صفحة المقارنة والتأمل.',
  'التقييم: اكتمال البنية الخماسية، ودقة استخدام ورقة التقييم.',
  'ويمكنك أن ترفع فيديو الخطاب ملفا مع المهمة أو تضع رابطه.',
  '',
  'مستويات معايير التقييم الثلاثة:',
  'اكتمال البنية الخماسية. المستوى 3: المراحل الخمس ظاهرة بالترتيب. المستوى 2: ثلاث أو أربع مراحل. المستوى 1: أقل من ثلاث.',
  'عمق المقارنة. المستوى 3: صفحة تسمي ثلاثة أشياء تطورت.',
  'المستوى 2: الأشياء الثلاثة عامة، مثل «صار أجرأ». المستوى 1: لا مقارنة.',
].join('\n')

describe('① التعليماتُ مرتّبة', () => {
  it('⚠️ الخطواتُ المرقّمةُ قائمةٌ مرقّمة — بلا أرقامها المكتوبة', () => {
    const steps = briefBlocks(BRIEF).find((b) => b.kind === 'steps')
    expect(steps).toEqual({ kind: 'steps', items: [
      'يُلقي الطفل خطابه الختامي أمام العائلة وفق النموذج الخماسي: افتتاح مؤثر — إغلاق قيادي.',
      'صوّر الخطاب كاملًا.',
      'قيّمه بورقة التقييم الختامية (10 معايير × 5 درجات = 50).',
    ] })
    expect(briefBlocks('1. اقرأ\n2) اكتب').at(0)).toEqual({ kind: 'steps', items: ['اقرأ', 'اكتب'] })
  })

  it('⚠️ و«المُسلَّم:» و«التقييم:» حقلان بأسمائهما — والفقرةُ بعدهما فقرة', () => {
    const b = briefBlocks(BRIEF)
    expect(b.filter((x) => x.kind === 'field')).toEqual([
      { kind: 'field', labelAr: 'المُسلَّم', textAr: 'رابط فيديو الخطاب + ورقة التقييم + صفحة المقارنة والتأمل.' },
      { kind: 'field', labelAr: 'التقييم', textAr: 'اكتمال البنية الخماسية، ودقة استخدام ورقة التقييم.' },
    ])
    expect(b.find((x) => x.kind === 'text')).toEqual({ kind: 'text', textAr: 'ويمكنك أن ترفع فيديو الخطاب ملفا مع المهمة أو تضع رابطه.' })
  })

  it('⚠️ والمستوياتُ جدول: كلُّ معيارٍ بمستوياته — والسطرُ الذي يبدأ بـ«المستوى» يكمل معيارَه', () => {
    const rubric = briefBlocks(BRIEF).find((b) => b.kind === 'rubric')
    expect(rubric).toEqual({
      kind: 'rubric', titleAr: 'مستويات معايير التقييم الثلاثة',
      rows: [
        { criterionAr: 'اكتمال البنية الخماسية', levels: [
          { level: '3', textAr: 'المراحل الخمس ظاهرة بالترتيب.' }, { level: '2', textAr: 'ثلاث أو أربع مراحل.' }, { level: '1', textAr: 'أقل من ثلاث.' },
        ] },
        { criterionAr: 'عمق المقارنة', levels: [
          { level: '3', textAr: 'صفحة تسمي ثلاثة أشياء تطورت.' }, { level: '2', textAr: 'الأشياء الثلاثة عامة، مثل «صار أجرأ».' }, { level: '1', textAr: 'لا مقارنة.' },
        ] },
      ],
    })
  })

  it('وفقرةٌ بلا شيءٍ يُرتَّب تبقى فقرةً كما كُتبت — وسطرٌ فيه نقطتان بعد كلامٍ طويلٍ لا يصير حقلا', () => {
    const b = briefBlocks('اكتب صفحةً عن جمهورك.\nثمّ أرسلها.')
    expect(b).toEqual([{ kind: 'text', textAr: 'اكتب صفحةً عن جمهورك.\nثمّ أرسلها.' }])
    expect(briefHasLayout(b)).toBe(false)
    expect(briefBlocks('في هذه المهمّة ستكتب رسالةً قصيرةً لعميلٍ غاضب: ابدأ بالاعتذار')[0]!.kind).toBe('text')
    /* وجملةٌ قصيرةٌ من ستّ كلمات قبل النقطتين جملةٌ لا اسمُ حقل */
    expect(briefBlocks('اكتب لنا في سطرٍ واحدٍ فقط: لماذا اخترتها')[0]!.kind).toBe('text')
  })
})

describe('② ولا يضيع حرف', () => {
  it('⚠️ كلُّ ما كُتب في التعليمات يُعرض — بعد رفع أرقام الخطوات ونقطتي العناوين وحدَها', () => {
    const shown = (b: BriefBlock): string => b.kind === 'steps' ? b.items.join(' ')
      : b.kind === 'field' ? `${b.labelAr} ${b.textAr}`
      : b.kind === 'rubric' ? `${b.titleAr ?? ''} ${b.rows.map((r) => `${r.criterionAr} ${r.levels.map((l) => `${l.level} ${l.textAr}`).join(' ')}`).join(' ')}`
      : b.textAr
    const words = (s: string) => s.replace(/^[١-٩0-9]+\)\s*/gm, '').replace(/المستوى/g, '').split(/[\s:.]+/).filter(Boolean)
    const all = briefBlocks(BRIEF).map(shown).join(' ')
    for (const w of words(BRIEF)) expect(all, `ضاعت «${w}»`).toContain(w)
  })
})

describe('③ النواقصُ محورا محورا', () => {
  it('⚠️ كلُّ محورٍ بنواقصه، و«كيف تُصلحه» مرّةً واحدةً لا مع كلّ محور', () => {
    const now = 'المحور 1: 152 كلمةً — اشرح الفكرةَ في 250 كلمةً على الأقلّ؛ المحور 1: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ؛ '
      + 'المحور 2: 135 كلمةً — اشرح الفكرةَ في 250 كلمةً على الأقلّ؛ المحور 2: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ'
    expect(gapLayout(now)).toEqual({
      groups: [
        { whereAr: 'المحور 1', issuesAr: ['152 كلمةً', 'بلا مثالٍ محلول'] },
        { whereAr: 'المحور 2', issuesAr: ['135 كلمةً', 'بلا مثالٍ محلول'] },
      ],
      fixesAr: ['اشرح الفكرةَ في 250 كلمةً على الأقلّ', 'أضف حالةً من سوقٍ عربيّ'],
    })
  })

  it('⚠️ ونقطتا الساعة لا تفصلان — «الأربعاء… 6:00 م: بعد يومين»', () => {
    expect(gapLayout('الأربعاء، 2 ديسمبر في 6:00 م: بعد يومين من سابقه؛ الخميس، 3 ديسمبر في 6:00 م: بعد يوم من سابقه')?.groups.map((g) => g.whereAr))
      .toEqual(['الأربعاء، 2 ديسمبر في 6:00 م', 'الخميس، 3 ديسمبر في 6:00 م'])
  })

  it('وما ليس قائمةً يبقى نصّا — بندٌ واحد، أو بندٌ بلا اسمٍ قبل النقطتين', () => {
    expect(gapLayout('المحاور 1–8: بلا مُسلَّم')).toBeNull()
    expect(gapLayout('مصادرُ الشعبة: 0؛ وأمرٌ آخرُ بلا اسم')).toBeNull()
  })
})

describe('④ والشاشاتُ تعرضها مرتّبة', () => {
  it('⚠️ التعليماتُ في شاشة المدرّب، وطابور المهامّ، ومنهج المراجِع، وشاشة المتعلّم — بـ`BriefView`', () => {
    expect(code('src/pages/trainer/CohortWorkspace.tsx')).toMatch(/\? <BriefView text=\{a\.briefAr\} muted/)
    expect(code('src/components/PendingTasks.tsx')).toMatch(/<BriefView text=\{formatTaskValue\('briefAr', live\.briefAr, fmt\)\}/)
    expect(code('src/components/CurriculumReview.tsx')).toMatch(/\? <BriefView text=\{t\.briefAr\} muted/)
    expect(code('src/components/journey/StageWork.tsx')).toMatch(/\{a\.briefAr && <BriefView text=\{a\.briefAr\}/)
  })

  it('⚠️ وملاحظةُ الخطوة نقطةً نقطة — والنواقصُ فيها بـ`GapList`', () => {
    expect(code('src/components/ReviewNotes.tsx')).toMatch(/<NoteBody text=\{text\} \/>/)
    const body = code('src/components/LongText.tsx')
    expect(body).toMatch(/const points = notePoints\(text\);/)
    expect(body).toMatch(/const gaps = p\.nowAr \? gapLayout\(p\.nowAr\) : null;/)
    expect(body).toMatch(/\? <GapList layout=\{gaps\} \/>/)
  })
})
