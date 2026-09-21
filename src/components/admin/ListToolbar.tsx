import { ChevronRight, ChevronLeft, Search } from "lucide-react";
import type { Page } from "@/application/admin/paginate";

type PageCounts = Omit<Page<unknown>, "rows">;

/** شريطُ قائمةٍ إداريّة: بحثٌ وترقيمٌ بمكانٍ واحد.

    أربعُ شاشاتٍ تعرض قوائمَ تطول (المستخدمون · الفواتير · التذاكر · طلبات
    المدربين)، وكانت كلُّها تُصبّ صفوفَها دفعةً واحدة: من أراد صفّا بعينه
    مرّره بعينه، ومن أراد عدَّها عدّها بإصبعه.

    وشريطٌ واحدٌ لأربعتها لا أربعةُ أشرطة: أيُّ تحسينٍ فيه — تطبيعُ الهمزة،
    لجمُ الصفحة، صيغةُ العدّ — يقع على الأربع معا. (وهي أربعَ عشرةَ اليومَ
    لا أربعا.)

    ═══ وعددُ الصفوف اختياريٌّ لا مفروض (٢٠ سبتمبر ٢٠٢٦) ═══

    قال صاحبُ المنصّة: «اجعلنا نختار عدد الخانات التي تظهر في الصفحة
    الواحدة». وهو حقٌّ في كلّ قائمةٍ تطول — غير أنّ كلَّ شاشةٍ تملك حالةَ
    صفحتها وحدَها، فلو فُرض الخيارُ لَوجب تعديلُ أربعَ عشرةَ شاشةً في نفَسٍ
    واحدٍ لتسكينِ نوعٍ.

    فـ`size` و`onSize` معا أو لا شيء: من مرّرهما رأى المُبدِّل، ومن لم
    يمرّرهما بقي شريطُه حرفا بحرف كما كان. وتبنّيه سطرٌ في كلّ شاشةٍ متى
    أُريد — لا نشرةٌ واحدةٌ تمسّ أربعَ عشرةَ. */
/** ما يُعرض في المُبدِّل — وثلاثةٌ تكفي: ما يُمسح بالعين، وما يُفرز، وما يُمشَّط */
export const PAGE_SIZES = [25, 50, 100] as const;

export default function ListToolbar({
  q, onQ, onPage, view, placeholder, unit = "صفّا", size, onSize,
}: {
  q: string;
  onQ: (next: string) => void;
  onPage: (next: number) => void;
  /** عددُ الصفوف في الصفحة — مع `onSize` معا، أو لا مُبدِّلَ أصلا */
  size?: number;
  onSize?: (next: number) => void;
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
        <Search className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={q}
          onChange={(e) => { onQ(e.target.value); onPage(1); }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border border-white/12 bg-paper/30 py-2 pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2 text-fine text-muted-foreground">
        {size != null && onSize && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">عددُ الصفوف في الصفحة</span>
            <select
              value={size}
              onChange={(e) => { onSize(Number(e.target.value)); onPage(1); }}
              aria-label="عددُ الصفوف في الصفحة"
              className="cursor-pointer rounded-lg border border-white/12 bg-paper/30 px-2 py-1 text-fine text-foreground focus:border-teal focus:outline-none [&>option]:bg-surface"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} في الصفحة</option>)}
            </select>
          </label>
        )}
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
              className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-muted-foreground transition hover:border-white/35 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">{view.page} / {view.pages}</span>
            <button
              onClick={() => onPage(view.page + 1)}
              disabled={view.page >= view.pages}
              aria-label="الصفحة التالية"
              className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-muted-foreground transition hover:border-white/35 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
