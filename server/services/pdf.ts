/* توليدُ PDF — صفحةُ HTML تُطبع في متصفّحٍ بلا نافذة.

   ═══ لماذا متصفّحٌ ولا مكتبةُ PDF ═══

   العربيّةُ تُكتب متّصلةً: الحرفُ يتبدّل شكلُه بحسب موضعه، والسطرُ يُقرأ من
   اليمين، والأرقامُ داخلَه تُقرأ من اليسار. ومكتباتُ PDF في JavaScript
   (`pdfkit`، `pdf-lib` وأمثالُهما) تكتب الحروفَ كما تصلها: منفصلةً معكوسةَ
   الترتيب. والناتجُ **ملفٌّ يُفتح ولا يُقرأ** — وهو أسوأُ من إخفاقٍ صريح،
   لأنّه يبلغ لجنةَ المراجعة قبل أن يعرف أحدٌ أنّه معطوب.

   والمتصفّحُ يحسن هذا كلَّه (إنّه عملُه)، ومعه ورقةُ أنماطٍ نكتبها فيخرج
   الملفُّ بهيئة المنصّة لا بهيئةٍ افتراضيّة.

   ═══ وثمنُه معلَنٌ وموضعُه مختار ═══

   Chromium في الصورة (`Dockerfile`) نحوُ ثلث غيغابايت، ويأخذ ثوانيَ وذاكرةً
   عند كلّ توليد. وهذا مقبولٌ هنا **لأنّ التوليدَ نادر**: مرّةً عند كلّ
   مقابلةٍ تُحجز، لا في كلّ طلب.

   ⚠️ ولا يُنادى هذا في مسارٍ يخدم مستخدما ينتظر، ولا في حلقة.

   ═══ وإن غاب المتصفّح ═══

   `playwright` في `devDependencies`، والصورةُ تثبّت الاعتماديات كلَّها
   (مكتوبٌ في رأس `Dockerfile` ولماذا). لكنّ من شغّل الخادمَ بـ`--omit=dev`
   أو على جهازٍ بلا Chromium يبقى بلا مولّد — فيُعاد `null` ولا يُرمى:
   الرسالةُ تخرج بلا ملفّها ومعها سببُه، ولا تسقط المقابلةُ لأجل مرفق. */

import { access } from 'node:fs/promises'

/* مواضعُ Chromium المحتملة — حزمةُ Alpine أوّلا (وهي ما تثبّته صورتُنا)،
   ثمّ ما يضبطه المشغّل صراحةً. */
const CHROMIUM_PATHS = ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome']

async function chromiumPath(): Promise<string | undefined> {
  const explicit = process.env.CHROMIUM_PATH?.trim()
  if (explicit) return explicit
  for (const p of CHROMIUM_PATHS) {
    try {
      await access(p)
      return p
    } catch { /* المسارُ التالي */ }
  }
  /* بلا مسارٍ معلوم: يُترك لـPlaywright متصفّحُه المنزَّل إن وُجد */
  return undefined
}

export interface PdfResult {
  pdf: Buffer | null
  /** سببُ الغياب بالعربيّة — يُسجَّل في الأثر ويُقال في الرسالة، ولا يُبتلع */
  error?: string
}

/** يطبع HTML في ملفّ PDF بمقاس A4. لا يرمي أبدا: الغيابُ يُعاد لا يُرفع. */
export async function renderPdf(html: string): Promise<PdfResult> {
  let browser: { close: () => Promise<void> } | null = null
  try {
    const { chromium } = await import('playwright')
    const executablePath = await chromiumPath()
    browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      /* `--no-sandbox` لازمٌ داخل الحاوية: لا مساحةَ أسماءٍ للمستخدم فيها */
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await (browser as import('playwright').Browser).newPage()
    /* `setContent` لا `goto`: لا خادمَ يُرفع ولا ملفَّ يُكتب على القرص.
       و`waitUntil: 'load'` يكفي — الصفحةُ بلا شبكةٍ أصلا (الخطوطُ من النظام). */
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    })
    return { pdf: Buffer.from(pdf) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { pdf: null, error: `تعذّر توليد PDF: ${msg}` }
  } finally {
    await browser?.close().catch(() => { /* إغلاقٌ فاشلٌ لا يُفسد ناتجا نجح */ })
  }
}
