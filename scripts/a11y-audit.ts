#!/usr/bin/env tsx
/* موجة ٦ · ب — فحص إتاحة متكرر لا فحصٌ لمرة واحدة (البند ت-٤).

   خطة التجربة قالت صراحة: «ت-٤ لم يُفحص بعد: ترتيب Tab كاملا، ووضوح حلقة
   التركيز، وقارئ الشاشة، والتكبير ٢٠٠٪ — ولا أدّعي أنها فُحصت». وفحصٌ يدويّ
   لمرة واحدة يتقادم في أول تغيير، فهذا سكربتٌ يُشغَّل في CI بخط أساس على
   قاعدة «الاتجاه لا القيمة» (نفس درس أ-٤ ود-١).

   ما يفحصه على كل صفحة:
   ١) اسمٌ مقروء لكل عنصر تفاعلي  ٢) tabindex موجب  ٣) منطقة main ولغة الصفحة
   ٤) ترتيب العناوين  ٥) حلقة تركيز مرئية على كل محطة Tab  ٦) عنصر يُركَّز عليه
   وهو مخفي (مصيدة صامتة)  ٧) انسياب بلا تمرير أفقي عند ١٠٠٪ و٢٠٠٪ و٤٠٠٪.

   شغّل: npm run a11y:audit            (يحتاج الواجهة على 3000 والخادم على 7101)
        npm run a11y:audit -- --update  لتحديث خط الأساس بعد إصلاح مقصود */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'

