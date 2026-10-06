/* ═══ ولا «نؤهّلك» في نصٍّ يقرؤه المدرّب — قرارُ صاحب المنصّة (٦ أكتوبر ٢٠٢٦) ═══
 *
 * قال في ٥ أكتوبر عن صفحة الدعوة: «لا تقل نؤهّلك لأنّها قد تُقرأ ندرّبك» — ومدرّبٌ
 * خبيرٌ لا يُقال له إنّه سيُؤهَّل. ويحرس ذلك هناك `trainer-brief.test.ts` (⑤). ثمّ
 * عُرض عليه ما بقي في الدليل والبوّابة والرسائل، فقال: «غيّرها لتكون مفهومةً أكثر
 * كما اتّفقنا». فصارت بلغة ما يقع: «اخترناها لك»، و«من دوراتك»، و«أُضيفت إلى
 * دوراتك».
 *
 * ── وما خرج منه، ولمَ ──
 *
 * · **الاتفاقيّة**: «التأهيل» فيها لفظٌ معرَّفٌ في بندٍ وقّعه من وقّع، وتغييرُه نسخةٌ
 *   جديدةٌ للعقد — فبقي كما اتّفقنا. ورسالةُ البند الثاني تقوله بلغة ما يقع.
 * · **شاشاتُ الإدارة**: «أهِّله» و«طلبُ التأهيل» لغةُ الفريق في عمله، لا ما يقرؤه
 *   المدرّب.
 * · **اسمُ اللسان «مؤهّلاتي»** (ومعه «مؤهّلاتك» في الأزرار): اسمُ شاشةٍ لا فعلٌ
 *   يُقال للمدرّب، وتغييرُه يمسّ الدليلَ وصورَه ورسائلَ تشير إليه — فعُرض خيارا
 *   ولم يُقرَّر بعد. فيُستثنى بعينه، ولا يُستثنى غيرُه.
 *
 * ── ويُقرأ على البنية لا على ورود حرفٍ في ملفّ ──
 *
 * تُحلَّل الشيفرةُ بمحلّل TypeScript، وتُقرأ نصوصُها وحدَها — السلاسلُ والقوالبُ
 * ونصوصُ JSX — لا التعليقات: فتعليقٌ يروي القرارَ ويذكر الكلمةَ لا يُسقطه. والنطاقُ
 * ثلاثة: ① ملفّاتٌ كلُّ نصّها للمدرّب (البوّابةُ والدليلُ ورسائلُ القرار)، ② وكلُّ
 * نداءٍ يُرسل إلى المدرّب جرسا (`notifyTrainerUser` و`notifyTrainer`) أينما كان —
 * فملفٌّ يخاطب الفريقَ والمدرّبَ معا يُقرأ منه ما للمدرّب وحدَه، ③ وخبرُ اعتماد
 * الشعبة كما يُبنى فعلا.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planApprovedTrainerMsg } from '../../application/trainer/plan-decision'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const bare = (t: string) => t.replace(/[ً-ْٰـ]/g, '')
/** الفعلُ ومصدرُه واسمُ مفعوله — بعد نزع الحركات: «نؤهّلك» «تُؤهَّل» «أُهِّلتَ»
    «تأهيلُك» «مؤهَّلا». ولا «أهلا»: «أهل» وحدَها لا تُطابَق */
const QUALIFY = /[نتيأ]ؤهل|تأهيل|مؤهل|(?<![ء-ي])أهل(?:ت|نا)/g
/** اسمُ اللسان — مستثنًى بعينه حتّى يُقرَّر فيه */
const TAB = /مؤهلات[يك](?![ء-ي])/g

const hitsOf = (text: string) => [...bare(text).replace(TAB, '').matchAll(QUALIFY)].map((m) => m[0])

const parse = (file: string, src: string) => ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
  file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

/** نصوصُ عقدةٍ وما تحتها — لا تعليقاتُها */
function textsUnder(sf: ts.SourceFile, node: ts.Node): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = []
  const visit = (n: ts.Node) => {
    let texts: string[] = []
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) texts = [n.text]
    else if (ts.isTemplateExpression(n)) texts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
    else if (ts.isJsxText(n)) texts = [n.text]
    for (const text of texts) out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
    ts.forEachChild(n, visit)
  }
  visit(node)
  return out
}

