/* ═══ استيرادُ المحتوى النظريّ من Word — دروسا بعناوينها (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «استيرادُ المحتوى النظريّ من
   Word: يُقسَّم إلى دروسٍ حسب العناوين، بدلَ الكتابة داخل خانة نصّ».

   والمتنُ عندنا Markdown مقيَّد (`LessonBody`)، وكلُّ `## ` فيه درس (`lesson-split.ts`).
   فالاستيرادُ ترجمةٌ من بنية Word إلى هذه الصيغة، لا لصقُ نصٍّ مسطّح:
     · «العنوان» و«عنوان ١» و«عنوان ٢» ← `## ` — كلٌّ درس.
     · «عنوان ٣» فما دونه ← `### ` — قسمٌ داخل درسه.
     · فقرةٌ في قائمة ← `- `، والعريضُ والمائلُ ← `**` و`*`.
   والعنوانُ يُعرف من **اسم نمطه الداخليّ** في `styles.xml` (`heading 1`… — ثابتٌ
   في كلّ لغات Word) لا من معرّفه الذي قد يكون «1» في نسخةٍ عربيّة، ومن مستوى
   المخطّط (`outlineLvl`) إن كُتب على الفقرة نفسِها.

   ولماذا تعابيرُ نمطيّةٌ لا محلّلُ XML: يُستدعى في المتصفّح وفي الاختبار (Node بلا
   `DOMParser`)، وما يُقرأ هنا أربعةُ وسومٍ لا غير. والمحضُ هنا، وفتحُ الملفّ (zip)
   في الشاشة بـ`jszip` القائمة أصلا. */

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const attr = (xml: string, tag: string): string | null => {
  const m = new RegExp(`<w:${tag}\\b[^>]*\\bw:val="([^"]*)"`).exec(xml)
  return m ? m[1]! : null
}

/** مستوى العنوان لكلّ نمطٍ من `styles.xml` — ١ للعنوان والعنوان الأوّل، وهكذا */
export function headingStyles(stylesXml: string | null | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (!stylesXml) return out
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const id = m[1]!
    const name = (attr(m[2]!, 'name') ?? '').toLowerCase()
    const h = /^heading\s*(\d)$/.exec(name)
    if (h) out.set(id, Number(h[1]))
    else if (name === 'title') out.set(id, 1)
    else {
      const lvl = attr(m[2]!, 'outlineLvl')
      if (lvl !== null && /^\d$/.test(lvl)) out.set(id, Number(lvl) + 1)
    }
  }
  return out
}

/** نصُّ الفقرة بعلاماتها — العريضُ والمائلُ من خصائص كلّ مقطع */
function paragraphText(p: string): string {
  let out = ''
  for (const r of p.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const run = r[1]!
    const props = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? ''
    let text = ''
    for (const t of run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      text += t[1] !== undefined ? decode(t[1]) : t[0] === '<w:tab/>' ? ' ' : '\n'
    }
    if (!text.trim()) { out += text; continue }
    const on = (tag: string) => new RegExp(`<w:${tag}(?:\\s+w:val="(?:1|true|on)")?\\s*/>`).test(props)
    const lead = text.match(/^\s*/)![0]
    const trail = text.match(/\s*$/)![0]
    let core = text.trim()
    if (on('b')) core = `**${core}**`
    else if (on('i')) core = `*${core}*`
    out += `${lead}${core}${trail}`
  }
  /* عريضان متجاوران يُدمجان: «**أ****ب**» ← «**أب**» */
  return out.replace(/\*\*\*\*/g, '').replace(/[ \t]+/g, ' ').trim()
}

/**
 * متنُ الدروس من `document.xml` — عنوانٌ من المستوى الأوّل أو الثاني يبدأ درسا (`## `)،
 * وما تحته قسمٌ (`### `). والعنوانُ لا تُحمل علاماتُه: يُعرض في شريط الدروس.
 */
export function docxToBody(documentXml: string, stylesXml?: string | null): string {
  const styles = headingStyles(stylesXml)
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml)?.[1] ?? documentXml
  const blocks: string[] = []
  for (const m of body.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g)) {
    const p = m[1] ?? ''
    const ppr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(p)?.[1] ?? ''
    const text = paragraphText(p)
    if (!text) continue
    const style = attr(ppr, 'pStyle')
    const outline = attr(ppr, 'outlineLvl')
    const level = (style ? styles.get(style) : undefined) ?? (outline !== null && /^\d$/.test(outline) ? Number(outline) + 1 : undefined)
    if (level !== undefined) {
      const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
      blocks.push(`${level <= 2 ? '##' : '###'} ${plain}`)
    } else if (/<w:numPr>/.test(ppr)) {
      blocks.push(`- ${text}`)
    } else {
      blocks.push(text)
    }
  }
  /* بنودُ القائمة المتتالية سطرٌ لكلٍّ بلا فراغ — وما سواها فقراتٌ بينها سطرٌ فارغ */
  return blocks.reduce((acc, b, i) => {
    if (i === 0) return b
    const listy = b.startsWith('- ') && blocks[i - 1]!.startsWith('- ')
    return `${acc}${listy ? '\n' : '\n\n'}${b}`
  }, '').trim()
}
