/* مواعيدُ الفصل بلا تعارض — ما يتعارض الآن، ومن ينتقل، ثمّ الإرسالُ إلى المدرّبين (٢٢ أكتوبر ٢٠٢٦).

   القاعدةُ في `application/terms/schedule-clash.ts`، والقراءةُ والإرسالُ في `server/services/term-clash.service.ts`.
   الشاشةُ معاينةٌ أوّلا: لا يصل المدرّبَ شيءٌ قبل «أرسل». وكلُّ نقلٍ بطاقةُ «قبل/بعد» عنده يقبلها أو يرفضها
   بسبب، فيعود الرفضُ هنا بسببه، وإعادةُ الإرسال تقترح له موعدا آخر. */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, CalendarClock, Loader2, Mail, Send } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { toast, toastError } from "@/components/Toast";
import { fmtDateAr } from "@/utils/format";

interface Row {
  cohortId: string; title: string; courseTitleAr: string; trainerAr: string; learners: number;
  action: "keep" | "move" | "stuck"; fromAr: string; toAr: string | null;
  clashes: { cohortId: string; titleAr: string; whyAr: string }[];
  whyAr: string | null;
  sent: { status: string; toAr: string; noteAr: string | null; at: string } | null;
  /** أبقيتَها خارج هذا الإرسال */
  held: boolean;
  /** ما يصل مدرّبَها بنصّه — للمنتقلة وحدَها */
  mail: { to: string | null; subject: string; text: string; bellAr: string } | null;
}
interface View {
  termId: string; termTitleAr: string; cohorts: number; clashesBefore: number;
  pairs: { aTitleAr: string; bTitleAr: string; whyAr: string; firstAt: string; count: number }[];
  rows: Row[]; toSend: number;
}

const SENT_AR: Record<string, { label: string; tone: "info" | "positive" | "danger" | "neutral" | "warn" }> = {
  proposed: { label: "مسودة لم ترسل", tone: "warn" },
  pending: { label: "عند المدرب", tone: "info" },
  accepted: { label: "قبله", tone: "positive" },
  rejected: { label: "رفضه", tone: "danger" },
  withdrawn: { label: "سحب", tone: "neutral" },
  dropped: { label: "حذف", tone: "neutral" },
  lapsed: { label: "سقط", tone: "neutral" },
};

const n = (k: number, one: string, two: string, few: string, many: string) =>
  k === 1 ? one : k === 2 ? two : k >= 3 && k <= 10 ? `${k} ${few}` : `${k} ${many}`;

