/* لا حساب مسارات من موقع الوحدة داخل ما يُحزَم.
 *
 * الإنتاج لا يشغّل ملفات الخادم: يشغّل api/index.js وحده، مجمّعا بـesbuild.
 * فأي وحدة تحسب جذر المستودع بالصعود من import.meta.url تحسبه صحيحا في
 * المصدر (server/catalog/… مستويان تحت الجذر) وخاطئا في الحزمة (api/ مستوى
 * واحد) — فتصعد فوق الجذر وتسقط بـENOENT.
 *
 * هذا ما أسقط تحليل الأثر على الإنتاج: buildSnapshotFromDb كانت تقرأ
 * option-effects.v2.json من `<الجذر>/../src/data/…`، فيردّ الخادم 500
 * و«خطأ داخلي غير متوقع» في الخطوة التي تسبق كل نشر.
 *
 * ولا تمسك اختبارات المصدر هذا أبدا: هي تشغّل الملفات في مواضعها، حيث
 * الحساب صحيح. فالحارس هنا بنيوي — يمشي على شجرة الاستيراد الفعلية من
 * معالج Vercel، فيغطي ما هو موصول اليوم وما يوصَل غدا، ويترك ما ليس
 * موصولا (سكربتات مثل importer.ts تعمل بـtsx من جذر المستودع) بلا استثناء
 * مكتوب يدويا يتقادم.
 *
 * البديل الصحيح للقراءة من القرص: الاستيراد الثابت — esbuild يضمّن الملف،
 * وتتبّع ملفات Vercel يتبع الاستيرادات لا مسارات readFileSync المحسوبة.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ENTRY = 'server/http/vercel-handler.ts'

/* المعروف اليوم، بسببه — لا قائمة تسامح مفتوحة. أي وحدة جديدة تقع في
   العطل نفسه تُسقط الاختبار فورا، وإصلاح واحدة من هؤلاء يوجب شطبها من هنا
   فلا تبقى القائمة تُطمئن بعد زوال سببها. */
const KNOWN: Record<string, string> = {
  'server/db/embedded.ts':
    'قاعدة التطوير المدمجة — لا تُنادى في الإنتاج لأن DATABASE_URL مضبوطة، فالمسار الخاطئ لا يُقرأ',
}

/* استيرادات نسبية فقط — الحزم الخارجية external ولا تُجمَّع */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"](\.[^'"]+)['"]/g
const DYNAMIC_RE = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g

function resolveSpecifier(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  /* الترتيب يطابق حل esbuild: الامتداد الصريح أولا، ثم .ts/.js/.json، ثم
     دليل بـindex.ts. والدليل نفسه ليس وحدة — بلا فحص isFile يُقرأ فيسقط
     الاختبار بـEISDIR بدل أن يحكم. */
  for (const cand of [base, `${base}.ts`, `${base}.js`, `${base}.json`, join(base, 'index.ts')]) {
    try {
      if (statSync(cand).isFile()) return cand
    } catch {
      /* غير موجود — نجرّب التالي */
    }
  }
  return null
}

/* التعليقات تشرح هذا العطل بالذات فتذكر `import.meta.url` نصّا — ومسحُها
   قبل الفحص هو الفرق بين حارس يقرأ الكود وآخر يقرأ الشرح عنه. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** كل ملف مصدر يصل إليه معالج Vercel عبر الاستيرادات النسبية */
function reachableFiles(): string[] {
  const seen = new Set<string>()
  const queue = [join(root, ENTRY)]
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    if (file.endsWith('.json')) continue
    const src = readFileSync(file, 'utf8')
    for (const re of [IMPORT_RE, DYNAMIC_RE]) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const next = resolveSpecifier(file, m[1])
        if (next && !seen.has(next)) queue.push(next)
      }
    }
  }
  return [...seen].map((f) => f.slice(root.length + 1))
}

describe('أمان الحزمة: لا حساب جذر من موقع الوحدة فيما يُحزَم', () => {
  const files = reachableFiles()

  it('شجرة الاستيراد تُقرأ فعلا — الاختبار ليس فارغا', () => {
    expect(files).toContain(ENTRY)
    expect(files).toContain('server/catalog/snapshot-builder.ts')
    expect(files).toContain('server/services/impact.service.ts')
    expect(files.length).toBeGreaterThan(40)
  })

  it('ما ليس موصولا بالمعالج لا يُحاسَب — importer.ts سكربت يعمل بـtsx', () => {
    expect(files).not.toContain('server/catalog/importer.ts')
  })

  it('لا وحدة موصولة تشتق مسارا من import.meta.url إلا المعروف بسببه', () => {
    const offenders = files
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => stripComments(readFileSync(join(root, f), 'utf8')).includes('import.meta.url'))
    expect(offenders.sort()).toEqual(Object.keys(KNOWN).sort())
  })

  it('باني اللقطة وخدمة الأثر لا يقرآن ملفات المستودع من القرص', () => {
    for (const f of ['server/catalog/snapshot-builder.ts', 'server/services/impact.service.ts']) {
      expect(stripComments(readFileSync(join(root, f), 'utf8'))).not.toMatch(/readFileSync/)
    }
    const sb = readFileSync(join(root, 'server/catalog/snapshot-builder.ts'), 'utf8')
    expect(sb).toMatch(/^import optionEffectsOverlay from/m)
  })
})
