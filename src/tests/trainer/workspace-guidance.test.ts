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

/** نصُّ خطوةٍ بعينها: من شرطِ تصييرها إلى شرطِ التي تليها */
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
    for (const key of ['identity', 'modules', 'resources', 'sessions', 'assignments', 'approval']) {
      expect(block, `لا رأسَ للخطوة ${key}`).toMatch(new RegExp(`${key}:\\s*\\{`))
    }
    /* الغرضُ والوقتُ كلاهما — ورأسٌ بلا وقتٍ لا يجيب «أأبدأ الآن؟».
       والعدُّ على القيمةِ المكتوبة (`purpose: "…"`) لا على المفتاح، وإلّا
       عُدّ سطرُ النوع فوقها معها. */
    expect((block.match(/purpose: "/g) ?? []).length).toBe(6)
    expect((block.match(/minutes: "/g) ?? []).length).toBe(6)
  })

  it('وكلُّ خطوةٍ تُصيّر رأسَها لا عنوانا مكتوبا بيدها', () => {
    for (const s of ['identity', 'modules', 'resources', 'assignments', 'approval']) {
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
    const { all, hinted } = everyFieldHinted(stageBlock(ws, 'modules', 'resources'))
    expect(all, 'لا حقولَ موصوفةً أصلا').toBeGreaterThanOrEqual(5)
    expect(hinted, `${all - hinted} حقلا بلا تلميح`).toBe(all)
  })

  it('وكلُّ حقلٍ في «الاسم والمواعيد» كذلك', () => {
    const { all, hinted } = everyFieldHinted(stageBlock(ws, 'identity', 'modules'))
    expect(all, 'لا حقولَ موصوفةً أصلا').toBeGreaterThanOrEqual(9)
    expect(hinted, `${all - hinted} حقلا بلا تلميح`).toBe(all)
  })

  it('ولا يبقى في الخطوتين حقلٌ بالصيغة القديمة — عنوانٌ عارٍ بلا تلميح', () => {
    /* الصيغةُ القديمة: `<span className="mb-1.5 block text-read font-bold …">`
       تحت `<label>` — عنوانٌ بلا موضعٍ للشرح. ووجودُها يعني حقلا أُفلت. */
    for (const [a, b] of [['identity', 'modules'], ['modules', 'resources']] as const) {
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

  it('وصفُ الشعبة في «الاسم والمواعيد» لا في «المحاور»', () => {
    expect(stageBlock(ws, 'identity', 'modules'), 'الوصفُ ليس في الخطوة الأولى').toContain('content.summaryAr')
    expect(stageBlock(ws, 'modules', 'resources'), 'الوصفُ ما زال في «المحاور»').not.toContain('summaryAr')
  })

  it('وملاحظةُ اللقاءات في «اللقاءات» لا في «المحاور»', () => {
    expect(stageBlock(ws, 'sessions', 'assignments'), 'الملاحظةُ ليست في «اللقاءات»').toContain('content.liveNoteAr')
    expect(stageBlock(ws, 'modules', 'resources'), 'الملاحظةُ ما زالت في «المحاور»').not.toContain('liveNoteAr')
  })

  it('وحفظُ الخطوة الأولى يحفظ الخطّةَ معها — وإلّا ضاع الوصفُ صامتا', () => {
    /* الوصفُ في الخطّة لا في الشعبة، وزرُّ الخطوة الأولى كان يُرسل الشعبةَ
       وحدَها. فلو لم يُرسَل الاثنان لكتب المدرّبُ وصفا ورآه يختفي. */
    const fn = ws.slice(ws.indexOf('const saveIdentity'), ws.indexOf('const submit'))
    expect(fn, 'الخطّةُ لا تُحفظ مع بيانات الشعبة').toContain('/plan`, content)')
    expect(fn).toContain('apiPatch(')
  })

  it('وبصمةُ «لم يُحفَظ» تتبع الحقلَ إلى موضعه الجديد', () => {
    expect(ws, 'بصمةُ الخطوة الأولى لا تشمل الوصف').toMatch(/identity: JSON\.stringify\(identity\) \+ summaryKey\(content\)/)
    expect(ws, 'لا بصمةَ لخطوة اللقاءات').toMatch(/sessions: liveNoteKey\(content\)/)
    /* وبصمةُ المحاور تخلّصت منهما معا */
    expect(ws).toMatch(/const modulesKey = \(c: PlanContent\) => JSON\.stringify\(c\.modules\)/)
  })
})

describe('المحورُ يُطوى فلا تصير الخطوةُ جدارا', () => {
  const ws = code(WS)

  it('واحدٌ مفتوحٌ في كلّ مرّة، وحالتُه معلَنةٌ لقارئ الشاشة', () => {
    expect(ws).toMatch(/const \[openModule, setOpenModule\]/)
    const block = stageBlock(ws, 'modules', 'resources')
    /* والفتحُ **مشتقٌّ من الحالة** لا ثابتا: `const open = true` يُبقي
       العلامةَ والشرطَ في مكانهما ويُلغي الطيَّ — فالفحصُ على الاشتقاق. */
    expect(block, 'الفتحُ غيرُ مشتقٍّ من المحور المفتوح').toMatch(/const open = openModule === m\.moduleId/)
    expect(block, 'لا طيَّ للمحور').toContain('aria-expanded={open}')
    expect(block, 'الحقولُ تُصيَّر مطويّةً كانت أو مفتوحة').toContain('{open && (')
  })

  it('والمحورُ المضافُ يُفتح فورا — وإلّا أُضيف ولا يُرى', () => {
    const block = stageBlock(ws, 'modules', 'resources')
    expect(block).toMatch(/setOpenModule\(moduleId\)/)
  })

  it('والمطويُّ يقول ما ينقصه لا يسكت', () => {
    const block = stageBlock(ws, 'modules', 'resources')
    expect(block).toContain('ينقصه العنوانُ أو المخرَج')
  })
})
