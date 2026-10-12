/* الملفُّ المضغوطُ يُفتح في الصندوق لا على الجهاز (١١ أكتوبر ٢٠٢٦).

   حزمةُ التقارير الاثنين والأربعين بأسمائها العربيّة الطويلة ردّتها أداةُ الفكّ في جهاز صاحب
   المنصّة («Unable to expand … Error 94 - Bad message»)، مضغوطةً بـzip ثمّ بـtar.gz. فقرارُه:
   يُسقط الملفُّ المضغوطُ في صندوق «تقاريرُ المراجعة دفعةً واحدة» كما هو، ويُفتح هنا في المتصفّح،
   وكلُّ ما فيه يمرّ بالمطابقة نفسِها (`review-reports-bulk.ts`) كأنّه اختير ملفّا ملفّا.

   - ما ليس PDF ولا Word في الحزمة يُترك ويُعَدّ — لا يُرفع ولا يُردّ واحدا واحدا.
   - ونسخةُ Word من ملفٍّ PDF في الحزمة نفسِها تُترك: الوثيقةُ نفسُها بصيغتين لا تصل المدرّبَ مرّتين.
   - وبقايا ماك (`__MACOSX/`، `._…`) ليست ملفّات.

   بلا React — يقرؤه الصندوق، ويحرسه `src/tests/trainer/review-reports-zip.test.ts`. */

import { reportMime } from './review-reports-bulk'

export type ExpandedReports = {
  /** ما يُطابَق ويُرفع — ملفّاتٌ اختيرت كما هي، وما خرج من الحِزَم */
  files: File[]
  /** حزمةٌ لم تُفتح — بسببها */
  problems: { name: string; problemAr: string }[]
  /** ما تُرك من الحِزَم: ليس PDF ولا Word، أو نسخةُ Word لـPDF فيها */
  skipped: { other: number; wordTwins: number }
}

export function isZipFile(name: string, type: string): boolean {
  return /\.zip$/i.test(name) || type === 'application/zip' || type === 'application/x-zip-compressed'
}

const REPORT_EXT = /\.(pdf|docx)$/i
const MAC_JUNK = /(^|\/)(__MACOSX\/|\._)/
const stem = (name: string) => name.replace(/\.[^.]+$/, '')

/** يفتح ما كان مضغوطا ويُبقي الباقي كما هو — والترتيبُ ترتيبُ الاختيار ثمّ ترتيبُ الحزمة */
export async function expandReportFiles(files: readonly File[]): Promise<ExpandedReports> {
  const out: ExpandedReports = { files: [], problems: [], skipped: { other: 0, wordTwins: 0 } }
  for (const file of files) {
    if (!isZipFile(file.name, file.type)) { out.files.push(file); continue }
    let entries: { name: string; read: () => Promise<ArrayBuffer> }[]
    try {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      entries = Object.values(zip.files)
        .filter((e) => !e.dir && !MAC_JUNK.test(e.name))
        .map((e) => ({ name: e.name.split('/').pop() ?? e.name, read: () => e.async('arraybuffer') }))
    } catch {
      out.problems.push({ name: file.name, problemAr: 'تعذّر فتح الملفّ المضغوط — لعلّه لم يكتمل تنزيله. نزّله ثانية، أو اختر ملفّاته واحدا واحدا' })
      continue
    }
    const reports = entries.filter((e) => REPORT_EXT.test(e.name))
    out.skipped.other += entries.length - reports.length
    const pdfStems = new Set(reports.filter((e) => /\.pdf$/i.test(e.name)).map((e) => stem(e.name)))
    for (const e of reports) {
      if (/\.docx$/i.test(e.name) && pdfStems.has(stem(e.name))) { out.skipped.wordTwins += 1; continue }
      out.files.push(new File([await e.read()], e.name, { type: reportMime(e.name, '') }))
    }
  }
  return out
}

/** سطرُ ما تُرك من الحِزَم — فارغٌ إن لم يُترك شيء */
export function skippedLineAr(s: ExpandedReports['skipped']): string {
  const parts: string[] = []
  if (s.wordTwins > 0) parts.push(`${s.wordTwins} نسخة Word لملفّات PDF فيها (رفع الـPDF وحده)`)
  if (s.other > 0) parts.push(`${s.other} ليست PDF ولا Word`)
  return parts.length ? `ترك من الملفّ المضغوط: ${parts.join('، و')}.` : ''
}