/** واقعة إتاحة واحدة — بصيغة واحدة كي تُقارن وتُعدّ. الشكل يقابل probe.browser.js */
interface A11yFinding {
  rule: 'name' | 'focus-visible' | 'focus-hidden' | 'tabindex-positive' | 'landmark' | 'reflow' | 'lang' | 'heading-order' | 'contrast' | 'target-size'
  /** ما يمنعه هذا الخلل على المستخدم — لا رقم قاعدة */
  impactAr: string
  target: string
}
interface FocusStyle {
  tag: string; text: string; outline: string; shadow: string; ring: string; hidden: boolean
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(root, 'a11y-baseline.json')
const UPDATE = process.argv.includes('--update')
/* مجموعتان: `all` محليا (تحتاج خادم API وحسابات ديمو)، و`public` في CI —
   الصفحات العامة وحدها تكفي لحراسة الانحدار بلا إقلاع قاعدة وبذر حسابات.
   وخط الأساس مفهرس بالمجموعة، فلا تُقارن أعدادُ ثمانِ صفحات بأعداد أربع. */
const SET: 'all' | 'public' = process.argv.includes('--public') ? 'public' : 'all'
const BASE = process.env.A11Y_BASE ?? 'http://localhost:3000'
/* مسار المتصفح: بيئة التطوير هنا تضع Chromium في مسار ثابت، وCI يثبّته
   بـplaywright install. فالمسار يُستعمل إن وُجد، وإلا يجد Playwright متصفحه. */
const CHROME_HINT = process.env.A11Y_CHROME ?? '/opt/pw-browsers/chromium'
const MAX_TABS = 60
/** انتظار استقرار انتقال الحلقة قبل قراءتها — انظر التعليق في focusWalk */
const FOCUS_SETTLE_MS = 220

interface PageSpec {
  path: string
  labelAr: string
  /** حساب يُدخَل قبل الزيارة — الصفحات العامة بلا حساب */
  as?: 'learner' | 'admin' | 'trainer' | 'advisor' | 'superadmin'
  /** مُنتقٍ يثبت أن المحتوى المُدار بالبيانات رُسم فعلا — انظر waitForContent */
  readySel?: string
}

/* صفحات مختارة تغطي الأدوار والأنماط: عامة · نموذج · بوابة متعلم · إدارة */
const PAGES: PageSpec[] = [
  { path: '/', labelAr: 'الرئيسية', readySel: 'article' },
  { path: '/pathways', labelAr: 'المسارات', readySel: 'article' },
  { path: '/diagnostic', labelAr: 'التشخيص' },
  { path: '/auth', labelAr: 'الدخول والتسجيل' },
  /* أول احتكاك المدرب بوجيز، ونموذجُها الأطول: ثلاث خطوات وقوائم وحقول ملفّات */
  { path: '/join-trainer', labelAr: 'انضمام المدربين' },
  { path: '/student', labelAr: 'لوحة المتعلم', as: 'learner' },
  { path: '/student/review', labelAr: 'مراجعتي', as: 'learner' },
  { path: '/admin/catalog', labelAr: 'إدارة الكتالوج', as: 'admin' },
  { path: '/admin/quality', labelAr: 'جودة التشخيص', as: 'admin' },
  /* ═══ ما كان خارجَ الفحص: شاشاتُ العمل اليوميّ ═══

     كان الفحصُ على تسعِ صفحاتٍ أكثرُها عامّة، وشاشتَي إدارةٍ اثنتَين. أمّا
     الشاشاتُ التي يقضي فيها الفريقُ يومَه — الشعبُ والمستخدمون والمالية
     والدعمُ ولوحُ المدرّب وحالاتُ المستشار — فلم تُفحَص مرّةً. وهي أكثفُ
     الشاشات جداولَ ونماذجَ وأزرارا، أي أكثرُها احتمالا للخلل. */
  { path: '/admin', labelAr: 'لوحة الإدارة', as: 'admin' },
  { path: '/admin/cohorts', labelAr: 'الشعب', as: 'admin' },
  { path: '/admin/finance', labelAr: 'المالية', as: 'admin' },
  { path: '/admin/support', labelAr: 'تذاكر الدعم', as: 'admin' },
  { path: '/admin/users', labelAr: 'المستخدمون والأدوار', as: 'superadmin' },
  { path: '/admin/system-health', labelAr: 'صحّة النظام', as: 'superadmin' },
  { path: '/trainer', labelAr: 'بوّابة المدرّب', as: 'trainer' },
  { path: '/advisor', labelAr: 'بوّابة المستشار', as: 'advisor' },
]

const CREDS = {
  learner: { email: 'student.demo@wajeez.local', password: 'Wajeez-Demo-2026' },
  admin: { email: 'admin.demo@wajeez.local', password: 'Wajeez-Demo-2026' },
  /* بوّابتا المدرّب والمستشار كانتا خارجَ الفحص كلَّه — وهما بوّابتان كاملتان
     يعمل فيهما فريقٌ يوميّا، لا شاشتان هامشيّتان. */
  trainer: { email: 'trainer.demo@wajeez.local', password: 'Wajeez-Demo-2026' },
  advisor: { email: 'consultant.demo@wajeez.local', password: 'Wajeez-Demo-2026' },
  superadmin: { email: 'superadmin.demo@wajeez.local', password: 'Wajeez-Demo-2026' },
}

async function login(page: Page, as: keyof typeof CREDS) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' })
  await page.fill('input[type=email]', CREDS[as].email)
  await page.fill('input[type=password]', CREDS[as].password)
  await page.click('button[type=submit]')
  await page.waitForTimeout(2500)
}

