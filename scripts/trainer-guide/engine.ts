/* محرّكُ لقطات «دليل المدرّب» — يدخل البوّابةَ، ويؤشّر على ما يُشرَح، ويحفظ.

   ═══ ولمَ لقطاتٌ مولَّدةٌ لا مرفوعةٌ باليد ═══

   الدليلُ يَعِد المدرّبَ بأنّ ما يراه في الصورة هو ما سيراه في بوّابته. ولقطةٌ
   تُؤخَذ باليد مرّةً تكذب عند أوّل تعديلٍ على الشاشة، ولا يعرف أحدٌ أنّها
   كذبت. فهي تُولَّد من المنصّة نفسِها بأمرٍ واحد (`npm run guide:shots`)، ومن
   غيّر شاشةً أعاد توليدَها.

   ═══ والتأشيرُ من أنماطٍ مقيسة (Mobbin) ═══

   · **بقعةُ ضوء** (Zoho CRM · Deel): ما يُشرَح مضاءٌ وما حوله معتم — فالعينُ
     تجد الزرَّ قبل أن تقرأ الشرح.
   · **أرقامٌ على الصورة تقابل أرقامَ الخطوات** (Tripadvisor): الخطوةُ «٣» في
     النصّ هي الدائرةُ «٣» على الصورة، فلا يُبحث عن الزرّ بوصفه.

   والترميزُ WebP يقع **في المتصفّح نفسِه** (`canvas.toDataURL`) — فلا مكتبةَ
   صورٍ تُضاف إلى المستودع لأجل أداةٍ تُشغَّل محلّيّا. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'

export interface Mark {
  /** ما يُحاط بإطارٍ ويُرقَّم */
  target: Locator
  /** الرقمُ على الصورة — يقابل رقمَ الخطوة في الدليل */
  n: number
  /** حشوٌ حول الهدف بالبكسل */
  pad?: number
}

export interface ShotSpec {
  /** اسمُ الملفّ بلا امتداد — ويُرجَع إليه من محتوى الدليل */
  name: string
  /** ما يُقتطَع: عنصرٌ بعينه، أو إطارُ العرض كلُّه */
  clip: Locator | 'viewport'
  /** حشوُ الاقتطاع حول العنصر */
  clipPad?: number
  marks?: Mark[]
  /** إعتامُ ما خرج عن المؤشَّر عليه — يُطفأ حين تكون الشاشةُ كلُّها هي الشرح */
  spotlight?: boolean
  /** أقصى عرضٍ للصورة المحفوظة بالبكسل الحقيقيّ — ما زاد يُصغَّر */
  maxWidth?: number
  /** أقصى ارتفاعٍ للاقتطاع بنقاط الصفحة — لوحٌ طويلٌ يُرى أوّلُه وحدَه */
  maxHeight?: number
}

export interface Engine {
  browser: Browser
  context: BrowserContext
  page: Page
  base: string
  outDir: string
  shots: Record<string, { w: number; h: number }>
}

const GOLD = '#D9A21B'
const INK = '#162220'

/** خطوطُ المنصّة من مخزنٍ محلّيّ إن وُجد — المتصفّحُ هنا قد لا يثق بوسيط الشبكة،
    ولا يُطفأ التحقّقُ لأجل لقطة. فتُنزَّل الخطوطُ مرّةً بأداةٍ تتحقّق، وتُقدَّم منه. */
async function routeFonts(context: BrowserContext, cacheDir: string | undefined) {
  if (!cacheDir || !existsSync(join(cacheDir, 'gfonts.css'))) return
  const css = readFileSync(join(cacheDir, 'gfonts.css'))
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: css }))
  await context.route('https://fonts.gstatic.com/**', (route) => {
    const file = join(cacheDir, new URL(route.request().url()).pathname.slice(1).replace(/\//g, '__'))
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: 'font/woff2', body: readFileSync(file) })
  })
}

