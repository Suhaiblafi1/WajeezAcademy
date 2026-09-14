/* تقويمُ شهرٍ — يُعطى عناصرَه ولا يعرف شكلَها.

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من «جدولي»: قائمةٌ مبعثرةٌ لا تقويم.
   والقائمةُ تقول «متى» ولا تقول «أين أنا من الشهر»: من له جلستان يوم الأحد
   وثالثةٌ بعد أسبوعين يقرأ ثلاثةَ أسطرٍ ولا يرى أنّ أسبوعا بينها فارغ.

   والحسابُ ليس هنا — هو في `application/calendar/month-grid` حيث يُفحص. وهذا
   يصيّر ما يُعطى: لا يعرف ما الجلسةُ ولا من يقرؤها، فيصلح لجدول المدرّب
   ولجدول المتعلّم معا (ك-١١: «التقويمُ مكوّنٌ واحدٌ يُستعمل مرّتين»).

   وعلى الهاتف يبقى تقويما: سبعةُ أعمدةٍ لا تنهار إلى عمودٍ واحد — تقويمٌ
   بعمودٍ واحدٍ قائمةٌ بثوبِ تقويم. وتضيق الخانةُ ويصغر خطُّها، ويُكتفى في
   الضيّق بنقطةٍ تقول «هنا شيء». */
import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  WEEKDAYS_AR, monthGrid, monthOf, shiftMonth, type DayCell,
} from '@/application/calendar/month-grid'
import { fmtDateWith } from '@/application/text/format-ar'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Surface'

export default function MonthCalendar<T>({
  items, at, renderItem, isNext, initial, emptyAr,
}: {
  items: readonly T[]
  /** متى يقع هذا العنصر */
  at: (item: T) => Date
  /** كيف يُقرأ في خانته */
  renderItem: (item: T, opts: { isNext: boolean }) => ReactNode
  /** أيُّها «القادم» الذي يُميَّز — يُحسب عند النداء لا هنا */
  isNext?: (item: T) => boolean
  /** الشهرُ المفتوحُ أوّلا — الجاري إن لم يُعطَ */
  initial?: Date
  emptyAr?: string
}) {
  const [view, setView] = useState(() => monthOf(initial ?? new Date()))
  const grid = monthGrid(view.year, view.month, items, at)
  const titleAr = fmtDateWith(new Date(view.year, view.month, 1), { year: 'numeric', month: 'long' })
  const inMonth = grid.flat().reduce((n, c) => n + (c.inMonth ? c.items.length : 0), 0)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black">{titleAr}</h3>
        <div className="flex items-center gap-1">
          {/* في RTL يقود «السابق» إلى اليمين: الأيقونةُ تتبع الاتّجاه لا الاسم */}
          <Button tone="ghost" size="sm" aria-label="الشهر السابق"
            onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button tone="ghost" size="sm" onClick={() => setView(monthOf(new Date()))}>اليوم</Button>
          <Button tone="ghost" size="sm" aria-label="الشهر التالي"
            onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* الحاضنُ `Card` من نظام الأسطح لا صيغةٌ مكتوبةٌ بيدها — والخاناتُ
          ليست أسطحا بل خاناتُ شبكة: أرضيّةٌ وانحناءٌ صغيرٌ بلا حدّ. */}
      <Card>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS_AR.map((d) => (
            <div key={d} className="px-1 pb-1 text-center text-fine font-bold text-muted-foreground">
              {/* الحرفُ الأوّلُ على الهاتف: «الأربعاء» في خانةٍ بعرضِ إصبعٍ لا يُقرأ */}
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.replace(/^ال/, '').charAt(0)}</span>
            </div>
          ))}
          {grid.flat().map((cell: DayCell<T>) => (
            <div
              key={cell.date.toISOString()}
              aria-current={cell.isToday ? 'date' : undefined}
              className={
                'min-h-[4.5rem] rounded-lg p-1.5 sm:min-h-[6rem] '
                + (cell.inMonth ? 'bg-white/[0.04] ' : 'bg-white/[0.015] opacity-50 ')
                + (cell.isToday ? 'ring-1 ring-inset ring-teal/60' : '')
              }
            >
              <div className={`text-fine tabular-nums ${cell.isToday ? 'font-black text-teal-light-ink' : 'text-muted-foreground'}`}>
                {cell.date.getDate()}
              </div>
              <ul className="mt-1 space-y-1">
                {cell.items.map((item, i) => (
                  <li key={i}>{renderItem(item, { isNext: isNext?.(item) ?? false })}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* الشهرُ الفارغُ يُقال، فلا يُقرأ التقويمُ الخالي عطبا في التحميل */}
      {inMonth === 0 && emptyAr && (
        <p className="mt-3 text-center text-read leading-6 text-muted-foreground">{emptyAr}</p>
      )}
    </div>
  )
}