/** حلقة التركيز: تُقارن بصمة النمط قبل التركيز وبعده — الفرق هو الدليل */
async function focusWalk(page: Page): Promise<A11yFinding[]> {
  const out: A11yFinding[] = []
  const seen = new Set<string>()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    /* ⚠ مهلة استقرار مقصودة: عناصر عليها `transition-all` تُحرّك عرض الحلقة من
       صفر، فقراءةٌ فورية ترى 0px وتُبلّغ عن غياب حلقة **موجودة**. كان هذا
       يعطي خمس وقائع وهمية في الرئيسية وحدها — وأداةٌ تُبلّغ عن أعطال وهمية
       أسوأ من لا أداة، لأنها تعلّم القارئ تجاهل الأحمر. */
    await page.waitForTimeout(FOCUS_SETTLE_MS)
    const s = await page.evaluate('window.__a11y.focusStyle()') as FocusStyle | null
    if (!s) continue
    const key = `${s.tag}|${s.text}`
    if (seen.has(key)) continue // دورة كاملة أو تكرار — لا نعيد الإبلاغ
    seen.add(key)

    if (s.hidden) {
      out.push({
        rule: 'focus-hidden', target: `${s.tag} «${s.text}»`,
        impactAr: 'يُركَّز عليه وهو غير مرئي — مستخدم لوحة المفاتيح يفقد مؤشره بلا سبب ظاهر',
      })
      continue
    }
    /* دليل التركيز: outline أو ظل أو حلقة Tailwind. غياب الثلاثة = لا دليل. */
    const hasOutline = s.outline !== '' && !/none/.test(s.outline) && !/\b0px\b/.test(s.outline)
    const hasShadow = s.shadow !== 'none' && s.shadow !== ''
    const hasRing = s.ring !== '' && s.ring !== '0 0 #0000'
    if (!hasOutline && !hasShadow && !hasRing) {
      out.push({
        rule: 'focus-visible', target: `${s.tag} «${s.text}»`,
        impactAr: 'لا حلقة تركيز مرئية — مستخدم لوحة المفاتيح لا يعرف أين هو في الصفحة',
      })
    }
  }
  return out
}

async function reflow(page: Page, labelAr: string): Promise<A11yFinding[]> {
  const out: A11yFinding[] = []
  /* التكبير يُحاكى بتصغير المنفذ: ٢٠٠٪ على 1280 = 640 بكسل CSS، و٤٠٠٪ = 320 */
  for (const [zoom, width] of [[100, 1280], [200, 640], [400, 320]] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(400)
    if (await page.evaluate('window.__a11y.hasHScroll()')) {
      out.push({
        rule: 'reflow', target: `${labelAr} @ ${zoom}%`,
        impactAr: `تمرير أفقي عند تكبير ${zoom}٪ — القراءة تصير سطرا سطرا بتمرير يمينا ويسارا`,
      })
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  return out
}

const PROBE_SRC = readFileSync(join(root, 'scripts/a11y/probe.browser.js'), 'utf8')
const { existsSync } = await import('node:fs')
const browser = await chromium.launch(
  existsSync(CHROME_HINT) ? { executablePath: CHROME_HINT } : {},
)
const results: Record<string, A11yFinding[]> = {}

/* لا يُقاس ما لم يُرسَم بعد.
   انتظارٌ ثابت (waitForTimeout) يجعل النتيجة رهن سرعة الجهاز: على عدّاء CI
   البطيء كانت صفحة المسارات تُقاس قبل وصول كتالوجها فتُعلن «صفر واقعة»، وعلى
   جهاز أسرع تظهر البطاقات فتظهر معها واقعة تجاوز حقيقية. بوابةٌ تُجيز صفحة لم
   ترها أسوأ من غياب البوابة: تُطمئن بلا أن تفحص.
   فالانتظار الآن على دليل: مُنتقٍ للمحتوى المُدار بالبيانات حيث يوجد، وحدٌّ
   أدنى للنص في كل صفحة. وتعذّر بلوغه يُسقط الفحص بدل أن يُعلنه نظيفا. */
const MIN_TEXT = 400
const CONTENT_TIMEOUT_MS = 25_000

async function waitForContent(page: Page, spec: PageSpec): Promise<void> {
  if (spec.readySel) {
    await page.waitForSelector(spec.readySel, { state: 'visible', timeout: CONTENT_TIMEOUT_MS })
  }
  await page.waitForFunction(
    (min) => (document.body?.innerText ?? '').trim().length >= min,
    MIN_TEXT,
    { timeout: CONTENT_TIMEOUT_MS },
  )
  /* هدأة قصيرة بعد ظهور المحتوى: التخطيط يستقر بعد الرسم الأول */
  await page.waitForTimeout(600)
}

/* ─────────── التباينُ في المظهرَين ───────────

   المنصّةُ تفتح داكنةً دائما، والفاتحُ اختيارٌ يعيش الزيارةَ الحاليّة
   (`sessionStorage`). وأكثرُ ألوانِ النصّ مبنيّةٌ على أرضيّةٍ داكنة
   (`text-white/45` وأمثالُها) — فمن بقي منها في الفاتح صار أبيضَ باهتا على
   ورقٍ فاتح. وقد وقع هذا في زرّ تبديل المظهر نفسِه (تعليقُ `ThemeToggle`)،
   فالفحصُ في مظهرٍ واحدٍ يفوّت نصفَ المنصّة. */
async function contrastBothThemes(page: Page, labelAr: string): Promise<A11yFinding[]> {
  interface Hit { target: string; text: string; ratio: number; need: number; size: number }
  const out: A11yFinding[] = []
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t
      try { sessionStorage.setItem('wajeez_theme', t) } catch { /* وضعٌ خاصٌّ بلا تخزين */ }
    }, theme)
    /* لحظةٌ لتستقرّ الأنماطُ المنتقلة قبل قراءة الألوان المحسوبة */
    await page.waitForTimeout(180)
    const hits = await page.evaluate('window.__a11y.contrast()') as Hit[]
    for (const h of hits) {
      out.push({
        rule: 'contrast',
        target: `[${theme}] ${h.target}`,
        impactAr: `نصٌّ بتباين ${h.ratio}:1 والمطلوب ${h.need}:1 في المظهر ${theme === 'dark' ? 'الداكن' : 'الفاتح'} — «${h.text}» (${h.size}px)`,
      })
    }
    if (hits.length > 0) {
      console.log(`    · ${labelAr} · ${theme}: ${hits.length} نصّا دون الحدّ، أسوأُها ${hits[0].ratio}:1`)
    }
  }
  /* تُعاد إلى الداكن كي لا يورَّث المظهرُ إلى فحصٍ تالٍ في السياق نفسِه */
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  return out
}

