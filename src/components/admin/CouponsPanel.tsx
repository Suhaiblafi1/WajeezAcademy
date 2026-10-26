/* ═══ الكوبونات — جدولٌ يُقرأ ويُعدَّل، لا قائمةُ أرقامٍ متراصّة (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «لماذا لا أستطيع أن أعدّل أو أحذف كودا معيّنا؟ ولماذا هذه الصفحة غير احترافيّة وغير سهلة؟
   وما الصندوق الذي على يسار الأكواد؟». وكانت الصفحةُ صندوقين متجاورين: نموذجُ إنشاءٍ مفتوحٌ دائما فوق صفوفٍ بلا
   عناوين («0/1 60%»)، و«خطة اشتراك جديدة» — بابٌ لا تقرؤه صفحةٌ في الموقع، فذهب.

   فصار: رأسٌ بعدد الأكواد وزرُّ «كوبون جديد» يفتح النموذج، ومرشِّحٌ بأنواعها (كوبوناتنا · أكواد المدرّبين · المنحة)،
   وجدولٌ بأعمدةٍ مسمّاة — الكود، والخصم، والاستعمال، والانتهاء، والحالة — ولكلّ صفٍّ أفعالُه: تعديلٌ في مكانه، وإيقافٌ
   أو تشغيل، وحذفُ ما لم يُستعمل. وما يُدار من غير هذه الصفحة يُسمّى ولا يُعرض له تعديلٌ يُردّ
   (`commerce.service.ts#updateCoupon`). */
import { useMemo, useState } from "react";
import { BadgePercent, Pencil, Plus, Trash2, X } from "lucide-react";
import { Panel } from "@/components/ui/Surface";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import ConfirmAction from "@/components/ConfirmAction";
import { staffControlCls as inputCls } from "@/components/FormKit";
import { apiDelete, apiPatch, apiPost } from "@/services/api";
import { LEDGER_CURRENCY } from "@/application/commerce/presentment";
import { fmtDate } from "@/application/text/format-ar";

export interface AdminCoupon {
  id: string; code: string; percentOff: number | null; amountOff: string | null; currency: string | null;
  maxUses: number | null; usedCount?: number; active: boolean; expiresAt: string | null;
  trainerCode?: { percentOff: number | null; amountOff: string | null; status: string } | null;
  trainerDiscount?: { status: string } | null;
  grantCode?: { id: string } | null;
  trainerShareCode?: { id: string } | null;
  _count?: { orders: number };
}

type Kind = "ours" | "trainer" | "grant";
const KIND_AR: Record<Kind, string> = { ours: "كوبوناتنا", trainer: "أكواد المدربين", grant: "أكواد المنحة" };

/** نوعُ الكود — ومن يديره */
export function couponKind(c: AdminCoupon): Kind {
  if (c.grantCode) return "grant";
  if (c.trainerCode || c.trainerDiscount || c.trainerShareCode) return "trainer";
  return "ours";
}

/** يُعدَّل هنا؟ — كوبوناتنا وحدَها، والباقي من صفحاته */
export const editableHere = (c: AdminCoupon) => couponKind(c) === "ours";
/** يُحذف؟ — ما لم يُستعمل قطّ من كوبوناتنا */
export const deletable = (c: AdminCoupon) => editableHere(c) && (c.usedCount ?? 0) === 0 && (c._count?.orders ?? 0) === 0;

const discountAr = (c: AdminCoupon) => (c.percentOff ? `${c.percentOff}%` : `${c.amountOff} ${c.currency ?? LEDGER_CURRENCY}`);
const usesAr = (c: AdminCoupon) => `${c.usedCount ?? 0} من ${c.maxUses ?? "∞"}`;
const expired = (c: AdminCoupon) => c.expiresAt !== null && new Date(c.expiresAt).getTime() < Date.now();
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

type Draft = { percentOff: string; amountOff: string; maxUses: string; expiresAt: string };
const EMPTY_NEW = { code: "", percentOff: "", amountOff: "", maxUses: "", expiresAt: "" };