export async function startEngine(opts: {
  base: string
  outDir: string
  chrome?: string
  fontCache?: string
  viewport?: { width: number; height: number }
}): Promise<Engine> {
  const executablePath = opts.chrome && existsSync(opts.chrome) ? opts.chrome : undefined
  const browser = await chromium.launch({ executablePath })
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    locale: 'ar',
    colorScheme: 'light',
    timezoneId: 'Asia/Amman',
  })
  await routeFonts(context, opts.fontCache)
  const page = await context.newPage()
  mkdirSync(opts.outDir, { recursive: true })
  return { browser, context, page, base: opts.base, outDir: opts.outDir, shots: {} }
}

export async function signIn(e: Engine, email: string, password: string) {
  await e.context.clearCookies()
  await e.page.goto(`${e.base}/auth`, { waitUntil: 'networkidle' })
  await e.page.fill('input[type=email]', email)
  await e.page.fill('input[type=password]', password)
  await e.page.click('button[type=submit]')
  await e.page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15_000 })
}

/** يفتح المسارَ وينتظر أن تهدأ الشاشة: الشبكةُ والخطوطُ ومؤشّراتُ التحميل */
export async function open(e: Engine, path: string) {
  await e.page.goto(`${e.base}${path}`, { waitUntil: 'networkidle' })
  await settle(e)
}

export async function settle(e: Engine) {
  /* الصفحاتُ تُحمَّل كسولا (`lazy`) والتنقّلُ داخلَ التطبيق لا يُعيد تحميلَ
     المستند — فيُنتظَر هدوءُ الشبكة بعد كلّ نقرة، لا بعد `goto` وحدَه. */
  await e.page.waitForLoadState('networkidle').catch(() => undefined)
  await e.page.evaluate(() => document.fonts.ready)
  await e.page.waitForFunction(() => !document.querySelector('.animate-spin'), undefined, { timeout: 15_000 })
    .catch(() => undefined)
  await e.page.waitForTimeout(400)
}

type Rect = { x: number; y: number; w: number; h: number }

/** موضعُ الهدف في المستند — بلا تمرير: يُقاس والتخطيطُ ساكن */
async function measure(target: Locator): Promise<Rect> {
  const box = await target.first().boundingBox()
  if (!box) throw new Error(`لا يُرى الهدف: ${target.toString()}`)
  const scroll = await target.page().evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  return { x: box.x + scroll.x, y: box.y + scroll.y, w: box.width, h: box.height }
}