/* ─────────── حجمُ الهدف على هاتف ───────────

   الفحصُ كلُّه يعمل على منفذٍ عرضُه ١٢٨٠ — وأهدافُ اللمس تنكسر حيث لا
   يُفحَص: على الهاتف. فالشريطُ `flex` يضغط علامةَ المنصّة إلى بكسلَين،
   والحبّةُ التي تسع نصَّها على الحاسوب تلتفّ فيرقّ صفُّها.

   فتُقاس مرّةً على ٣٩٠×٨٤٤ — عرضُ أضيقِ هاتفٍ شائع — بعد أن يستقرّ
   التخطيط، ثمّ يُعاد المنفذُ كي لا يورَّث الضيقُ إلى قاعدةٍ تالية. */
async function targetsOnPhone(page: Page): Promise<A11yFinding[]> {
  interface Hit { target: string; text: string; w: number; h: number }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  const hits = await page.evaluate('window.__a11y.targets()') as Hit[]
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(200)
  return hits.map((h) => ({
    rule: 'target-size' as const,
    target: `[390px] ${h.target}`,
    impactAr: `هدفُ لمسٍ ${h.w}×${h.h} والحدُّ ٢٤×٢٤ على هاتفٍ عرضُه ٣٩٠ — «${h.text}»`,
  }))
}

const SELECTED = SET === 'public' ? PAGES.filter((p) => !p.as) : PAGES

