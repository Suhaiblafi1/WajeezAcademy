/* البند ٦ · «أيَّ نسخةٍ أرى؟» — الجوابُ يبلغ شاشةً، والحكمُ تعريفٌ واحد.

   ── الكلفةُ مقيسةٌ لا مقدَّرة ──

   ذهبت جلسةٌ كاملةٌ في تشخيصِ «لماذا أرى موقعا قديما؟» على بيئةٍ خاطئة، وبقي
   السؤالُ مفتوحا أسبوعا. وطوالَ ذلك كان الجوابُ موجودا: مسارُ `‎/api/version`
   يقوله بدقّة. **لكنّه مسارُ JSON يُقرأ بـcurl** — ومعلومةٌ لا شاشةَ لها
   معلومةٌ غيرُ موجودة.

   ── وثلاثةُ أشياءَ تُحرَس هنا، وكلُّها بنيةٌ لا نصّ ──

   ١) **الحكمُ تعريفٌ واحد.** كان محبوسا في جسم مسار `/api/version`. فلمّا لزم
      في «صحّةِ النظام» كان أمامي أن أنسخه — والنسخةُ الثانيةُ تنحرف بصمت.
      فصار في `build-stamp.ts` يقرؤه الاثنان.

   ٢) **و«لا يمكن الحكم» ليست «مختلفان».** وقد وقع هذا خطأً مرّةً: قُورنت بصمةُ
      الالتزام بأوّل اثنَي عشرَ حرفا من بصمةِ المحتوى فأُعلن اختلافٌ لا وجودَ
      له — إنذارٌ كاذبٌ يدفع صاحبَه إلى مطاردةِ عطلٍ غيرِ موجود.

   ٣) **وأصلُ الموقع يُختم وقتَ البناء لا يُسأل وقتَ التشغيل.** `VITE_SITE_ORIGIN`
      متغيّرُ بناءٍ تخبزه Vite في الحزمة ثمّ يختفي؛ فحارسٌ يسأل `process.env`
      عنه في الإقلاع يجيب «غيرُ مضبوط» **في كلّ مرّة** — وحارسٌ يكذب دائما
      يُعلّم قارئَه تجاهلَه، فيصير أسوأَ من لا حارس. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commitOfSnapshotLabel, snapshotInSync } from '../../../server/build-stamp'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('١ · الحكمُ على التطابق — تعريفٌ واحدٌ يمتنع حين يجهل', () => {
  it('ينتزع بصمةَ الالتزام من تسميةٍ آليّةٍ تحملها', () => {
    expect(commitOfSnapshotLabel('auto-a1b2c3d-9f8e7d')).toBe('a1b2c3d')
    expect(commitOfSnapshotLabel('auto-a1b2c3d-9f8e7d-2')).toBe('a1b2c3d')
  })

  it('ولا ينتزع من تسميةٍ لا تحملها — لا اختراعَ ولا اقتطاع', () => {
    /* `auto-<hash12>` بصمةُ محتوًى لا بصمةُ التزام. وقراءةُ أوّلِ سبعةِ أحرفٍ
       منها **تنجح شكلا وتكذب معنًى** — وهي الكذبةُ التي وقعت فعلا. */
    expect(commitOfSnapshotLabel('auto-9f8e7d6c5b4a')).toBeNull()
    expect(commitOfSnapshotLabel('نشرةُ يناير')).toBeNull()
    expect(commitOfSnapshotLabel(null)).toBeNull()
  })

  it('و«لا يمكن الحكم» تُعاد `null` لا `false`', () => {
    /* الفرقُ ليس أسلوبيّا: `false` تُعرض للمالك «لا — من التزامَين مختلفَين»
       فيطارد نشرا متعثّرا لا وجودَ له. */
    expect(snapshotInSync(SHA, 'auto-9f8e7d6c5b4a'), 'لقطةٌ بلا بصمة التزام').toBeNull()
    expect(snapshotInSync(null, 'auto-a1b2c3d-9f8e7d'), 'بناءٌ بلا ختم').toBeNull()
    expect(snapshotInSync(null, null)).toBeNull()
  })

  it('ويحكم حين يملك الطرفَين — بالتطابق وبالاختلاف', () => {
    expect(snapshotInSync(SHA, 'auto-a1b2c3d-9f8e7d')).toBe(true)
    expect(snapshotInSync(SHA, 'auto-0000000-9f8e7d')).toBe(false)
  })

  /* ⚠️ العطبُ الذي وقع فعلا في ٨ سبتمبر ٢٠٢٦ بعد نشرة `2127e8b`:

     النشرُ الآليُّ لا ينشر حين لا يتغيّر الكتالوج — وهو صواب. فتبقى تسميةُ
     اللقطة على آخر التزامٍ **غيّر المحتوى**، ويتقدّم الكودُ دونها. فكان
     الحكمُ يقول «لا — الأرجحُ أنّ نشرا جاريا لم يكتمل» بعد **كلّ** نشرةٍ
     لا تمسّ الكتالوج، ولا نشرَ جارٍ ولا شيءَ ناقص.

     وإنذارٌ كاذبٌ بالعطب يُدرَّب على الإهمال، فيمرّ اليومُ الذي يصدق فيه
     ولا يقرؤه أحد. */
  it('ولقطةٌ من التزامٍ أقدمَ ليست تأخّرا إذا تحقَّق منها الالتزامُ العامل', () => {
    const OLD = 'auto-0000000-9f8e7d'
    expect(snapshotInSync(SHA, OLD), 'بلا سجلِّ تحقّقٍ: الحكمُ اختلاف').toBe(false)
    expect(snapshotInSync(SHA, OLD, SHA), 'وقد تحقَّق هذا الالتزامُ نفسُه').toBe(true)
  })

  it('ولا يُبيّض سجلُّ تحقّقٍ من التزامٍ آخر — ولا سجلٌّ غائب', () => {
    /* وإلّا صار الحقلُ ختما يُمنح لأيّ تحقّقٍ قديم، فيُخفي نشرةً لم تكتمل. */
    const OLD = 'auto-0000000-9f8e7d'
    expect(snapshotInSync(SHA, OLD, 'ffffffffffff'), 'تحقّقٌ من التزامٍ غيرِ العامل').toBe(false)
    expect(snapshotInSync(SHA, OLD, null)).toBe(false)
    expect(snapshotInSync(SHA, OLD, undefined)).toBe(false)
  })

  it('ولا يُنشئ حكما من عدم: بناءٌ بلا ختمٍ يبقى «لا يمكن الحكم» ولو تحقَّق أحد', () => {
    expect(snapshotInSync(null, 'auto-a1b2c3d-9f8e7d', SHA)).toBeNull()
  })

  it('والمسارُ والشاشةُ يقرآن التعريفَ نفسَه — لا نسخةَ ثانيةً تنحرف', () => {
    /* بنيةٌ لا نصّ: يُفحص أنّ كليهما **يستورد** الدالّة، لا أنّ حرفا ورد. */
    const app = read('server/http/app.ts')
    const health = read('server/services/system-health.service.ts')
    for (const [name, src] of [['/api/version', app], ['صحّةُ النظام', health]] as const) {
      expect(src, `${name} لا يستورد الحكمَ من مصدره`).toMatch(
        /import\s*\{[^}]*\bsnapshotInSync\b[^}]*\}\s*from\s*['"][^'"]*build-stamp['"]/,
      )
    }
  })
})

