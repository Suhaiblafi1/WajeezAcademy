/* «استورد من Word» — المحتوى النظريُّ دروسا بعناوينها (١١ أكتوبر ٢٠٢٦).

   الترجمةُ محضةٌ في `application/content/docx-to-body.ts`، وهنا فتحُ الملفّ وحده. وما
   في المحرّر لا يُمحى بلا كلمة: إن كان فيه نصٌّ قيل الفرقُ بين الخيارات واختار المدرّب
   — «استبدِل» أو «أضِف بعده» أو «ألغِ» (قرارُ صاحب المنصّة ٢ أكتوبر ٢٠٢٦: لا إجبار،
   بل الخياراتُ وأثرُ كلٍّ). */

import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import JSZip from 'jszip'
import Button from '@/components/ui/Button'
import { Inset } from '@/components/ui/Surface'
import { docxToBody } from '@/application/content/docx-to-body'
import { splitLessons } from '@/application/content/lesson-split'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export default function WordImport({ current, onImport, disabled = false, label }: {
  current: string
  onImport: (next: string) => void
  disabled?: boolean
  /** «المحور ٢» — لقارئ الشاشة */
  label: string
}) {
  const pick = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const read = async (file: File) => {
    setErr(null)
    try {
      const zip = await JSZip.loadAsync(file)
      const doc = await zip.file('word/document.xml')?.async('string')
      if (!doc) throw new Error('not docx')
      const body = docxToBody(doc, await zip.file('word/styles.xml')?.async('string'))
      if (!body.trim()) { setErr('لم يُوجد في الملفّ نصٌّ يُستورد.'); return }
      if (current.trim()) setPending(body)
      else onImport(body)
    } catch {
      setErr('تعذّرت قراءتُه — احفظه من Word بصيغة ‎.docx ثمّ أعد المحاولة.')
    }
  }

  const lessons = pending ? splitLessons(pending).filter((l) => l.title).length : 0
  return (
    <div className="mt-2">
      <input ref={pick} type="file" accept={`.docx,${DOCX}`} className="sr-only" aria-label={`استورد المحتوى النظريّ من Word — ${label}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
      <Button tone="ghost" size="sm" icon={FileUp} disabled={disabled} onClick={() => pick.current?.click()}>
        استورد من Word — كلُّ عنوانٍ درس
      </Button>
      {err && <p role="status" className="mt-1 text-read leading-6 text-gold-ink">{err}</p>}
      {pending !== null && (
        <Inset tone="warn" role="alertdialog" aria-label="في المحرّر نصٌّ — ماذا تفعل بالمستورد؟" className="mt-2 grid gap-2 text-read leading-6">
          <p className="font-black text-foreground">
            في المحرّر نصٌّ مكتوب، والمستوردُ {lessons > 0 ? `${lessons} ${lessons === 1 ? 'درس' : lessons === 2 ? 'درسان' : 'دروس'}` : 'بلا عناوين دروس'}. اختر:
          </p>
          <ul className="list-inside list-disc text-muted-foreground">
            <li><b className="text-foreground">استبدِل</b> — يحلّ المستوردُ محلَّ ما في المحرّر.</li>
            <li><b className="text-foreground">أضِف بعده</b> — يبقى ما كتبتَه، ويُلحق المستوردُ في آخره.</li>
            <li><b className="text-foreground">ألغِ</b> — لا يتغيّر شيء.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" onClick={() => { onImport(pending); setPending(null) }}>استبدِل</Button>
            <Button tone="secondary" size="sm" onClick={() => { onImport(`${current.trimEnd()}\n\n${pending}`); setPending(null) }}>أضِف بعده</Button>
            <Button tone="ghost" size="sm" onClick={() => setPending(null)}>ألغِ</Button>
          </div>
        </Inset>
      )}
    </div>
  )
}
