import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

/* ─────────── Toast موحد لكل البوابات ───────────

   استدعِ toast("رسالة") من أي مكان — تظهر ثوانٍ ثم تختفي، وتتراكب عند التعدد.

   ═══ ولماذا صار له نوعٌ ثالث: الفشل ═══

   كان له نوعان: `success` و`info` — **ولا نوعَ للفشل**. فكلُّ إخفاقٍ في
   المنصّة كان يُعرض في حالةٍ محلّيّةٍ داخل الشاشة نفسِها (`flash` في اثنتَين
   وعشرين شاشة)، في موضعٍ مختلفٍ في كلّ واحدة: سطرٌ صغيرٌ داخل بطاقةٍ هنا،
   وشريطٌ فوق جدولٍ هناك، ونصٌّ بجانب زرٍّ في ثالثة. فالموظّفُ يضغط ثمّ
   **يبحث بعينه عن الجواب** — وقد يكون خارجَ ما يراه من الصفحة.

   والأسوأُ أنّ النجاحَ والفشلَ كانا في تلك الشاشات نصّا واحدا بلونٍ واحد:
   «حُدّثت الأدوار» و«فشل الإجراء» يظهران متشابهَين في الموضع نفسِه.

   فثلاثةُ فروقٍ بين الفشل وغيره، وكلُّها مقصودة:
   • لونٌ ونبرةٌ يُقرآن قبل النصّ.
   • عمرٌ أطول (عشرُ ثوانٍ لا أربع): الخطأُ يُقرأ ويُفهَم، والنجاحُ يُلمَح.
   • `role="alert"` لا `aria-live="polite"`: يُقاطِع قارئَ الشاشة، فلا يمضي
     المستخدمُ يعمل على ظنّ النجاح. */

export type ToastKind = "success" | "info" | "error";
interface ToastItem { id: number; text: string; kind: ToastKind; }

const EVENT = "wajeez:toast";
/** عمرُ كلّ نوع — الفشلُ يبقى ليُقرأ */
const LIFE_MS: Record<ToastKind, number> = { success: 4_000, info: 6_000, error: 10_000 };

// eslint-disable-next-line react-refresh/only-export-components -- ناقل أحداث خالص بلا حالة؛ بقاؤه بجانب المضيف مقصود
export function toast(text: string, kind: ToastKind = "success") {
  const clean = text.trim();
  if (!clean) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text: clean, kind } }));
}

/** إخفاقٌ يُقرأ — رسالةُ الخادم بلغتها إن وُجدت، لا «فشل الإجراء» وحدَها */
// eslint-disable-next-line react-refresh/only-export-components -- كما فوق
export function toastError(text: string) {
  toast(text, "error");
}

let seq = 0;

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail;
      const id = ++seq;
      setItems((list) => {
        /* الرسالةُ نفسُها بضغطتَين متلاحقتَين لا تُكرَّر سطرَين */
        const withoutDuplicate = list.filter((t) => !(t.text === text && t.kind === kind));
        return [...withoutDuplicate.slice(-2), { id, text, kind }];
      });
      window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), LIFE_MS[kind] ?? 4_000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  const TONE: Record<ToastKind, { cls: string; icon: typeof CheckCircle2 }> = {
    success: { cls: "border-[#38A7B4]/50 bg-paneldeep/95 text-[#6EC7D1]", icon: CheckCircle2 },
    info: { cls: "border-[#FABC05]/50 bg-warm2/95 text-[#FABC05]", icon: Info },
    error: { cls: "border-red-400/55 bg-[#2A1512]/95 text-red-200", icon: AlertTriangle },
  };

  return (
    <div dir="rtl" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-5 sm:bottom-6">
      {items.map((t) => {
        const tone = TONE[t.kind] ?? TONE.success;
        const Icon = tone.icon;
        return (
          <p
            key={t.id}
            /* النجاحُ يُعلَن بلطف، والفشلُ يُقاطِع */
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex max-w-lg items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${tone.cls}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="leading-6">{t.text}</span>
            <button
              onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
              aria-label="إغلاق التنبيه"
              className="cursor-pointer text-current opacity-50 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </p>
        );
      })}
    </div>
  );
}
