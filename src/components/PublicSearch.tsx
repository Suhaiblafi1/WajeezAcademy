/* بحثٌ للزائر — لوحُ البحث كان موجودا ومحجوبا على الموظّفين (البند ٣٢).

   ─────────── ما كان ───────────

   في المنصّة لوحُ بحثٍ كامل يُفتح بـ⌘K — **وحارسُه أن تملك صلاحيةً غيرَ
   صلاحيّات المتعلّم**. فالزائرُ الذي جاء يبحث عن دورةٍ لا يجده، وسبيلُه
   الوحيد أن يصل إلى `/courses` ثمّ يكتب في صندوقٍ داخلَ الصفحة. وثلاثُ
   نقراتٍ قبل أوّل حرف.

   ولوحُ الموظّفين لا يصلح له: يقرأ من الخادم طلباتِ المدرّبين والمستخدمين
   والتذاكرَ وكشوفَ المستحقّات — بيانات عملٍ لا كتالوج.

   ─────────── وما صار ───────────

   لوحٌ ثانٍ للزائر، **بلا خادمٍ إطلاقا**: الكتالوجُ محمَّلٌ في المتصفّح أصلا،
   فالبحثُ فيه لا يُنشئ نداءً ولا يكشف شيئا لا يُعرض في `/courses` و`/pathways`.
   وبالمطابقة نفسِها التي في صفحة الكتالوج — همزاتٌ و«أل» ومرادفات — فلا
   يختلف ما يجده الزائرُ هنا عمّا يجده هناك. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BookOpen, Route, Search, X } from 'lucide-react'
import { pathways } from '@/data/pathways'
import { courses } from '@/data/courses'
import { catalogRank, matchesCatalogQuery } from '@/application/catalog/catalog-search'
import { courseTitleAr } from '@/application/catalog/course-title'
import { usePublishedContent } from '@/services/public-content'

const MAX_PER_GROUP = 5

interface Hit { id: string; title: string; sub: string; to: string; kind: 'pathway' | 'course' }

export default function PublicSearch() {
  const catalogVersion = usePublishedContent()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  /* الإغلاقُ يمسح ما كُتب — في موضع الإغلاق نفسِه لا في أثرٍ يتبعه:
     مسحُ الحالة داخل `useEffect` تصييرٌ متتالٍ لا داعي له، وموضعُ الفعل
     أوضحُ من موضعِ ردّ الفعل. */
  const close = useCallback(() => {
    setOpen(false)
    setQ('')
    setCursor(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => {
          if (v) { setQ(''); setCursor(0) }
          return !v
        })
      } else if (e.key === 'Escape') close()
    }
    const onCustom = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('wajeez:open-public-search', onCustom)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wajeez:open-public-search', onCustom)
    }
  }, [close])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    if (!q.trim()) return []
    const pw = pathways
      .filter((p) => matchesCatalogQuery(q, [p.name, p.shortName, p.audience, p.transformation, p.output, ...p.coreSkills]))
      .map((p) => ({
        row: p,
        rank: catalogRank(q, [[p.name, p.shortName], [...p.coreSkills], [p.audience, p.transformation, p.output]]),
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, MAX_PER_GROUP)
      .map(({ row }): Hit => ({
        id: row.id, title: row.shortName, sub: `${row.courseCount} دورات · ${row.durationWeeks} أسبوعا`,
        to: `/pathways/${row.id}`, kind: 'pathway',
      }))
    const cs = courses
      .filter((c) => matchesCatalogQuery(q, [c.name, c.promise, c.audience, c.pathwayName, ...c.skills]))
      .map((c) => ({ row: c, rank: catalogRank(q, [[c.name], [c.promise, ...c.skills], [c.audience, c.pathwayName]]) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, MAX_PER_GROUP)
      .map(({ row }): Hit => ({
        id: row.id, title: courseTitleAr(row.name), sub: row.promise || row.pathwayName,
        to: `/build/${row.id}`, kind: 'course',
      }))
    return [...pw, ...cs]
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- رقمُ النسخة هو إشارةُ الإبطال الوحيدة: مصفوفاتُ الكتالوج تُملأ في مكانها بـ`splice` فلا تتغيّر هويّتُها، فحذفُ التبعيّة يجمّد أوّلَ لقطة */
  }, [q, catalogVersion])

  const go = useCallback((to: string) => {
    close()
    navigate(to)
  }, [close, navigate])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog" aria-modal="true" aria-label="ابحث في الكتالوج"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/12 bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); go(hits[cursor].to) }
            }}
            placeholder="ابحث عن مسارٍ أو دورة…"
            aria-label="ابحث عن مسارٍ أو دورة"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button onClick={close} aria-label="أغلق البحث" className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {!q.trim() ? (
            <p className="px-3 py-8 text-center text-xs leading-6 text-muted-foreground">
              اكتب ما تريد تعلّمَه — أو ما تريد تغييرَه في عملك.
              <br />
              ونفهم «اكسل» و«موارد بشرية» و«ai» كما تكتبها.
            </p>
          ) : hits.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs leading-6 text-muted-foreground">لا نتيجةَ لـ«{q}».</p>
              <Link
                to="/#diagnostic" onClick={close}
                className="mt-3 inline-flex rounded-full border border-teal/40 px-4 py-2 text-fine font-bold text-teal-light-ink hover:bg-teal/10"
              >
                لا تعرف ما تريد بعد؟ ابدأ بمؤشّر وجيز
              </Link>
            </div>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(h.to)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-right transition ${
                      i === cursor ? 'bg-teal/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {h.kind === 'pathway'
                      ? <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                      : <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground">{h.title}</span>
                      <span className="mt-0.5 block truncate text-fine text-muted-foreground">{h.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