describe('٢ · وأصلُ الموقع يُختم وقتَ البناء', () => {
  it('السكربتُ يكتبه في الختم — فيُعرف بعد البناء أيُّ أصلٍ خُبز في الحزمة', () => {
    const w = read('scripts/write-build-stamp.ts')
    expect(w, 'بلا ختمِه لا موضعَ يقوله البتّة').toMatch(/siteOrigin:\s*siteOriginFromEnv\(\)/)
  })

  it('وحارسُ الإقلاع لا يسأل عنه `process.env` — لأنّه لا يكون هناك أبدا', () => {
    const boot = read('server/index.ts')
    expect(boot).toMatch(/warnOnMissingSiteUrl/)
    expect(
      boot.replace(/\/\*[\s\S]*?\*\//g, ''),
      'حارسٌ يقرأ VITE_SITE_ORIGIN من بيئة الخادم يحذّر في كلّ إقلاع — ويُعلَّم تجاهلُه',
    ).not.toMatch(/process\.env\.VITE_SITE_ORIGIN|env\[.VITE_SITE_ORIGIN.\]/)
  })
})

describe('٣ · والجوابُ يبلغ شاشةً لا curl', () => {
  it('تذييلُ لوحات الإدارة يعرض النسخةَ العاملة', () => {
    const layout = read('src/pages/admin/AdminLayout.tsx')
    expect(layout, 'بلا تصييرِه يبقى الجوابُ في مسارٍ لا يفتحه أحد').toMatch(/<BuildStampLine\s*\/>/)
    expect(layout).toMatch(/import\s+BuildStampLine\s+from/)
  })

  it('ويُجلب مرّةً واحدةً لا مرّةً لكلّ شاشة', () => {
    /* التذييلُ في كلّ شاشةِ إدارة، والانتقالُ لا يعيد تحميلَ التطبيق. فطلبٌ
       لكلّ شاشةٍ = عشراتُ الطلبات على معلومةٍ لا تتغيّر ما دامت العمليّةُ حيّة. */
    const c = read('src/components/BuildStampLine.tsx')
    expect(c, 'بلا خزنِ الوعد يُطلب المسارُ في كلّ انتقال').toMatch(/pending\s*\?\?=/)
  })
})

/* والدالّةُ الصادقةُ لا تنفع إن لم يكتب أحدٌ ما تقرؤه. فالحكمُ أعلاه يتّكئ
   على صفٍّ يكتبه النشرُ الآليّ، ولو سقطت الكتابةُ من أحد فرعَيه عاد الإنذارُ
   الكاذبُ **والاختباراتُ خضراء**: الدالّةُ سليمةٌ ومدخلُها لا يصل. */
describe('٤ · والنشرُ الآليُّ يسجّل تحقّقَه — في الفرعَين معا', () => {
  const svc = () => read('server/services/auto-publish.service.ts')

  it('يستورد المسجِّلَ من مصدره', () => {
    expect(svc()).toMatch(
      /import\s*\{[^}]*\brecordSnapshotVerified\b[^}]*\}\s*from\s*['"][^'"]*snapshot-verified['"]/,
    )
  })

  it('ويسجّل حين لا فرق — وهو الفرعُ الذي وُلد منه العطب', () => {
    /* فرعُ «لا جديد لينشر» هو الغالبُ: كلُّ نشرةٍ لا تمسّ الكتالوج تمرّ به.
       فسقوطُ التسجيل منه يعيد العطبَ كما كان بالضبط. */
    const branch = svc().match(/active\.hash === candidate\.hash\)\s*\{([\s\S]*?)\n {2}\}/)
    expect(branch, 'فرعُ «لا فرق» غير موجود — تغيّرت بنيةُ الخدمة').toBeTruthy()
    expect(branch![1], 'لا تسجيلَ في فرع «لا فرق» — يعود «مختلفان» بعد كلّ نشرةٍ لا تمسّ الكتالوج')
      .toMatch(/recordSnapshotVerified/)
  })

  it('ويسجّل بعد النشر كذلك — فلا يبقى الصفُّ على التزامٍ سابق', () => {
    const afterPublish = svc().split('نُشرت').slice(1).join('نُشرت')
    expect(afterPublish, 'لا تسجيلَ بعد النشر').toMatch(/recordSnapshotVerified/)
  })

  it('ولا يُسقط التسجيلُ نشرا — إخفاقُه يُلتقط', () => {
    /* الكتابةُ تحسينُ تشخيصٍ لا شرطُ نشر. فرميُها يُسقط نشرةً سليمةً لأنّ
       صفّا في جدولٍ جانبيٍّ لم يُكتب. */
    const calls = [...svc().matchAll(/recordSnapshotVerified\([\s\S]{0,200}?\)\s*([\s\S]{0,40})/g)]
    expect(calls.length, 'لا نداءَ للمسجِّل').toBeGreaterThanOrEqual(2)
    for (const c of calls) {
      expect(c[1], `نداءٌ بلا التقاطِ إخفاق: ${c[0].slice(0, 60)}…`).toMatch(/\.catch\(/)
    }
  })

  it('والقراءةُ لا ترمي — فالمسارُ فحصُ صحّةِ الحاوية', () => {
    /* خطأٌ يخرج من القراءة يجعل Docker يعيد تشغيلَ موقعٍ سليم. */
    const mod = read('server/catalog/snapshot-verified.ts')
    const reader = mod.match(/export async function lastVerifiedCommit[\s\S]*?\n\}/)
    expect(reader, 'لا دالّةَ قراءة').toBeTruthy()
    expect(reader![0], 'القراءةُ بلا try/catch — عطبُ صفٍّ يُسقط الموقع').toMatch(/try\s*\{[\s\S]*catch/)
  })
})
