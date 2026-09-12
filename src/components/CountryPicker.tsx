/* مُنتقيا الدولة — رمزُ الهاتف ودولةُ الإقامة، كلاهما يُبحث فيه بالاسم.

   ═══ ما كان ═══

   رمزُ الهاتف كان `<select>` فيه أحدَ عشرَ رمزا عربيّا، ودولةُ الإقامة
   `<select>` فيه تسعَ عشرةَ دولةً عربيّة. ومن يقدّم من خارجهما — وهم
   يقدّمون — لا يجد بلدَه أصلا.

   ═══ ولماذا لا `<select>` بمئتي خيار ═══

   قائمةُ المتصفّح المنسدلةُ لا بحثَ فيها إلّا القفزُ بأوّل حرفٍ تكتبه، وهو
   لا ينفع في مئتي سطر: من يريد «ماليزيا» يمرّ بعشرين دولةً تبدأ بالميم.
   ومن لا يحفظ أنّ رمزَها `+60` لن يجده بالرمز أبدا — وهذا هو طلبُ صاحب
   المنصّة بعينه: **يُبحث بالدولة لا بالرمز**.

   فهذا صندوقٌ يُكتب فيه فيُصفّي (`combobox`): يقبل الاسمَ العربيَّ
   والإنجليزيَّ ورمزَ الهاتف ورمزَ ISO، ويُطبّع الهمزاتِ فـ«الامارات»
   تجد «الإمارات».

   ═══ ولوحةُ المفاتيح ليست زينة ═══

   من يملأ نموذجا طويلا لا يرفع يدَه إلى الفأرة لكلّ حقل، وقارئُ الشاشة لا
   فأرةَ له أصلا: الأسهمُ تتنقّل، و`Enter` يختار، و`Escape` يطوي،
   و`aria-activedescendant` يُسمع الخيارَ المميَّز. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { controlCls } from '@/components/FormKit'
import { Inset } from '@/components/ui/Surface'
import {
  COUNTRIES_SORTED, countryByName, flagOf, searchCountries, type Country,
} from '@/data/countries'

/** خيارٌ إضافيٌّ يُذيَّل به المنتقي — «أخرى» في دولة الإقامة */
interface ExtraOption {
  value: string
  label: string
}

interface ComboboxProps {
  id: string
  /** ما يُعرض في الزرّ حين لا شيءَ مختار */
  placeholder: string
  /** وسمُ الزرّ لقارئ الشاشة */
  ariaLabel: string
  /** ما يُعرض في الزرّ الآن */
  button: ReactNode
  /** عرضُ الزرّ — الرمزُ ضيّقٌ بجانب حقل الرقم، والدولةُ تأخذ صفَّها */
  buttonCls: string
  selectedKey: string | null
  extra?: ExtraOption
  onPick: (country: Country | null, extraValue?: string) => void
}

