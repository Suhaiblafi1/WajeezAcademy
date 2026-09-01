import { ChevronRight, ChevronLeft, Search } from "lucide-react";
import type { Page } from "@/application/admin/paginate";

type PageCounts = Omit<Page<unknown>, "rows">;

/** شريطُ قائمةٍ إداريّة: بحثٌ وترقيمٌ بمكانٍ واحد.

    أربعُ شاشاتٍ تعرض قوائمَ تطول (المستخدمون · الفواتير · التذاكر · طلبات
    المدربين)، وكانت كلُّها تُصبّ صفوفَها دفعةً واحدة: من أراد صفّا بعينه
    مرّره بعينه، ومن أراد عدَّها عدّها بإصبعه.

    وشريطٌ واحدٌ لأربعتها لا أربعةُ أشرطة: أيُّ تحسينٍ فيه — تطبيعُ الهمزة،
    لجمُ الصفحة، صيغةُ العدّ — يقع على الأربع معا. */
export default function ListToolbar({
  q, onQ, onPage, view, placeholder, unit = "صفّا",
}: {
  q: string;
  onQ: (next: string) => void;
  onPage: (next: number) => void;
  /* الصفوفُ لا تعني الشريطَ في شيء: يقرأ الأعدادَ وحدَها. ولو أخذ
     `Page<T>` لعجز عن قائمةٍ يختلف نوعُها بحسب ما يُستعرَض. */
  view: PageCounts;
  placeholder: string;
  unit?: string;
}) {
  /* لا مزامنةَ للصفحة هنا: `paginate` يلجمها في كلّ تصيير، والأزرارُ تتحرّك
     من `view.page` لا من `page`. فحالةٌ أبعدُ من الآخر لا تُرى ولا تُعطب،
     ومحاولةُ «تصحيحها» بنداءٍ أثناء التصيير تُعطب شجرةَ المكوّنات. */

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <label className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
        <input
          value={q}
          onChange={(e) => { onQ(e.target.value); onPage(1); }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border border-white/12 bg-black/30 py-2 pr-9 pl-3 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <span>
          {view.total === 0
            ? "لا نتائج"
            : `${view.from}–${view.to} من ${view.total} ${unit}`}
        </span>
        {view.pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPage(view.page - 1)}
              disabled={view.page <= 1}
              aria-label="الصفحة السابقة"
              className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/35 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">{view.page} / {view.pages}</span>
            <button
              onClick={() => onPage(view.page + 1)}
              disabled={view.page >= view.pages}
              aria-label="الصفحة التالية"
              className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/35 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
