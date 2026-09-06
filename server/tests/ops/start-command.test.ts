/* أمرُ تشغيل الإنتاج — وأن يبقى قابلا للتشغيل بتثبيتٍ إنتاجيّ.

   ── لماذا وُجد هذا الملفّ ──

   لم يكن في المستودَع أمرُ تشغيلٍ إنتاجيٌّ أصلا: الموجودُ `api:dev` وحدَه.
   فوظيفةُ Supervisor على الخادم تشغّل أمرا كُتب باليد **خارج** المستودَع —
   لا يعرفه أحدٌ ولا يراجعه أحدٌ ولا يتحدّث حين تتغيّر الشيفرة.

   ── وما كشفه هذا الفحصُ حين كُتب ──

   `server/db/client.ts` كان **يستورد `embedded-postgres` استيرادا ثابتا**،
   فكلُّ إقلاعٍ للخادم يحمّلها ولو كانت `DATABASE_URL` مضبوطة. وهي حزمةُ
   تطوير: فتثبيتٌ إنتاجيٌّ رشيق (`npm ci --omit=dev`) يجعل الخادمَ يسقط عند
   أوّل سطرٍ بـ«Cannot find module» — والموقعُ لا يعمل إطلاقا.

   ولا تكشفه اختباراتٌ ولا مراجعة: بيئةُ التطوير تثبّت كلَّ شيء، فالعطبُ لا
   يظهر إلّا على خادمٍ حقيقيٍّ في لحظةٍ لا يُراد فيها تشخيص.

   ── وحدُّ ما يُفحص: مسارُ الإقلاع لا كلُّ ما يُستورَد ──

   الاستيرادُ الثابتُ يُحمَّل عند الإقلاع دائما، فحزمةُ تطويرٍ فيه سقوطٌ
   محقّق. أمّا الاستيرادُ الديناميكيّ (`await import(...)`) فلا يُحمَّل إلّا
   حين يُنفَّذ فرعُه — وهو بالضبط ما صارت عليه القاعدةُ المدمجة: لا تُحمَّل
   إلّا لمن يشغّل بلا `DATABASE_URL`، وهو المطوّر لا الخادم. */

import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

const ENTRY = 'server/index.ts'

/* استيراداتٌ ثابتةٌ فقط — الديناميكيُّ لا يُحمَّل عند الإقلاع */
const STATIC_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g

function resolveSpecifier(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  for (const cand of [base, `${base}.ts`, `${base}.js`, `${base}.json`, join(base, 'index.ts')]) {
    try {
      if (statSync(cand).isFile()) return cand
    } catch {
      /* غير موجود — نجرّب التالي */
    }
  }
  return null
}

/** اسمُ الحزمة من المُعرِّف: `@scope/name/sub` → `@scope/name` · `name/sub` → `name` */
const packageOf = (spec: string) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]

/** كلُّ حزمةٍ خارجيّةٍ تُحمَّل عند إقلاع الخادم */
function bootPackages(): { packages: Set<string>; fileCount: number } {
  const seen = new Set<string>()
  const packages = new Set<string>()
  const queue = [join(root, ENTRY)]
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    if (file.endsWith('.json')) continue
    const src = readFileSync(file, 'utf8')
    STATIC_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = STATIC_RE.exec(src))) {
      const spec = m[1]
      if (spec.startsWith('.')) {
        const next = resolveSpecifier(file, spec)
        if (next && !seen.has(next)) queue.push(next)
      } else if (!spec.startsWith('node:')) {
        packages.add(packageOf(spec))
      }
    }
  }
  return { packages, fileCount: seen.size }
}

describe('أمرُ تشغيل الإنتاج', () => {
  it('موجودٌ ويشغّل خادمَ Fastify نفسَه — لا نسخةَ تطويرٍ ولا حزمةً بائدة', () => {
    const start = pkg.scripts.start
    expect(start, 'لا أمرَ تشغيلٍ في المستودَع — فوظيفةُ Supervisor تشغّل أمرا لا يعرفه أحد').toBeTruthy()
    expect(start).toContain(ENTRY)
    /* `api/index.js` حزمةُ معالجِ Vercel ولا تستمع على منفذ — تشغيلُها لا يخدم شيئا */
    expect(start, 'أمرُ التشغيل يشير إلى حزمة Vercel لا إلى الخادم').not.toContain('api/index.js')
  })

  it('وكلُّ ما يشغّله الأمرُ معلَنٌ في `dependencies` — فالتثبيتُ الرشيق يعمل', () => {
    const runner = packageOf(pkg.scripts.start.trim().split(/\s+/)[0])
    expect(pkg.dependencies[runner], `«${runner}» يشغّل الإنتاج وهو ليس في dependencies`).toBeTruthy()
  })

  it('ولا حزمةَ تطويرٍ في مسار الإقلاع — وهذا ما أسقط الخادمَ بلا devDependencies', () => {
    const { packages, fileCount } = bootPackages()
    expect(fileCount, 'شجرةُ الاستيراد لم تُقرأ — الفحصُ فارغ').toBeGreaterThan(50)
    expect(packages.size).toBeGreaterThan(5)

    const offenders = [...packages].filter(
      (p) => !pkg.dependencies[p] && Boolean(pkg.devDependencies[p]),
    )
    expect(offenders.sort(), 'حزمُ تطويرٍ تُحمَّل عند الإقلاع — الخادمُ يسقط بـ«Cannot find module»').toEqual([])

    const undeclared = [...packages].filter((p) => !pkg.dependencies[p] && !pkg.devDependencies[p])
    expect(undeclared.sort(), 'حزمٌ تُستورَد ولا تُعلَن في package.json').toEqual([])
  })

  it('والقاعدةُ المدمجةُ خارج مسار الإقلاع — تُستورَد عند الحاجة لا دائما', () => {
    const client = readFileSync(join(root, 'server/db/client.ts'), 'utf8')
    expect(client, 'استيرادٌ ثابتٌ للقاعدة المدمجة — يعود العطبُ نفسُه').not.toMatch(/^import .*from '\.\/embedded'/m)
    expect(client, 'لم تعد تُستورَد أصلا — فمن يشغّل بلا DATABASE_URL لا قاعدةَ له').toContain("import('./embedded')")
  })
})