for (const spec of SELECTED) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  /* حقن فحوص الصفحة قبل أي تحميل — addInitScript يسبق شيفرة التطبيق */
  await ctx.addInitScript({ content: PROBE_SRC })
  const page = await ctx.newPage()
  try {
    if (spec.as) await login(page, spec.as)
    await page.goto(`${BASE}${spec.path}`, { waitUntil: 'networkidle' })
    await waitForContent(page, spec)
    const findings = [
      ...(await page.evaluate('window.__a11y.names()') as A11yFinding[]),
      ...(await focusWalk(page)),
      ...(await reflow(page, spec.labelAr)),
      ...(await contrastBothThemes(page, spec.labelAr)),
      ...(await targetsOnPhone(page)),
    ]
    results[spec.labelAr] = findings
    const byRule = findings.reduce<Record<string, number>>((a, f) => ({ ...a, [f.rule]: (a[f.rule] ?? 0) + 1 }), {})
    console.log(`${findings.length === 0 ? '✅' : '⚠ '} ${spec.labelAr.padEnd(18)} ${findings.length} واقعة ${JSON.stringify(byRule)}`)
  } catch (e) {
    console.error(`✗ ${spec.labelAr}: ${String(e).slice(0, 160)}`)
    results[spec.labelAr] = [{ rule: 'landmark', target: spec.path, impactAr: `تعذّر فحص الصفحة: ${String(e).slice(0, 120)}` }]
  }
  await ctx.close()
}
await browser.close()

/* عدّاد لكل قاعدة — خط الأساس يقارن الأعداد لا النصوص، فلا يفشل على تغيير صياغة */
const counts: Record<string, number> = {}
for (const findings of Object.values(results)) {
  for (const f of findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1
}
const total = Object.values(counts).reduce((a, b) => a + b, 0)

console.log(`\n── المجموع: ${total} واقعة · المجموعة: ${SET} (${SELECTED.length} صفحة) ──`)
for (const [page, findings] of Object.entries(results)) {
  if (findings.length === 0) continue
  console.log(`\n${page}:`)
  const shown = new Map<string, A11yFinding & { n: number }>()
  for (const f of findings) {
    const k = `${f.rule}|${f.impactAr}`
    const prev = shown.get(k)
    shown.set(k, prev ? { ...prev, n: prev.n + 1 } : { ...f, n: 1 })
  }
  for (const f of shown.values()) {
    console.log(`  · [${f.rule}] ${f.impactAr}${f.n > 1 ? ` (×${f.n})` : ''}`)
    console.log(`    ← ${f.target}`)
  }
}

if (UPDATE) {
  let prev: Record<string, unknown> = {}
  try { prev = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, unknown> } catch { /* أول مرة */ }
  writeFileSync(BASELINE, JSON.stringify({ ...prev, [SET]: counts }, null, 2) + '\n')
  console.log(`\n✍️  حُدِّث خط أساس الإتاحة (${SET}):`, JSON.stringify(counts))
  process.exit(0)
}

type BaselineFile = Partial<Record<'all' | 'public', Record<string, number>>>
let file: BaselineFile = {}
try {
  file = JSON.parse(readFileSync(BASELINE, 'utf8')) as BaselineFile
} catch { /* أول تشغيل — يُكتب أدناه */ }
const base = file[SET]
if (!base) {
  writeFileSync(BASELINE, JSON.stringify({ ...file, [SET]: counts }, null, 2) + '\n')
  console.log(`\n✍️  أُنشئ خط أساس الإتاحة (${SET}) أول مرة:`, JSON.stringify(counts))
  process.exit(0)
}

const worse: string[] = []
const better: string[] = []
for (const rule of new Set([...Object.keys(base), ...Object.keys(counts)])) {
  const b = base[rule] ?? 0
  const l = counts[rule] ?? 0
  if (l > b) worse.push(`${rule}: ${b} ← ${l}`)
  else if (l < b) better.push(`${rule}: ${b} → ${l}`)
}

if (worse.length > 0) {
  console.error('\n✗ تراجع في الإتاحة:')
  for (const w of worse) console.error(`  · ${w}`)
  console.error('\n  أصلح الواقعة، أو وثّق السبب وحدّث خط الأساس:')
  console.error(`  npm run a11y:audit -- --update${SET === 'public' ? ' --public' : ''}`)
  process.exit(1)
}
if (better.length > 0) {
  console.log(`\n✅ تحسّن — ${better.join(' · ')}.`)
  console.log('   حدّث خط الأساس كي يُحفَظ المكسب: npm run a11y:audit -- --update')
} else {
  console.log('\n✅ لا تراجع في الإتاحة.')
}
