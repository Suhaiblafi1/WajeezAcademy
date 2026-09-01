import { Loader2, X } from "lucide-react";

/** شريطُ الإجراء الجماعيّ — يظهر بالتحديد ويقول على كم يقع.

    و«على كم» ليس تزيينا: التحديدُ يبقى عبر الصفحات والبحث، فمن حدّد ثمانيةً
    في الصفحة الأولى ثمّ بحث فرأى صفّين، يجب أن يقرأ «٨ محدَّدا» لا «٢» قبل
    أن يضغط. */
export default function BulkBar({
  count, busy, progress, onClear, children,
}: {
  count: number;
  busy: boolean;
  progress: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-gold/35 bg-gold/[0.07] px-4 py-3">
      <span className="text-xs font-black text-gold-ink">
        {count} محدَّدا
        {busy && progress ? <span className="mr-2 font-normal text-white/55">{progress}</span> : null}
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-gold-ink" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
      <button onClick={onClear} disabled={busy}
        className="mr-auto flex cursor-pointer items-center gap-1 text-[11px] font-bold text-white/50 hover:text-white/80 disabled:opacity-40">
        <X className="h-3 w-3" /> ألغِ التحديد
      </button>
    </div>
  );
}
