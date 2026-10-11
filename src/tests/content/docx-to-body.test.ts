/* استيرادُ المحتوى النظريّ من Word — دروسا بعناوينها (١١ أكتوبر ٢٠٢٦).

   يُبنى ملفُّ Word حقيقيٌّ بمكتبة `docx` (القائمةِ أصلا لقالب الكرّاسة) ويُفتح بـ`jszip`
   كما تفتحه الشاشة — فالمفحوصُ ما يُخرجه Word فعلا لا XML مكتوبٌ باليد وحدَه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { docxToBody, headingStyles } from '@/application/content/docx-to-body'
import { splitLessons } from '@/application/content/lesson-split'

async function bodyOf(doc: Document): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc))
  return docxToBody(await zip.file('word/document.xml')!.async('string'), await zip.file('word/styles.xml')?.async('string'))
}

describe('من Word إلى دروس', () => {
  it('⚠️ كلُّ عنوانٍ أوّلَ أو ثانٍ درس — وما تحته قسم — والعريضُ والقائمةُ يُحملان', async () => {
    const doc = new Document({
      numbering: { config: [{ reference: 'n', levels: [{ level: 0, format: 'bullet', text: '•' }] }] },
      sections: [{
        children: [
          new Paragraph({ text: 'قوة الصوت', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun('التنفّس '), new TextRun({ text: 'من الحجاب', bold: true }), new TextRun(' لا من الصدر.')] }),
          new Paragraph({ text: 'تمرينٌ يوميّ', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: 'شهيقٌ لأربع', numbering: { reference: 'n', level: 0 } }),
          new Paragraph({ text: 'زفيرٌ لثمان', numbering: { reference: 'n', level: 0 } }),
          new Paragraph({ text: 'مخارج الحروف', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: 'نطقُ الحروف بوضوح.' }),
        ],
      }],
    })
    const body = await bodyOf(doc)
    expect(body).toBe([
      '## قوة الصوت',
      'التنفّس **من الحجاب** لا من الصدر.',
      '### تمرينٌ يوميّ',
      '- شهيقٌ لأربع\n- زفيرٌ لثمان',
      '## مخارج الحروف',
      'نطقُ الحروف بوضوح.',
    ].join('\n\n'))
    expect(splitLessons(body).map((l) => l.title)).toEqual(['قوة الصوت', 'مخارج الحروف'])
  })

  it('والعنوانُ يُعرف باسم نمطه لا بمعرّفه — Word العربيُّ يسمّي المعرّفَ «1»', () => {
    const styles = '<w:styles><w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="a"><w:name w:val="Normal"/></w:style></w:styles>'
    expect([...headingStyles(styles)]).toEqual([['1', 1]])
    const doc = '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>المقدّمة</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">نصٌّ &amp; شرح</w:t></w:r></w:p></w:body></w:document>'
    expect(docxToBody(doc, styles)).toBe('## المقدّمة\n\nنصٌّ & شرح')
  })

  it('وملفٌّ بلا عناوين يبقى فقراتٍ — لا يُختلق له درس', () => {
    const doc = '<w:document><w:body><w:p><w:r><w:t>سطرٌ أوّل</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>سطرٌ ثانٍ</w:t></w:r></w:p></w:body></w:document>'
    expect(docxToBody(doc, null)).toBe('سطرٌ أوّل\n\nسطرٌ ثانٍ')
  })
})

describe('في الشاشة — لا يُمحى ما كُتب بلا كلمة', () => {
  const strip = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
  it('في كلّ محورٍ زرُّ الاستيراد تحت المحرّر', () => {
    expect(strip('src/pages/trainer/CohortWorkspace.tsx')).toMatch(/<WordImport current=\{m\.bodyAr \?\? ""\}[\s\S]{0,200}onImport=\{\(next\) => setModule\(i, \{ bodyAr: next \}\)\}/)
  })
  it('⚠️ وفي المحرّر نصٌّ: ثلاثةُ خياراتٍ بأثر كلٍّ — لا استبدالٌ صامت', () => {
    const W = strip('src/components/WordImport.tsx')
    expect(W).toContain('if (current.trim()) setPending(body)')
    for (const b of ['استبدِل', 'أضِف بعده', 'ألغِ']) expect(W).toContain(`>${b}</Button>`)
  })
})
