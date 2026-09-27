/* الشاشةُ دليلُ عملٍ لا نموذجُ إدخال.

   كان المدرّبُ يفتح الخطوةَ فيجد حقولا عاريةً لا يصفها إلّا نصُّها البديل
   (`placeholder`) — وهو يختفي بأوّل حرفٍ يكتبه. فبعد ملءِ ثلاثةٍ من خمسةٍ
   لا يعرف أيُّها أيّ. وقالها صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «غير مصمّمة
   باحترافيّة… اكتب له شرحا لكلّ خانة».

   وكانت خطوةُ «المحاور» تحمل حقلين ليسا منها: وصفَ الشعبة (وهو تعريفُها،
   موضعُه الخطوةُ الأولى) وملاحظةَ اللقاءات (موضعُها خطوةُ اللقاءات). فاسمُ
   الخطوة يناقض ما فيها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const raw = (p: string) => readFileSync(join(root, p), 'utf8')
/* بلا تعليقات — كي لا يمرّ حارسٌ بذكرِ الكلمة في شرحٍ فوقها */
const code = (p: string) => raw(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = 'src/pages/trainer/CohortWorkspace.tsx'
const KIT = 'src/components/FormKit.tsx'

/* ═══ ولوحةُ الهُويّة عادت درجةً أولى (٢٧ سبتمبر ٢٠٢٦) ═══

   كانت قد انطوت إلى بابٍ بقلمٍ في اسم الشعبة (ق٧ · ١٧ سبتمبر ٢٠٢٦)، فكان
   المقتطَعُ هنا من ذلك الباب. ثمّ عادت درجةً بقرار صاحب المنصّة وفيها
   المدّة، فصار المقتطَعُ من شرط خطوتها كسائر الخطوات. والمحروسُ لم يتبدّل:
   **ما بقي مشروحٌ كلُّه**. */

/** نصُّ درجةٍ بعينها من السلّم — من شرطها إلى شرط التي تليها */
function stageBlock(src: string, stage: string, nextStage: string): string {
  const from = src.indexOf(`stage === "${stage}" &&`)
  const to = src.indexOf(`stage === "${nextStage}" &&`)
  expect(from, `لا خطوةَ ${stage}`).toBeGreaterThan(-1)
  expect(to, `لا خطوةَ ${nextStage}`).toBeGreaterThan(from)
  return src.slice(from, to)
}

describe('لكلّ خطوةٍ رأسٌ يقول ما هي وكم تأخذ', () => {
  const ws = code(WS)

  it('الخطواتُ الستُّ كلُّها في معجم الرؤوس — بغرضٍ ووقت', () => {
    const block = ws.slice(ws.indexOf('const STAGE_INTRO'), ws.indexOf('function StageIntro'))
    /* و«الكرّاسات» حلّت محلَّ «المصادر» (٢٧ سبتمبر ٢٠٢٦) — والمصادرُ صارت مع المهامّ */
    for (const key of ['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'approval']) {
      expect(block, `لا رأسَ للخطوة ${key}`).toMatch(new RegExp(`${key}:\\s*\\{`))
    }
    /* الغرضُ والوقتُ كلاهما — ورأسٌ بلا وقتٍ لا يجيب «أأبدأ الآن؟».
       والعدُّ على القيمةِ المكتوبة (`purpose: "…"`) لا على المفتاح، وإلّا
       عُدّ سطرُ النوع فوقها معها. */
    expect((block.match(/purpose: "/g) ?? []).length).toBe(6)
    expect((block.match(/minutes: "/g) ?? []).length).toBe(6)
  })

  it('وكلُّ خطوةٍ تُصيّر رأسَها لا عنوانا مكتوبا بيدها', () => {
    /* وبابُ الهُويّة يحمل رأسَه كذلك وإن لم يكن درجةً — فالمُقتطَعُ من
       السلّم لا يُقتطَع من الشرح. */
    for (const s of ['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'approval']) {
      expect(ws, `الخطوة ${s} بلا رأس`).toContain(`<StageIntro stage="${s}" />`)
    }
  })
})

describe('الحقلُ يُشرَح لا يُترك لنصِّه البديل', () => {
  const ws = code(WS)

  /* والفحصُ ليس «كم حقلا مشروحا» بل **ألّا يبقى حقلٌ بلا شرح**: عتبةٌ
     كـ«خمسةٌ فأكثر» تمرّ وإن نُزع شرحُ حقلٍ ما دام السادسُ قائما. */
  const everyFieldHinted = (block: string) => {
    const all = (block.match(/<StaffField\b/g) ?? []).length
    const hinted = (block.match(/<StaffField[^>]*\shint="/g) ?? []).length
    return { all, hinted }
  }

  it('كلُّ حقلٍ في «المحاور» مشروحٌ — لا واحدَ بلا تلميح', () => {
    const { all, hinted } = everyFieldHinted(stageBlock(ws, 'modules', 'workbooks'))
    expect(all, 'لا حقولَ موصوفةً أصلا').toBeGreaterThanOrEqual(5)
    expect(hinted, `${all - hinted} حقلا بلا تلميح`).toBe(all)
  })

  it('وكلُّ حقلٍ في «الاسمُ والنبذة» كذلك', () => {
    const { all, hinted } = everyFieldHinted(stageBlock(ws, 'identity', 'modules'))
    /* كانت الأرضيّةُ تسعةً حين كان في الخطوة عشرةُ حقول. ثمّ خرج منها حقلا
       «اقتراحٌ للإدارة» إلى ملفّهما (د-٦)، فصارت ثمانيةً — والأرضيّةُ سنَدُ
       المحلِّل لا المحروس: المحروسُ `hinted === all`. ولئلّا تنقص التغطيةُ
       بخروجهما يتبعهما الفحصُ إلى ملفّهما في الاختبار الذي يليه.

       ثمّ شُطبت الخطوةُ إلى ثلاثة (١٥ سبتمبر ٢٠٢٦): فصلٌ واسمٌ ونبذة. ستّةُ
       حقولٍ — البدءُ والانتهاءُ وأيّامُ الأسبوع وساعةُ البدء ونمطُ التقديم
       ولغةُ التدريب — لم تُخفَ بل زال موجِبُها: حدودُ الشعبة صارت حدودَ
       فصلِها، ومواعيدُ اللقاءات تُحدَّد لقاءً لقاءً في خطوتها.

       ثمّ خرج الفصلُ نفسُه (١٧ سبتمبر ٢٠٢٦): صار حقيقةً تسمّيها الإدارةُ عند
       الإسناد لا سؤالا يُسأل، فصار في موضعه لافتةٌ تُقرأ — لا حقلٌ يُملأ.
       فبقي في يده اثنان: اسمُها ونبذتُها.

       والأرضيّةُ سنَدُ المحلِّل لا المحروس: تمنع أن يخضرّ الفحصُ لأنّ الحقولَ
       زالت كلُّها. والمحروسُ لم يتبدّل منذ كُتب: ما بقي مشروحٌ كلُّه. */
    expect(all, 'لا حقولَ موصوفةً أصلا').toBeGreaterThanOrEqual(2)
    expect(hinted, `${all - hinted} حقلا بلا تلميح`).toBe(all)
  })

  /* وكان هنا فحصُ حقلَي اقتراحِ اسمِ الدورة: خرجا من الخطوة الأولى إلى
     ملفّهما (د-٦) فتبِعهما الفحصُ إليه، ثمّ أُغلق بابُ الاقتراح كلُّه
     (ق٥ · ١٧ سبتمبر ٢٠٢٦) فزال الملفُّ وحقلاه. ويحرس إغلاقَه
     `cohort-proposals` بنيويّا — لا ملفٌّ هنا يُفحَص. */

  it('ولا يبقى في الخطوتين حقلٌ بالصيغة القديمة — عنوانٌ عارٍ بلا تلميح', () => {
    /* الصيغةُ القديمة: `<span className="mb-1.5 block text-read font-bold …">`
       تحت `<label>` — عنوانٌ بلا موضعٍ للشرح. ووجودُها يعني حقلا أُفلت. */
    for (const [a, b] of [['identity', 'modules'], ['modules', 'workbooks'], ['workbooks', 'sessions']] as const) {
      expect(stageBlock(ws, a, b), `حقلٌ بالصيغة القديمة في ${a}`).not.toMatch(/mb-1\.5 block text-read font-bold/)
    }
  })

  it('و`StaffField` تعرض التلميحَ بحجم المتن لا بحجم اللصيقة', () => {
    const kit = code(KIT)
    const fn = kit.slice(kit.indexOf('export function StaffField'))
    expect(fn.slice(0, 900)).toMatch(/hint &&[\s\S]{0,120}text-read/)
  })
})

describe('الحقلُ في الخطوة التي يخصّها', () => {
  const ws = code(WS)

  it('وصفُ الشعبة مع اسمها في بابهما — لا في «المحاور»', () => {
    expect(stageBlock(ws, 'identity', 'modules'), 'الوصفُ ليس مع الاسم في بابه').toContain('content.summaryAr')
    expect(stageBlock(ws, 'modules', 'workbooks'), 'الوصفُ ما زال في «المحاور»').not.toContain('summaryAr')
  })

  /* ═══ ونُقضت ملاحظةُ الشعبة كلِّها بقرار (١٥ سبتمبر ٢٠٢٦) ═══

     كان هنا: ملاحظةُ اللقاءات (`content.liveNoteAr`) حقلٌ واحدٌ في خطوة
     «اللقاءات» يصف أسلوبَ لقاءات الشعبة جميعا. وقال صاحبُ المنصّة: «لا
     داعيَ لوجود ملاحظاتٌ عن اللقاءات المباشرة (اختياريّ) بالأسفل» — وصارت
     **لكلّ لقاءٍ على حدة** في نموذج إنشائه (`noteAr` على `CohortSession`).

     وملاحظةٌ واحدةٌ عن عشرة لقاءاتٍ تُكتب عامّةً فلا تقول شيئا عن أيٍّ
     منها؛ ومن أراد «هذا اللقاء يُسجَّل وذاك لا» لم يملك أين يقوله.

     والمحروسُ لم يتبدّل — **الحقلُ في الخطوة التي يخصّها**: لا يعود إلى
     «المحاور» ولا يبقى واحدا للشعبة، ويسكن حيث يُنشأ اللقاء. */
  it('⚠️ وملاحظةُ اللقاء صارت لكلّ لقاءٍ — لا واحدةً للشعبة كلِّها', () => {
    expect(ws, 'عادت ملاحظةٌ واحدةٌ للشعبة في الشاشة').not.toContain('content.liveNoteAr')
    expect(stageBlock(ws, 'modules', 'workbooks'), 'الملاحظةُ عادت إلى «المحاور»').not.toContain('liveNoteAr')
    /* وموضعُها الجديدُ نموذجُ إنشاء اللقاء — تُرسَل مع اللقاء نفسِه */
    const sched = code('src/pages/trainer/TrainerSchedule.tsx')
    expect(sched, 'لا ملاحظةَ في نموذج اللقاء').toContain('ملاحظاتٌ عن اللقاء (اختياريّ)')
    expect(sched, 'الملاحظةُ لا تُرسَل مع اللقاء').toMatch(/noteAr: form\.noteAr\.trim\(\) \|\| null/)
  })

  it('وحفظُ الخطوة الأولى يحفظ الخطّةَ معها — وإلّا ضاع الوصفُ صامتا', () => {
    /* الوصفُ والمدّةُ في الخطّة لا في الشعبة، والاسمُ في الشعبة. وكان زرُّ
       الخطوة الأولى يُرسل الشعبةَ وحدَها، فلو لم يُرسَل الاثنان لكتب المدرّبُ
       وصفا ورآه يختفي. وصار الحفظُ واحدا لكلّ الخطوات (`persist`، ٢٧ سبتمبر
       ٢٠٢٦) — فيُفحص أنّه يحمل الاثنين. */
    const fn = ws.slice(ws.indexOf('const persist'), ws.indexOf('const gapsFor'))
    expect(fn, 'لا حفظَ واحدا يحفظ ما في اليد').toBeTruthy()
    expect(fn, 'الخطّةُ لا تُحفظ مع بيانات الشعبة').toContain('/plan`, content)')
    expect(fn).toContain('apiPatch(')
  })

  it('وبصمةُ «لم يُحفَظ» تتبع الحقلَ إلى موضعه الجديد', () => {
    expect(ws, 'بصمةُ الخطوة الأولى لا تشمل الوصفَ والمدّة').toMatch(/identity: JSON\.stringify\(identity\) \+ basicsKey\(content\)/)
    /* والمدّةُ في البصمة (٢٧ سبتمبر ٢٠٢٦): من غيّر تاريخا ولم يحفظ يُعلَّم */
    const key = ws.slice(ws.indexOf('const basicsKey'), ws.indexOf('const basicsKey') + 160)
    expect(key, 'تاريخُ البدء خارجَ البصمة').toContain('c.startsOn')
    expect(key, 'تاريخُ الانتهاء خارجَ البصمة').toContain('c.endsOn')
    /* ═══ ثمّ عادت للّقاءات بصمةٌ — بحقلٍ حقيقيٍّ هذه المرّة (٢٧ سبتمبر ٢٠٢٦) ═══

       كانت `false` صراحةً: حقلُها الوحيدُ (`liveNoteAr`) ذهب إلى كلّ لقاءٍ على
       حدة. ثمّ صارت الجلساتُ المسجّلةُ في خطوة اللقاءات — «لا بأس أن جمعت
       بين المسجّلة والمباشرة» — وهي في الخطّة تُحفظ بزرّ الشريط. فبصمتُها
       المسجَّلُ من المصادر، لا الملاحظةُ التي ذهبت. والمحروسُ الأصليُّ باقٍ:
       لا مسودّةَ لحقلٍ لا وجودَ له في الخطوة. */
    expect(ws, 'بصمةُ اللقاءات لا تقرأ المسجَّل').toMatch(/sessions: recordedKey\(content\) !== baseline\.recorded,/)
    expect(ws, 'عادت الملاحظةُ الواحدةُ إلى بصمة اللقاءات').not.toMatch(/sessions: [^\n]*liveNoteAr/)
    /* وبصمةُ المحاور تخلّصت من الوصف والملاحظة معا — وصارت تحمل مواعيدَها
       بلا كرّاساتها: الكرّاسةُ تُحرَّر في درجتها وتُعلَّم هناك */
    const mk = ws.slice(ws.indexOf('const modulesKey'), ws.indexOf('const workbooksKey'))
    expect(mk, 'بصمةُ المحاور لا تحمل المحاور').toContain('modules: c.modules')
    expect(mk, 'بصمةُ المحاور لا تحمل مواعيدَها').toContain('slots:')
    expect(mk, 'الكرّاسةُ في بصمة المحاور').not.toContain('workbook')
    expect(mk, 'الوصفُ عاد إلى بصمة المحاور').not.toMatch(/summaryAr|liveNoteAr/)
  })
})

describe('المحورُ يُطوى فلا تصير الخطوةُ جدارا', () => {
  const ws = code(WS)

  it('واحدٌ مفتوحٌ في كلّ مرّة، وحالتُه معلَنةٌ لقارئ الشاشة', () => {
    expect(ws).toMatch(/const \[openModule, setOpenModule\]/)
    const block = stageBlock(ws, 'modules', 'workbooks')
    /* والفتحُ **مشتقٌّ من الحالة** لا ثابتا: `const open = true` يُبقي
       العلامةَ والشرطَ في مكانهما ويُلغي الطيَّ — فالفحصُ على الاشتقاق. */
    expect(block, 'الفتحُ غيرُ مشتقٍّ من المحور المفتوح').toMatch(/const open = openModule === m\.moduleId/)
    expect(block, 'لا طيَّ للمحور').toContain('aria-expanded={open}')
    expect(block, 'الحقولُ تُصيَّر مطويّةً كانت أو مفتوحة').toContain('{open && (')
  })

  it('والمحورُ المضافُ يُفتح فورا — وإلّا أُضيف ولا يُرى', () => {
    const block = stageBlock(ws, 'modules', 'workbooks')
    expect(block).toMatch(/setOpenModule\(moduleId\)/)
  })

  it('والمطويُّ يقول ما ينقصه لا يسكت', () => {
    const block = stageBlock(ws, 'modules', 'workbooks')
    expect(block).toContain('ينقصه العنوانُ أو المخرَج')
  })
})