/** نصوصُ نداءات الجرس إلى المدرّب في ملفّ */
const TRAINER_NOTIFY = new Set(['notifyTrainerUser', 'notifyTrainer'])
function trainerNotifyTexts(sf: ts.SourceFile): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = []
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const callee = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text
        : ts.isIdentifier(n.expression) ? n.expression.text : ''
      if (TRAINER_NOTIFY.has(callee)) for (const a of n.arguments) out.push(...textsUnder(sf, a))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== 'tests') sources(p, acc)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) acc.push(p)
  }
  return acc
}

/** ① ما كلُّ نصّه للمدرّب */
const TRAINER_DIRS = ['src/pages/trainer', 'src/data/trainer-guide']
const TRAINER_FILES = [
  'server/services/trainer-decision-mail.ts',
  'src/application/catalog/scope-policy.ts',
  'src/application/trainer/path-rules.ts',
  'server/services/trainer-marketing.service.ts',
  'server/services/trainer-change.service.ts',
]

describe('ولا «نؤهّلك» في نصٍّ يقرؤه المدرّب', () => {
  it('الماسحُ يقرأ النصوصَ ويتجاوز التعليقات، ويستثني اسمَ اللسان وحدَه — وإلّا فالحارسُ يقيس الفراغ', () => {
    const sample = [
      '/* حين نؤهّلك في تعليقٍ يروي القرار */',
      "const a = 'وتظهر حين نؤهّلك لها'",
      'const b = `النسخة ${v} · أُهِّلت ${d}`',
      'const c = <p>لستَ مؤهَّلا لها</p>',
      "const d = 'افتح «مؤهّلاتي» — أهلا بك'",
      "notifyTrainerUser(id, { title: 'لم يُقبل تأهيلُك لدورة' })",
      "notifyStaff(id, { title: 'طلبُ تأهيل' })",
    ].join('\n')
    const sf = parse('sample.tsx', sample)
    const all = textsUnder(sf, sf).filter((t) => hitsOf(t.text).length > 0).map((t) => t.line)
    expect(all, 'الماسحُ لا يرى النصَّ، أو يرى التعليق، أو لا يستثني اللسان').toEqual([2, 3, 4, 6, 7])
    expect(trainerNotifyTexts(sf).filter((t) => hitsOf(t.text).length > 0).map((t) => t.line),
      'لا يُفرَز جرسُ المدرّب من جرس الفريق').toEqual([6])
  })

  it('① لا في البوّابة ولا الدليل ولا رسائل القرار', () => {
    const files = [...TRAINER_DIRS.flatMap((d) => sources(join(root, d))), ...TRAINER_FILES.map((f) => join(root, f))]
    expect(files.length, 'لم تُقرأ ملفّاتُ المدرّب — فالحارسُ يقيس الفراغ').toBeGreaterThan(30)
    const hits: string[] = []
    for (const file of files) {
      const sf = parse(file, readFileSync(file, 'utf8'))
      for (const t of textsUnder(sf, sf)) {
        for (const h of hitsOf(t.text)) hits.push(`${relative(root, file)}:${t.line} «${h}»`)
      }
    }
    expect(hits, `«نؤهّلك» وأخواتُها فيما يقرؤه المدرّب — قل «اخترناها لك» أو «من دوراتك»:\n${hits.join('\n')}`).toEqual([])
  })

  it('② ولا في جرسٍ يصل المدرّبَ من أيّ ملفّ', () => {
    const files = sources(join(root, 'server'))
    const hits: string[] = []
    let calls = 0
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (![...TRAINER_NOTIFY].some((n) => src.includes(n))) continue
      const texts = trainerNotifyTexts(parse(file, src))
      calls += texts.length
      for (const t of texts) for (const h of hitsOf(t.text)) hits.push(`${relative(root, file)}:${t.line} «${h}»`)
    }
    expect(calls, 'لم يُقرأ جرسٌ واحدٌ للمدرّب — فالحارسُ يقيس الفراغ').toBeGreaterThan(10)
    expect(hits, `«نؤهّلك» وأخواتُها في جرس المدرّب:\n${hits.join('\n')}`).toEqual([])
  })

  it('③ وخبرُ اعتماد الشعبة يقول «أُضيفت إلى دوراتك» لا «صرتَ مؤهَّلا»', () => {
    const m = planApprovedTrainerMsg({
      cohortTitle: 'شعبة', registrationOpen: false, qualifiedCourseAr: 'دورةُ الإعداد',
      meetingsApproved: 0, meetingsFailed: 0, tasksApplied: 0,
    })
    expect(m.body).toContain('أُضيفت «دورةُ الإعداد» إلى دوراتك')
    expect(hitsOf(`${m.title} ${m.heading} ${m.body}`)).toEqual([])
  })
})
