/* ═══ قراءةُ فهرس الكرّاسة من ملفّها PDF — في المتصفّح، عند النقر وحدَه (١١ أكتوبر ٢٠٢٦) ═══

   المكتبةُ (`pdfjs-dist`، نحو ١٫٧ ميغابايت مع عاملها) تُحمَّل بـ`import()` حين يطلب
   المدرّبُ الاقتراح — فلا تثقل حزمةَ الصفحة لمن لا يطلبه. والعاملُ ملفٌّ من الموقع نفسِه
   (`worker-src 'self'` في `deploy/Caddyfile`). والمطابقةُ المحضةُ في `workbook-toc.ts`. */

import { startsFromOutline, startsFromText, wherePages, type TocModule } from './workbook-toc'

/** حدُّ الصفحات التي يُقرأ نصُّها حين لا فهرسَ للملفّ — كرّاسةٌ أطولُ من هذا نادرة */
const MAX_TEXT_PAGES = 400
const API_BASE: string = import.meta.env.VITE_API_URL ?? ''

export async function suggestWorkbookPages(storageKey: string, modules: readonly TocModule[]): Promise<Map<string, string>> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const res = await fetch(`${API_BASE}/api/v1/cohort-files/${encodeURIComponent(storageKey)}`, { credentials: 'include' })
  if (!res.ok) throw new Error('fetch')
  /* ولا `eval` — سياسةُ الموقع (CSP) لا تسمح به */
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()), isEvalSupported: false }).promise
  try {
    /* ١) الفهرس — مسطَّحا بعمقه كلِّه */
    const entries: { title: string; page: number }[] = []
    type Node = { title: string; dest: unknown; items?: Node[] }
    const walk = async (nodes: Node[] | null) => {
      for (const n of nodes ?? []) {
        try {
          const dest = typeof n.dest === 'string' ? await doc.getDestination(n.dest) : (n.dest as unknown[] | null)
          const ref = dest?.[0]
          if (ref && typeof ref === 'object') entries.push({ title: n.title, page: (await doc.getPageIndex(ref as never)) + 1 })
          else if (typeof ref === 'number') entries.push({ title: n.title, page: ref + 1 })
        } catch { /* وجهةٌ لا تُفكّ — تُتخطّى */ }
        await walk(n.items ?? null)
      }
    }
    await walk((await doc.getOutline()) as Node[] | null)
    let starts = startsFromOutline(entries, modules)

    /* ٢) وإلّا فنصُّ الصفحات */
    if (starts.size === 0) {
      const pages: string[] = []
      for (let i = 1; i <= Math.min(doc.numPages, MAX_TEXT_PAGES); i += 1) {
        const tc = await (await doc.getPage(i)).getTextContent()
        pages.push(tc.items.map((x) => ('str' in x ? x.str : '')).join(' '))
      }
      starts = startsFromText(pages, modules)
    }
    return wherePages(starts, doc.numPages)
  } finally {
    void doc.destroy()
  }
}