function CountryCombobox({ id, placeholder, ariaLabel, button, buttonCls, selectedKey, extra, onPick }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => searchCountries(query), [query])
  /* «أخرى» تبقى آخرَ المعروض ولا تُصفّى إلّا حين يكتب المتقدّم شيئا لا
     يطابقها — فمن فتح القائمة يراها حيث كانت دائما. */
  const showExtra = Boolean(extra) && (query.trim() === '' || extra!.label.includes(query.trim()))
  const count = matches.length + (showExtra ? 1 : 0)

  /* الفتحُ والطيُّ يُصفّران البحثَ معهما — لا أثرٌ يفعلها بعد الرسم: ضبطُ
     الحالة داخلَ أثرٍ يُطلق رسمةً ثانيةً بلا داعٍ (وهو ما تمنعه قاعدةُ
     `react-hooks/set-state-in-effect`). والفعلُ يقع حيث وقع سببُه. */
  const close = () => { setOpen(false); setQuery(''); setActive(0) }
  const toggle = () => { if (open) close(); else { setQuery(''); setActive(0); setOpen(true) } }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [open])

  /* التركيزُ ينتقل إلى صندوق البحث فور الفتح: من فتح منتقيا فيه بحثٌ يريد
     أن يكتب، لا أن ينقر مرّتين. */
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  /* الخيارُ المميَّز يبقى مرئيّا وهو يتحرّك بالأسهم — وإلّا تحرّك خارج
     الصندوق وظنّ الكاتبُ أنّ الأسهم لا تعمل. */
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`#${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, id])

  const pickAt = (index: number) => {
    if (showExtra && index === matches.length) onPick(null, extra!.value)
    else if (matches[index]) onPick(matches[index])
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (count === 0 ? 0 : (i + 1) % count)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (count === 0 ? 0 : (i - 1 + count) % count)); return }
    if (e.key === 'Enter') { e.preventDefault(); pickAt(active); return }
  }

  const option = (key: string, index: number, selected: boolean, content: ReactNode) => (
    <button
      key={key} id={`${id}-opt-${index}`} type="button" role="option" aria-selected={selected}
      onClick={() => pickAt(index)} onMouseEnter={() => setActive(index)}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-right text-read font-bold leading-6 transition ${
        index === active ? 'bg-teal/15' : ''
      } ${selected ? 'text-teal-light-ink' : 'text-foreground'}`}
    >
      {content}
      {selected && <Check className="ms-auto h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />}
    </button>
  )

  return (
    <div className="relative" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button" id={id} aria-label={ariaLabel} aria-expanded={open} aria-haspopup="listbox"
        onClick={toggle}
        className={`${buttonCls} flex cursor-pointer items-center justify-between gap-1.5 text-right`}
      >
        <span className="truncate">{button ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-teal-light-ink transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        /* `tone="solid"` لا `bg-*` في `className`: أرضيّةُ الغاطس الافتراضيّة
           شفّافة، والصنفان يتنازعان في ورقة الأنماط — فتُقرأ الخياراتُ فوق
           ما تحتها في المظهر النهاريّ. (العلّةُ نفسُها في `MultiPick`.) */
        <Inset tone="solid" className="absolute z-30 mt-1.5 min-w-full max-w-[min(20rem,80vw)] p-1.5 shadow-xl shadow-black/20">
          <div className="relative mb-1.5">
            <Search aria-hidden="true" className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef} type="text" role="combobox" aria-expanded="true" aria-controls={`${id}-list`}
              aria-activedescendant={count > 0 ? `${id}-opt-${active}` : undefined}
              aria-label="ابحث عن دولة" placeholder="ابحث بالدولة أو الرمز…"
              value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              className="h-10 w-full rounded-lg border border-white/15 bg-paper/30 px-3 pe-8 text-read text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
            />
          </div>
          <div ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto">
            {count === 0 && <p className="px-3 py-4 text-center text-read leading-6 text-muted-foreground">لا دولةَ بهذا الاسم — جرّب اسمها بالإنجليزية</p>}
            {matches.map((c, i) => option(c.iso2, i, c.iso2 === selectedKey, (
              <>
                <span aria-hidden="true" className="shrink-0 text-base leading-none">{flagOf(c.iso2)}</span>
                <span className="truncate">{c.ar}</span>
                <span dir="ltr" className="shrink-0 font-mono text-read text-muted-foreground">{c.dial}</span>
              </>
            )))}
            {showExtra && option('__extra', matches.length, extra!.value === selectedKey, <span>{extra!.label}</span>)}
          </div>
        </Inset>
      )}
    </div>
  )
}

/** مُنتقي رمز الهاتف — يُخزَّن الرمزُ نفسُه (`+962`) كما كان يفعل `<select>` */
export function PhoneCodePicker({ id, value, onChange, className = '' }: {
  id: string; value: string; onChange: (dial: string) => void; className?: string
}) {
  /* الرمزُ وحدَه لا يعيّن دولةً: `+1` لأربعٍ و`+7` لاثنتين. فتُحفظ الدولةُ
     المختارةُ هنا للعرض، ويبقى المحفوظُ في النموذج الرمزَ — فلا يتغيّر ما
     يصل الخادمَ ولا ما في المسودّات القائمة. */
  const [iso, setIso] = useState<string | null>(null)
  const shown = useMemo(
    () => COUNTRIES_SORTED.find((c) => c.iso2 === iso) ?? COUNTRIES_SORTED.find((c) => c.dial === value) ?? null,
    [iso, value],
  )
  return (
    <CountryCombobox
      id={id}
      ariaLabel="رمز الدولة"
      placeholder="الرمز"
      buttonCls={`${className} px-2`}
      selectedKey={shown?.iso2 ?? null}
      button={shown
        ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-base leading-none">{flagOf(shown.iso2)}</span>
            <span dir="ltr" className="font-mono text-read">{shown.dial}</span>
          </span>
        )
        : 'الرمز'}
      onPick={(c) => { if (c) { setIso(c.iso2); onChange(c.dial) } }}
    />
  )
}

/** مُنتقي دولة الإقامة — يُخزَّن الاسمُ العربيُّ كما كان، و«أخرى» تبقى مفتوحة */
export function CountryPicker({ id, value, onChange, otherLabel = 'أخرى', className = controlCls }: {
  id: string; value: string; onChange: (name: string) => void; otherLabel?: string; className?: string
}) {
  const picked = countryByName(value)
  return (
    <CountryCombobox
      id={id}
      ariaLabel="دولة الإقامة"
      placeholder="اختر دولتك"
      buttonCls={className}
      selectedKey={picked?.iso2 ?? (value === otherLabel ? otherLabel : null)}
      extra={{ value: otherLabel, label: otherLabel }}
      button={picked
        ? (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base leading-none">{flagOf(picked.iso2)}</span>
            {picked.ar}
          </span>
        )
        : value || <span className="text-muted-foreground">اختر دولتك</span>}
      onPick={(c, extraValue) => onChange(c ? c.ar : extraValue ?? '')}
    />
  )
}
