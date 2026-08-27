/* في كل upsert بالمستورد: update يعكس create حقلا بحقل.
 *
 * المستورد يُنشئ ويحدّث. وكل حقل يذكره create ولا يذكره update هو تعديل في
 * المستودع لا يصل قاعدة قائمة أبدا — والصمت هو الخطر: لا خطأ يُرمى، ولا سجل
 * يُكتب، والجداول تبدو مستوردة بنجاح.
 *
 * وقع هذا مرتين. أولا بـ21 `update: {}` فارغة جعلت المستورد بذّارا لا
 * مستوردا. ثم — بعد ملئها — في upsert الأسئلة الذي بدا مملوءا وتنقصه خمسة
 * حقول، وهذه أخبث: قائمة نصف مكتملة تُقرأ كأنها تامة. وكان أثرها في الإنتاج
 * أن `active` لم ينقل تقاعد سؤال، وأن `measures` أبقت خمسة أسئلة M4 موجّهة
 * إلى slugs قديمة غير مسجّلة — فخرجت إجاباتها من متجه المهارات بلا أي عرض.
 *
 * ولا يمسك اختبارٌ سلوكي هذا إلا للحقل الذي خطر له. فالحارس هنا بنيوي: يقرأ
 * كل upsert في الملف ويقارن مجموعتَي المفاتيح، فيغطي ما كُتب اليوم وما يُكتب
 * غدا. المفاتيح المعرِّفة وحدها تُستثنى — تُكتب عند الإنشاء ولا تُحدَّث.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
/* التعليقات تفصل بين المفاتيح داخل الكائن، وقارئ المفاتيح أدناه يقرأ بداية
   كل بند — فبلا مسحها يُقرأ التعليق بندا ويضيع المفتاح الذي يليه. تُستبدل
   بأسطر فارغة بعددها كي تبقى أرقام الأسطر في التقرير صحيحة. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

const SRC = stripComments(readFileSync(join(root, 'server/catalog/importer.ts'), 'utf8'))

/* مفاتيح الهوية: جزء من `where` أو من الربط بالأب، تُثبَّت عند الإنشاء ولا تُحدَّث */
const IDENTITY = new Set([
  'id', 'slug', 'code', 'version', 'pathwayId', 'courseId', 'courseVersionId',
  'moduleId', 'skillId', 'questionId', 'templateId', 'optionId', 'listType',
  'orderIndex', 'label', 'domainId', 'referenceId', 'entityId', 'entityType',
  'publishedAt',
])

/* ما لا يجوز للمستورد أن يكتبه فوق صفّ قائم — بسببه، لا بقائمة مفتوحة.
   القاعدة ليست «update = create» بل «كل ما يشتقّه المستورد من المستودع يصل».
   وما يملكه غيره يبقى له: لو حُذف سطرٌ من هنا وجب أن يُنقل الحقل إلى update
   أو يُشطب هذا البند — لا أن تبقى القائمة تُطمئن بعد زوال سببها. */
const DELIBERATE: Record<string, Record<string, string>> = {
  pathway: { currentVersion: 'مؤشّر الإصدار تملكه دورة النشر — والمستورد يكتب 1 دائما، فتحديثه يرجع المنشور إلى الوراء' },
  course: { currentVersion: 'المصدر نفسه' },
  compositeTemplate: { currentVersion: 'المصدر نفسه' },
  pathwayCourse: { kind: 'ثابت افتراضي «required» لا يرد في ملفات المستودع — والإدارة قد تجعلها اختيارية' },
  diagnosticProfile: { readinessStatus: 'ثابت افتراضي، والجاهزية تتغيّر من اللوحة لا من الملفات' },
}

/** يقصّ نصّا متوازن الأقواس ابتداء من `{` عند فهرس معطى */
function balanced(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i)
  }
  throw new Error(`أقواس غير متوازنة عند ${open}`)
}

/** مفاتيح المستوى الأول داخل جسم كائن — تتجاهل الأقواس المتداخلة */
function topLevelKeys(body: string): string[] {
  const keys: string[] = []
  let depth = 0
  let atStart = true
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    else if (ch === ',' && depth === 0) atStart = true
    else if (depth === 0 && atStart && /[A-Za-z_]/.test(ch)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(body.slice(i))
      if (m) keys.push(m[1])
      atStart = false
    } else if (!/\s/.test(ch)) {
      if (ch !== '/' && ch !== '*') atStart = false
    }
  }
  return keys
}

interface Upsert { model: string; line: number; create: string[]; update: string[] }

function parseUpserts(): Upsert[] {
  const out: Upsert[] = []
  const re = /prisma\.(\w+)\.upsert\(\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(SRC))) {
    const open = SRC.indexOf('{', m.index + m[0].length - 1)
    const body = balanced(SRC, open)
    const line = SRC.slice(0, m.index).split('\n').length
    const grab = (word: 'create' | 'update') => {
      const at = body.search(new RegExp(`(^|[\\s,])${word}\\s*:\\s*\\{`))
      if (at < 0) return []
      return topLevelKeys(balanced(body, body.indexOf('{', at)))
    }
    out.push({ model: m[1], line, create: grab('create'), update: grab('update') })
  }
  return out
}

describe('المستورد: update يعكس create', () => {
  const upserts = parseUpserts()

  it('التحليل يقرأ الملف فعلا — الاختبار ليس فارغا', () => {
    expect(upserts.length).toBeGreaterThan(15)
    const q = upserts.find((u) => u.model === 'question')
    expect(q, 'لم يُعثر على upsert الأسئلة').toBeTruthy()
    expect(q!.create.length).toBeGreaterThan(5)
    expect(q!.update.length).toBeGreaterThan(5)
  })

  it('لا حقل في create غائب عن update إلا الهوية وما استُثني بسببه', () => {
    const gaps = upserts
      .map((u) => ({
        at: `${u.model} (سطر ${u.line})`,
        missing: u.create.filter(
          (k) => !IDENTITY.has(k) && !u.update.includes(k) && !DELIBERATE[u.model]?.[k],
        ),
      }))
      .filter((g) => g.missing.length > 0)
    expect(gaps).toEqual([])
  })

  it('كل استثناء مقصود ما زال قائما — لا بند يبقى بعد زوال سببه', () => {
    const stale: string[] = []
    for (const [model, fields] of Object.entries(DELIBERATE)) {
      const found = upserts.filter((u) => u.model === model)
      if (found.length === 0) { stale.push(`${model}: لا upsert بهذا الاسم`); continue }
      for (const field of Object.keys(fields)) {
        const live = found.some((u) => u.create.includes(field) && !u.update.includes(field))
        if (!live) stale.push(`${model}.${field}: لم يعد مستثنى — انقله أو اشطب البند`)
      }
    }
    expect(stale).toEqual([])
  })

  it('لا update فارغة — المستورد يحدّث لا يبذر فقط', () => {
    const empty = upserts.filter((u) => u.create.length > 0 && u.update.length === 0)
    expect(empty.map((u) => `${u.model} (سطر ${u.line})`)).toEqual([])
  })
})
