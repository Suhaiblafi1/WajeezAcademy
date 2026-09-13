/* محرّرُ المتن — شريطُ صيغةٍ ومعاينةٌ حيّة.

   ═══ لماذا لا محرّرٌ غنيٌّ حقيقيّ ═══

   المتنُ يُصيَّر عند المتعلّم بـ`LessonBody`: Markdown مقيَّدٌ يُحوَّل إلى
   عناصر React مباشرةً، بلا `dangerouslySetInnerHTML` — فحقنُ HTML مستحيلٌ
   بنيويّا لا بالتنقية. ومحرّرٌ غنيٌّ (contentEditable) يُخرج HTML، فيلزمه
   منقٍّ وقائمةُ حجبٍ وثقةٌ بها — وهو بالضبط ما تخلّصت منه هذه المنصّة.

   فالمحرّرُ هنا يبقى على النصّ، ويضيف شيئين لا ثالثَ لهما:
   · **شريطٌ يُدرج العلاماتِ** — فلا يحتاج المدرّبُ حفظَ صيغةٍ عن ظهر قلب.
   · **معاينةٌ بـ`LessonBody` نفسِه** — لا بنسخةٍ تشبهه. فما يراه المدرّبُ
     هو ما يراه متعلّمُه حرفا بحرف، وإلّا صارت المعاينةُ وعدا يُخلَف. */

import { useRef, useState } from 'react'
import { applyMark, BODY_MARKS, type BodyMark } from '@/application/content/body-marks'
import { Bold, Code, Eye, Italic, Link2, List, Pencil, Quote, Type } from 'lucide-react'
import LessonBody from '@/components/LessonBody'
import { staffControlCls } from '@/components/FormKit'
import { Inset } from '@/components/ui/Surface'

/* الأيقوناتُ وحدَها هنا — والعلاماتُ وإدراجُها في الطبقة المحضّة */
const ICONS: Record<string, typeof Bold> = {
  h2: Type, bold: Bold, italic: Italic, list: List, quote: Quote, code: Code, link: Link2,
}

export default function BodyEditor({
  value,
  onChange,
  disabled = false,
  rows = 6,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  rows?: number
  ariaLabel: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  const insert = (mark: BodyMark) => {
    const el = ref.current
    if (!el) return
    const { value: next, cursor } = applyMark(value, el.selectionStart, el.selectionEnd, mark)
    onChange(next)
    /* المؤشّرُ يُعاد بعد أن تُصيَّر القيمةُ الجديدة — وإلّا وضعه React
       في آخر النصّ فيفقد المدرّبُ موضعَه مع كلّ إدراج. */
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {BODY_MARKS.map((m) => {
          const Icon = ICONS[m.id] ?? Type
          return (
          <button
            key={m.id}
            type="button"
            disabled={disabled || preview}
            onClick={() => insert(m)}
            title={m.label}
            aria-label={m.label}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/5 hover:text-teal-light-ink disabled:opacity-40"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          aria-pressed={preview}
          className="btn-outline-brand mr-auto flex h-9 items-center gap-1.5 px-3 text-read"
        >
          {preview ? <><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> عُد للكتابة</> : <><Eye className="h-3.5 w-3.5" aria-hidden="true" /> عايِنْ كما يراه المتعلّم</>}
        </button>
      </div>

      {preview ? (
        value.trim() ? (
          /* المعاينةُ بمكوّن المتعلّم نفسِه — لا بنسخةٍ تشبهه */
          <Inset className="px-4 py-3"><LessonBody body={value} /></Inset>
        ) : (
          <Inset as="p" className="px-4 py-6 text-center text-read text-muted-foreground">
            لا متنَ بعد — اكتب شيئا لتراه كما يراه متعلّمك.
          </Inset>
        )
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel}
          className={`${staffControlCls} leading-7`}
          placeholder="اكتب الشرحَ الذي يقرؤه متعلّمك. ابدأ كلَّ درسٍ بعنوانٍ من الشريط أعلاه."
        />
      )}
    </div>
  )
}