export default function CouponsPanel({
  coupons, busy, act,
}: {
  coupons: AdminCoupon[];
  busy: boolean;
  /** نداءٌ واحد يُظهر النتيجة ويعيد التحميل — `Finance.tsx#act` */
  act: (fn: () => Promise<unknown>, doneMsg: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ percentOff: "", amountOff: "", maxUses: "", expiresAt: "" });
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);

  const counts = useMemo(() => {
    const n: Record<Kind, number> = { ours: 0, trainer: 0, grant: 0 };
    for (const c of coupons) n[couponKind(c)] += 1;
    return n;
  }, [coupons]);
  const shown = kind === "all" ? coupons : coupons.filter((c) => couponKind(c) === kind);

  const startEdit = (c: AdminCoupon) => {
    setEditing(c.id);
    setDraft({
      percentOff: c.percentOff ? String(c.percentOff) : "",
      amountOff: c.amountOff ? String(Number(c.amountOff)) : "",
      maxUses: c.maxUses ? String(c.maxUses) : "",
      expiresAt: dateInput(c.expiresAt),
    });
  };
  const saveEdit = (c: AdminCoupon) => act(async () => {
    await apiPatch(`/api/admin/coupons/${c.id}`, {
      percentOff: draft.percentOff ? Number(draft.percentOff) : null,
      amountOff: draft.percentOff ? null : draft.amountOff ? Number(draft.amountOff) : null,
      maxUses: draft.maxUses ? Number(draft.maxUses) : null,
      expiresAt: draft.expiresAt ? new Date(draft.expiresAt) : null,
    });
    setEditing(null);
  }, `عدلت ${c.code}`);

  const draftOk = Boolean(draft.percentOff || draft.amountOff);

  return (
    <Panel as="section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-black">
          <BadgePercent className="h-4 w-4 text-gold-ink" /> الكوبونات
          <span className="text-read font-normal text-muted-foreground">({coupons.length})</span>
        </h3>
        <Button tone={creating ? "secondary" : "confirm"} size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? <><X className="h-3.5 w-3.5" /> إغلاق</> : <><Plus className="h-3.5 w-3.5" /> كوبون جديد</>}
        </Button>
      </div>

      {creating && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-fine text-muted-foreground">الكود
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WAJEEZ20" dir="ltr" className={`${inputCls} mt-1 w-full font-mono`} />
            </label>
            <label className="text-fine text-muted-foreground">نسبة الخصم %
              <input type="number" min={1} max={100} value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value, amountOff: "" })} className={`${inputCls} mt-1 w-full`} />
            </label>
            <label className="text-fine text-muted-foreground">أو مبلغ ثابت ({LEDGER_CURRENCY})
              <input type="number" min={0.5} value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value, percentOff: "" })} className={`${inputCls} mt-1 w-full`} />
            </label>
            <label className="text-fine text-muted-foreground">أقصى استعمال (فارغ = بلا حد)
              <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className={`${inputCls} mt-1 w-full`} />
            </label>
            <label className="text-fine text-muted-foreground">ينتهي في (اختياري)
              <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={`${inputCls} mt-1 w-full`} />
            </label>
          </div>
          <Button tone="confirm" className="mt-3" disabled={busy || form.code.length < 3 || (!form.percentOff && !form.amountOff)}
            onClick={() => act(async () => {
              await apiPost("/api/admin/coupons", {
                code: form.code,
                percentOff: form.percentOff ? Number(form.percentOff) : undefined,
                amountOff: form.amountOff ? Number(form.amountOff) : undefined,
                maxUses: form.maxUses ? Number(form.maxUses) : undefined,
                expiresAt: form.expiresAt ? new Date(form.expiresAt) : undefined,
              });
              setForm(EMPTY_NEW);
              setCreating(false);
            }, "أنشئ الكوبون")}>
            أنشئ الكوبون
          </Button>
        </div>
      )}

      {/* مرشِّحُ الأنواع — وما خلا لا يُعرض */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="نوع الكود">
        {(["all", "ours", "trainer", "grant"] as const).filter((k) => k === "all" || counts[k] > 0).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-fine font-bold transition ${
              kind === k ? "border-teal-light bg-teal/15 text-teal-light-ink" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
            {k === "all" ? `الكل ${coupons.length}` : `${KIND_AR[k]} ${counts[k]}`}
          </button>
        ))}
      </div>

      {/* الجدول — أعمدةٌ مسمّاة على الحاسوب، وبطاقةٌ لكلّ كودٍ على الهاتف */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_1.2fr_auto] gap-3 bg-white/[0.04] px-4 py-2.5 text-fine font-bold text-muted-foreground md:grid">
          <span>الكود</span><span>الخصم</span><span>الاستعمال</span><span>ينتهي</span><span>الحالة</span><span className="w-40 text-left">الإجراء</span>
        </div>
        <ul className="divide-y divide-white/8">
          {shown.map((c) => {
            const k = couponKind(c);
            const isEditing = editing === c.id;
            return (
              <li key={c.id} className={`px-4 py-3 ${c.active && !expired(c) ? "" : "opacity-70"}`}>
                <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 text-read md:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_1.2fr_auto]">
                  <span className="col-span-2 font-mono font-bold text-gold-ink md:col-span-1" dir="ltr">{c.code}</span>
                  <span><span className="text-muted-foreground md:hidden">الخصم: </span>{discountAr(c)}</span>
                  <span><span className="text-muted-foreground md:hidden">الاستعمال: </span>{usesAr(c)}</span>
                  <span className="text-muted-foreground">{c.expiresAt ? fmtDate(new Date(c.expiresAt)) : "بلا انتهاء"}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {k !== "ours" && <Chip tone="accent">{k === "grant" ? "منحة" : c.trainerShareCode ? "شارك دوراتك" : "كود مدرب"}</Chip>}
                    {!c.active ? <Chip tone="danger">{c.trainerCode?.status === "paused" ? "أوقفه مدربه" : "موقوف"}</Chip>
                      : expired(c) ? <Chip tone="danger">انتهى</Chip>
                      : <Chip tone="positive">يعمل</Chip>}
                  </span>
                  <span className="col-span-2 flex flex-wrap justify-start gap-1.5 md:col-span-1 md:w-40 md:justify-end">
                    {editableHere(c) && !isEditing && (
                      <Button tone="ghost" size="sm" disabled={busy} onClick={() => startEdit(c)} aria-label={`تعديل ${c.code}`}>
                        <Pencil className="h-3.5 w-3.5" /> تعديل
                      </Button>
                    )}
                    <Button tone="ghost" size="sm" disabled={busy}
                      onClick={() => act(() => apiPatch(`/api/admin/coupons/${c.id}`, { active: !c.active }), c.active ? `أوقف ${c.code}` : `شغل ${c.code}`)}>
                      {c.active ? "إيقاف" : "تشغيل"}
                    </Button>
                    {deletable(c) && (
                      <Button tone="ghost" size="sm" disabled={busy} onClick={() => setDeleting(c)} aria-label={`حذف ${c.code}`} className="text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
                {!editableHere(c) && (
                  <p className="mt-1 text-fine text-muted-foreground">
                    {k === "grant" ? "نسبته من إعدادات المنحة." : "نسبته من صفحة المدرب."} هنا إيقافه فقط.
                  </p>
                )}
                {isEditing && (
                  <div className="mt-3 grid gap-3 rounded-2xl border border-teal/30 bg-teal/[0.05] p-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="text-fine text-muted-foreground">نسبة الخصم %
                      <input type="number" min={1} max={100} value={draft.percentOff} onChange={(e) => setDraft({ ...draft, percentOff: e.target.value, amountOff: "" })} className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <label className="text-fine text-muted-foreground">أو مبلغ ثابت ({LEDGER_CURRENCY})
                      <input type="number" min={0.5} value={draft.amountOff} onChange={(e) => setDraft({ ...draft, amountOff: e.target.value, percentOff: "" })} className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <label className="text-fine text-muted-foreground">أقصى استعمال (فارغ = بلا حد)
                      <input type="number" min={Math.max(1, c.usedCount ?? 0)} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <label className="text-fine text-muted-foreground">ينتهي في
                      <input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                    </label>
                    <span className="flex items-end gap-2">
                      <Button tone="confirm" size="sm" disabled={busy || !draftOk} onClick={() => void saveEdit(c)}>حفظ</Button>
                      <Button tone="ghost" size="sm" onClick={() => setEditing(null)}>إلغاء</Button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-4 py-6 text-center text-read text-muted-foreground">لا أكواد هنا بعد.</li>}
        </ul>
      </div>

      {deleting && (
        <ConfirmAction
          titleAr={`حذف ${deleting.code}`}
          confirmLabelAr="احذفه"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const c = deleting;
            setDeleting(null);
            void act(() => apiDelete(`/api/admin/coupons/${c.id}`), `حذف ${c.code}`);
          }}
        >
          <p>لم يستعمل بعد، فيحذف نهائيا. ومن كتبه بعدها لا يجد خصما.</p>
        </ConfirmAction>
      )}
    </Panel>
  );
}
