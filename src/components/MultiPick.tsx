/* ═══ اختيارٌ من متعدّد في قائمةٍ منسدلة (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «هذه الخاناتُ اجعلها اختيارا من متعدّدٍ من انسدال، لكي لا
   تأخذ مساحةً كبيرةً في الصفحة». كانت شبكةَ بطاقاتٍ (`OptionGrid`) بتسعة خياراتٍ
   واثني عشر — تملأ الشاشة. فصارت سطرا واحدا يقول ما اختير، ويُفتح فيُختار منه.

   والقائمةُ تُغلق بنقرةٍ خارجها من مستمعٍ على `document` لا من ستارةٍ `fixed`
   (العلّةُ في `tests/design/floating-surfaces.test.ts`)، وبـ Escape. */

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Inset } from '@/components/ui/Surface'
import { staffControlCls } from '@/components/FormKit'

export default function MultiPick({ items, isOn, onToggle, name, placeholder, disabled = false }: {
  items: readonly { value: string; label: string }[]
  isOn: (value: string) => boolean
  onToggle: (value: string) => void
  /** اسمُ السؤال — لقارئ الشاشة */
  name: string
  placeholder: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const picked = items.filter((it) => isOn(it.value))
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-label={name}
        onClick={() => setOpen(!open)}
        className={`${staffControlCls} flex items-center justify-between gap-2 text-start`}>
        <span className={`min-w-0 truncate ${picked.length ? 'text-foreground' : 'text-muted-foreground'}`}>
          {picked.length ? picked.map((it) => it.label).join('، ') : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <Inset tone="solid" role="listbox" aria-multiselectable="true" aria-label={name}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto p-1 shadow-lg">
          {items.map((it) => {
            const on = isOn(it.value)
            return (
              <button key={it.value} type="button" role="option" aria-selected={on}
                onClick={() => onToggle(it.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-read hover:bg-white/[0.06]">
                <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-teal bg-teal' : 'border-white/25'}`}>
                  {on && <Check className="h-3 w-3 text-surface" strokeWidth={3} />}
                </span>
                <span className={on ? 'font-bold text-foreground' : 'text-muted-foreground'}>{it.label}</span>
              </button>
            )
          })}
        </Inset>
      )}
    </div>
  )
}