/** يرسم الإطاراتِ والأرقامَ وبقعةَ الضوء فوق الصفحة — بإحداثيّات المستند */
async function drawOverlay(page: Page, marks: (Rect & { n: number; pad: number })[], spotlight: boolean) {
  await page.evaluate(({ marks, spotlight, GOLD, INK }) => {
    document.getElementById('__guide_overlay')?.remove()
    const doc = document.documentElement
    const W = Math.max(doc.scrollWidth, window.innerWidth)
    const H = Math.max(doc.scrollHeight, window.innerHeight)
    const root = document.createElement('div')
    root.id = '__guide_overlay'
    root.setAttribute('aria-hidden', 'true')
    Object.assign(root.style, {
      position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`,
      pointerEvents: 'none', zIndex: '2147483647',
    })
    if (spotlight && marks.length) {
      const ns = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(ns, 'svg')
      svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H))
      Object.assign(svg.style, { position: 'absolute', left: '0', top: '0' })
      const mask = document.createElementNS(ns, 'mask'); mask.id = '__guide_mask'
      const all = document.createElementNS(ns, 'rect')
      all.setAttribute('width', String(W)); all.setAttribute('height', String(H)); all.setAttribute('fill', 'white')
      mask.appendChild(all)
      for (const m of marks) {
        const hole = document.createElementNS(ns, 'rect')
        hole.setAttribute('x', String(m.x - m.pad)); hole.setAttribute('y', String(m.y - m.pad))
        hole.setAttribute('width', String(m.w + m.pad * 2)); hole.setAttribute('height', String(m.h + m.pad * 2))
        hole.setAttribute('rx', '12'); hole.setAttribute('fill', 'black')
        mask.appendChild(hole)
      }
      const defs = document.createElementNS(ns, 'defs'); defs.appendChild(mask); svg.appendChild(defs)
      const veil = document.createElementNS(ns, 'rect')
      veil.setAttribute('width', String(W)); veil.setAttribute('height', String(H))
      veil.setAttribute('fill', 'rgba(15, 28, 27, 0.2)'); veil.setAttribute('mask', 'url(#__guide_mask)')
      svg.appendChild(veil)
      root.appendChild(svg)
    }
    for (const m of marks) {
      const ring = document.createElement('div')
      Object.assign(ring.style, {
        position: 'absolute', left: `${m.x - m.pad}px`, top: `${m.y - m.pad}px`,
        width: `${m.w + m.pad * 2}px`, height: `${m.h + m.pad * 2}px`,
        border: `3px solid ${GOLD}`, borderRadius: '12px', boxSizing: 'border-box',
        boxShadow: '0 0 0 4px rgba(217, 162, 27, 0.22)',
      })
      root.appendChild(ring)
      const badge = document.createElement('div')
      badge.textContent = String(m.n)
      /* الرقمُ على الزاوية العليا من جهة البداية (اليمين) — حيث تبدأ العينُ العربيّة */
      const left = Math.min(W - 34, m.x + m.w + m.pad - 16)
      const top = Math.max(2, m.y - m.pad - 16)
      Object.assign(badge.style, {
        position: 'absolute', left: `${left}px`, top: `${top}px`, width: '30px', height: '30px',
        borderRadius: '999px', background: GOLD, color: INK, font: '700 16px/30px system-ui, sans-serif',
        textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', border: '2px solid #fff',
      })
      root.appendChild(badge)
    }
    /* على `html` لا `body`: الجسمُ مكبَّرٌ على الحاسوب (`zoom: var(--app-scale)`
       في `index.css`)، فإطارٌ يُلحَق به تُضرَب إحداثيّاتُه في المعامل فيقع على
       التبويب المجاور. والجذرُ غيرُ مكبَّر، وإحداثيّاتُ `boundingBox` منه. */
    document.documentElement.appendChild(root)
  }, { marks, spotlight, GOLD, INK })
}

/** PNG → WebP بعرضٍ أقصى — في صفحةٍ فارغةٍ من المتصفّح نفسِه */
async function toWebp(e: Engine, png: Buffer, maxWidth: number): Promise<{ data: Buffer; w: number; h: number }> {
  const scratch = await e.context.newPage()
  try {
    const out = await scratch.evaluate(async ({ b64, maxWidth }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      return { url: canvas.toDataURL('image/webp', 0.84), w, h }
    }, { b64: png.toString('base64'), maxWidth })
    return { data: Buffer.from(out.url.split(',')[1], 'base64'), w: out.w, h: out.h }
  } finally {
    await scratch.close()
  }
}

/* ═══ ما يُنزَع قبل كلّ لقطة ═══

   · **الشريطُ الملتصق** (`sticky`): اللقطةُ الكاملةُ تُرسم والصفحةُ مُمرَّرة،
     فيقع الرأسُ الملتصقُ في وسط لوحٍ اقتُطع من أسفلها. فيُردّ إلى موضعه في
     المستند قبل أن تُقاس الأهداف — فلا تتبدّل إحداثيّاتُها بعد القياس.
   · **رابطُ «تجاوز إلى المحتوى»**: يظهر لمن ركّز عليه، والتنقّلُ داخلَ التطبيق
     يضع التركيزَ فيه أحيانا — فيُرى فوق الصورة شريطٌ لا يراه المدرّب.
   · **حلقةُ التركيز** على آخر ما ضُغط. */
const CLEAN_CSS = `
  .sticky, [class*="sticky "], [style*="sticky"] { position: relative !important; top: auto !important; }
  .skip-link { display: none !important; }
  *:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }
`

async function clean(page: Page) {
  await page.evaluate((css) => {
    if (!document.getElementById('__guide_clean')) {
      const st = document.createElement('style')
      st.id = '__guide_clean'
      st.textContent = css
      document.head.appendChild(st)
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, CLEAN_CSS)
}

/** لقطةٌ واحدة: تأشيرٌ ثمّ اقتطاعٌ ثمّ حفظ — وتُسجَّل أبعادُها في البيان */
export async function shoot(e: Engine, spec: ShotSpec) {
  const page = e.page
  await clean(page)
  /* ═══ قياسٌ في مرورين لا مرور ═══

     التمريرُ إلى هدفٍ في أسفل الشاشة يبدّل شاشاتٍ تتبدّل بالتمرير (مُرقِّمُ
     خطوات الشعبة ينضغط سطرا واحدا)، فيتزحزح ما قيس قبله — وتقع الحلقةُ فوق
     فراغ. فيُمرَّر إلى كلّ هدفٍ أوّلا ليُحمَّل ما يُحمَّل كسولا، ثمّ يُعاد
     الإطارُ إلى أعلاه، ثمّ يُقاس الكلُّ معا والتخطيطُ ساكن.
     ولقطةُ إطار العرض يضعها نداؤها حيث يريد — فلا يُمرَّر فيها شيء. */
  if (spec.clip !== 'viewport') {
    for (const m of spec.marks ?? []) await m.target.first().scrollIntoViewIfNeeded()
    await spec.clip.first().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(350)
    /* ═══ ويُنتظر سكونُ التخطيط لا مهلةٌ ثابتة (٦ أكتوبر ٢٠٢٦) ═══
       المرقِّمُ يعود إلى سعته بانتقال — وصار أطولَ بأسماء خطواته. فكانت ٣٥٠ ملّيثانيةً
       تقيس والصفحةُ تنزل بعدُ، فوقعت الحلقاتُ في «ws-workbooks» فوق أهدافها بخمسةٍ
       وأربعين بكسلا. فيُقاس آخرُ الأهداف حتى يتطابق قياسان متتاليان. */
    const probe = spec.marks?.length ? spec.marks[spec.marks.length - 1].target : spec.clip
    let last = ''
    for (let i = 0; i < 20; i++) {
      const now = JSON.stringify(await measure(probe))
      if (now === last) break
      last = now
      await page.waitForTimeout(150)
    }
  }
  const marks = []
  for (const m of spec.marks ?? []) marks.push({ ...(await measure(m.target)), n: m.n, pad: m.pad ?? 6 })
  let clip: Rect
  if (spec.clip === 'viewport') {
    const vp = page.viewportSize()!
    const sy = await page.evaluate(() => window.scrollY)
    clip = { x: 0, y: sy, w: vp.width, h: vp.height }
  } else {
    const r = await measure(spec.clip)
    const pad = spec.clipPad ?? 16
    const docW = await page.evaluate(() => document.documentElement.scrollWidth)
    clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), w: 0, h: r.h + pad * 2 }
    clip.w = Math.min(docW - clip.x, r.w + pad * 2)
  }
  if (spec.maxHeight && clip.h > spec.maxHeight) clip.h = spec.maxHeight
  await drawOverlay(page, marks, spec.spotlight ?? marks.length > 0)
  const png = await page.screenshot({
    fullPage: true, type: 'png', animations: 'disabled',
    clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h },
  })
  await page.evaluate(() => document.getElementById('__guide_overlay')?.remove())
  const webp = await toWebp(e, png, spec.maxWidth ?? 2200)
  writeFileSync(join(e.outDir, `${spec.name}.webp`), webp.data)
  e.shots[spec.name] = { w: webp.w, h: webp.h }
  console.log(`   📸 ${spec.name}.webp  ${webp.w}×${webp.h}  ${(webp.data.length / 1024).toFixed(0)}KB`)
}