export default function TermClashes() {
  const { id = "" } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  /* ═══ ومعاينةُ ما يصل كلَّ مدرّب، وإبقاءُ من شاء خارج الإرسال (٢٤ أكتوبر ٢٠٢٦) ═══
     صاحبُ المنصّة: «هل أرى الإيميلاتِ التي ستصل كلَّ مدرّب؟ أم الإرسالُ يكون مباشرة؟» — واختار المعاينة.
     فالبريدُ بنصّه كما يُرسَل تحت كلّ صفّ، ومن رفع علامتَه بقيت شعبتُه على موعدها، ويُعاد الحسابُ بها
     ثابتةً — فما يُرى هو ما يُرسَل. */
  const [hold, setHold] = useState<string[]>([]);
  const [openMail, setOpenMail] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = hold.length ? `?hold=${hold.join(",")}` : "";
      setView(await apiGet<View>(`/api/admin/terms/${id}/clashes${q}`));
      setError(null);
    } catch (e) { setError(permissionMessage(e, "تعذر تحميل مواعيد الفصل")); }
  }, [id, hold]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiPost<{ sent: number; skipped: { titleAr: string; whyAr: string }[]; view: View }>(`/api/admin/terms/${id}/clashes/send`, { hold });
      setView(r.view);
      setConfirm(false);
      toast(r.sent > 0 ? `أرسلت ${n(r.sent, "اقتراحا واحدا", "اقتراحين", "اقتراحات", "اقتراحا")} إلى المدربين` : "لم يرسل شيء");
      for (const s of r.skipped) toastError(`${s.titleAr}: ${s.whyAr}`);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإرسال"); }
    finally { setBusy(false); }
  };

  const moves = view?.rows.filter((r) => r.action === "move") ?? [];
  const stuck = view?.rows.filter((r) => r.action === "stuck" && !r.held) ?? [];
  /* وما أبقيتَه خارج الإرسال — في قائمته، يُعاد بنقرة. وقد ينتقل بدلَه ما كان يتعارض معه */
  const heldRows = view?.rows.filter((r) => r.held) ?? [];
  const toggleHold = (cohortId: string, on: boolean) => {
    setConfirm(false);
    setHold(on ? [...hold, cohortId] : hold.filter((x) => x !== cohortId));
  };
  const answered = view?.rows.filter((r) => r.sent && r.action !== "move") ?? [];

  return (
    <AdminLayout title="مواعيد بلا تعارض">
      <Link to="/admin/terms" className="mb-4 inline-flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
        <ArrowRight className="h-4 w-4" aria-hidden="true" /> المواسم والتقويم
      </Link>
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}
      {!view ? (
        !error && <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" /></div>
      ) : (
        <div className="space-y-5">
          <Panel as="section">
            <h2 className="flex items-center gap-2 text-lg font-black"><CalendarClock className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> {view.termTitleAr}</h2>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              دورتان لا تتعارضان إن جمعهما مسار، أو كانتا للفئة نفسها بمستوى واحد أو قريب. وشعبتان للدورة نفسها لا تتعارضان: هما بديلان.
            </p>
            <p className="mt-3 text-read font-bold text-foreground">
              {view.cohorts} شعبة · {view.clashesBefore === 0 ? "لا تعارض الآن" : `${n(view.clashesBefore, "تعارض واحد", "تعارضان", "تعارضات", "تعارضا")} الآن`}
              {" · "}{moves.length === 0 ? "لا شعبة تحتاج نقلا" : `${n(moves.length, "شعبة واحدة تنتقل", "شعبتان تنتقلان", "شعب تنتقل", "شعبة تنتقل")}`}
            </p>
            {moves.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {confirm ? (
                  <>
                    <Button tone="confirm" icon={Send} disabled={busy} onClick={() => void send()}>
                      أكد الإرسال — {n(moves.length, "مدرب واحد", "مدربان", "مدربين", "مدربا")}
                    </Button>
                    <Button tone="ghost" disabled={busy} onClick={() => setConfirm(false)}>تراجع</Button>
                  </>
                ) : (
                  <Button tone="secondary" icon={Send} disabled={busy} onClick={() => setConfirm(true)}>أرسل المواعيد المقترحة إلى المدربين</Button>
                )}
                <span className="text-read text-muted-foreground">يصل كل مدرب بريد وإشعار، وبطاقة يقبلها أو يرفضها بسبب.</span>
              </div>
            )}
          </Panel>

          {view.pairs.length > 0 && (
            <Card as="section">
              <h3 className="text-read font-black">ما يتعارض الآن</h3>
              <ul className="mt-2 space-y-1.5">
                {view.pairs.map((p, i) => (
                  <li key={i} className="text-read leading-6 text-muted-foreground">
                    <span className="font-bold text-foreground">«{p.aTitleAr}» و«{p.bTitleAr}»</span> — {p.whyAr} · من {fmtDateAr(p.firstAt)}
                    {p.count > 1 && ` · ${n(p.count, "لقاء", "لقاءان", "لقاءات", "لقاء")}`}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {moves.length > 0 && (
            <Card as="section">
              <h3 className="text-read font-black">ما نقترحه</h3>
              <ul className="mt-2 space-y-3">
                {moves.map((r) => (
                  <li key={r.cohortId} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" checked disabled={busy} onChange={() => toggleHold(r.cohortId, true)}
                        aria-label={`أرسل إلى مدرب «${r.title}»`} className="mt-1.5 h-4 w-4 accent-[var(--teal)]" />
                      <span className="text-read font-bold text-foreground">{r.title} <span className="font-normal text-muted-foreground">· {r.trainerAr} · {r.learners} طالب</span></span>
                    </label>
                    <p className="mt-1 text-read text-foreground">{r.fromAr} ← <span className="font-black text-teal-light-ink">{r.toAr}</span> كل أسبوع</p>
                    {r.whyAr && <p className="mt-1 text-read leading-6 text-muted-foreground">{r.whyAr}</p>}
                    {r.sent?.status === "rejected" && (
                      <p className="mt-1 text-read text-gold-ink">رفض قبله {r.sent.toAr}{r.sent.noteAr ? `: ${r.sent.noteAr}` : ""}</p>
                    )}
                    {r.mail && (
                      <div className="mt-2">
                        <Button tone="ghost" size="sm" icon={Mail} aria-expanded={openMail === r.cohortId}
                          onClick={() => setOpenMail(openMail === r.cohortId ? null : r.cohortId)}>
                          {openMail === r.cohortId ? "أخف البريد" : "اعرض البريد"}
                        </Button>
                        {openMail === r.cohortId && (
                          <Inset className="mt-2 grid gap-2">
                            <p className="text-read text-muted-foreground">إلى: <span dir="ltr">{r.mail.to ?? "لا بريد لمدربها"}</span></p>
                            <p className="text-read font-bold text-foreground">{r.mail.subject}</p>
                            <p className="whitespace-pre-wrap text-read leading-7 text-foreground">{r.mail.text}</p>
                            <p className="border-t border-border pt-2 text-read text-muted-foreground">والإشعار في المنصة: {r.mail.bellAr}</p>
                          </Inset>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stuck.length > 0 && (
            <Card as="section">
              <h3 className="text-read font-black">ما لم يحل</h3>
              <ul className="mt-2 space-y-2">
                {stuck.map((r) => (
                  <li key={r.cohortId} className="text-read leading-6">
                    <span className="font-bold text-foreground">{r.title}</span>
                    <span className="text-muted-foreground"> · {r.fromAr} · يتعارض مع {r.clashes.map((c) => `«${c.titleAr}»`).join("، ")} — {r.whyAr}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {heldRows.length > 0 && (
            <Card as="section">
              <h3 className="text-read font-black">أبقيتها خارج هذا الإرسال</h3>
              <p className="mt-1 text-read leading-6 text-muted-foreground">تبقى على موعدها ولا يصل مدربها شيء. وقد ينتقل بدلها ما كان يتعارض معها.</p>
              <ul className="mt-2 space-y-2">
                {heldRows.map((r) => (
                  <li key={r.cohortId} className="flex flex-wrap items-center gap-2 text-read">
                    <span className="font-bold text-foreground">{r.title}</span>
                    <span className="text-muted-foreground">· {r.trainerAr} · {r.fromAr}</span>
                    {r.action === "stuck" && <Chip tone="warn">ما زالت تتعارض</Chip>}
                    <Button tone="ghost" size="sm" disabled={busy} onClick={() => toggleHold(r.cohortId, false)}>أعدها إلى الإرسال</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {answered.length > 0 && (
            <Card as="section">
              <h3 className="text-read font-black">ما أرسل قبل</h3>
              <ul className="mt-2 space-y-2">
                {answered.map((r) => (
                  <li key={r.cohortId} className="flex flex-wrap items-center gap-2 text-read">
                    <span className="font-bold text-foreground">{r.title}</span>
                    <span className="text-muted-foreground">{r.sent!.toAr}</span>
                    <Chip tone={SENT_AR[r.sent!.status]?.tone ?? "neutral"}>{SENT_AR[r.sent!.status]?.label ?? r.sent!.status}</Chip>
                    {r.sent!.noteAr && <span className="text-muted-foreground">— {r.sent!.noteAr}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
