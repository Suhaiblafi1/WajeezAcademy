/* تسويقُ المدرّبين — ما قدّموه، وملصقاتٌ تصمّمها الإدارةُ لهم (٢٩ سبتمبر ٢٠٢٦).

   والعلّةُ كاملةً في رأس `server/services/trainer-marketing.service.ts`.

   ═══ ما يُفعل هنا ═══

   يُختار مدرّبٌ فيُرى ما قدّمه: فيديو التعريف به، وصورُه (تُفتح وتُنزَّل
   للتصميم)، وفيديو كلّ دورةٍ أو مسار. ولكلّ دورةٍ أو مسارٍ يُرفع ملصقٌ —
   ملفّا أو رابطَ تصميم — فيصل المدرّبَ ليوافق.

   ═══ وما لا يُفعل ═══

   لا زرَّ هنا يكتب «وافق». الموافقةُ فعلُ المدرّب وحدَه، وهي الإذنُ بالاستعمال
   العامّ — فالشاشةُ تقول الحالَ ولا تصنعها. ومن طلب تعديلا يُرفع له نسخةٌ
   جديدة تُزيح ما قبلها. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, ExternalLink, ImagePlus, Loader2, Megaphone, Send, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import EmptyState from "@/components/EmptyState";
import ListToolbar from "@/components/admin/ListToolbar";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPost, ApiError } from "@/services/api";
import { mediaSrc, putSigned } from "@/services/signed-upload";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { fmtDateLong } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { cleanMarketingUrl, MAX_MARKETING_NOTE, POSTER_STATUS_AR } from "@/application/trainer/marketing";

interface ListRow {
  profileId: string; fullName: string; email: string; videos: number; photos: number;
  posters: { pending: number; approved: number; changesRequested: number };
}
interface VideoRow { url: string; noteAr: string | null; updatedAt: string }
interface Poster {
  id: string; targetKind: string; targetId: string; version: number; imageUrl: string | null;
  status: string; staffNoteAr: string | null; trainerNoteAr: string | null;
  createdAt: string; submittedAt: string | null; decidedAt: string | null;
}
interface Target { kind: "course" | "path"; id: string; titleAr: string; video: VideoRow | null; posters: Poster[] }
interface Detail {
  profileId: string; fullName: string; email: string; uploadsEnabled: boolean;
  bioVideo: VideoRow | null; photos: { id: string; captionAr: string | null; createdAt: string; imageUrl: string | null }[];
  targets: Target[];
}

export default function TrainerMarketing() {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<ListRow[]>("/api/admin/trainer-marketing")
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر التحميل"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => paginate(
    (rows ?? []).filter((r) => matchesQuery(q, [r.fullName, r.email])), page, 25,
  ), [rows, q, page]);

  if (openId) {
    return (
      <AdminLayout title="تسويقُ المدرّبين">
        <TrainerDetail profileId={openId} onBack={() => { setOpenId(null); load(); }} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="تسويقُ المدرّبين">
      <p className="mb-5 max-w-3xl text-sm leading-7 text-muted-foreground">
        فيديوهاتُ المدرّبين وصورُهم للتعريف بهم وبدوراتهم. ولكلّ دورةٍ أو مسارٍ ملصقٌ تصمّمونه وترفعونه هنا —
        ويصل المدرّبَ فيوافق أو يطلب تعديلا. <b className="text-foreground">لا يُستعمل ملصقٌ علنا قبل موافقته.</b>
      </p>
      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} titleAr="لا مدرّبَ بعد" reasonAr="يظهر هنا كلُّ مدرّبٍ بدأ عملَه على موادّه — ومعه ما قدّمه للتسويق." />
      ) : (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مدرّبا" placeholder="ابحث باسم المدرّب أو بريده…" />
          <ul className="grid gap-2.5">
            {view.rows.map((r) => (
              <Card as="li" key={r.profileId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-read font-bold">{r.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.videos} فيديو · {r.photos} صورة
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.posters.changesRequested > 0 && <Chip tone="danger">طلب تعديل ({r.posters.changesRequested})</Chip>}
                  {r.posters.pending > 0 && <Chip tone="warn">عند المدرّب ({r.posters.pending})</Chip>}
                  {r.posters.approved > 0 && <Chip tone="positive">معتمَد ({r.posters.approved})</Chip>}
                  <Button size="sm" onClick={() => setOpenId(r.profileId)}>افتحْ</Button>
                </div>
              </Card>
            ))}
          </ul>
        </>
      )}
    </AdminLayout>
  );
}

function TrainerDetail({ profileId, onBack }: { profileId: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    apiGet<Detail>(`/api/admin/trainer-marketing/${profileId}`)
      .then((r) => { setD(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر التحميل"));
  }, [profileId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid gap-5">
      <div>
        <Button size="sm" tone="ghost" icon={ArrowRight} onClick={onBack}>كلُّ المدرّبين</Button>
      </div>
      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !d ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      ) : (
        <>
          <Panel as="section">
            <h2 className="text-base font-black">{d.fullName}</h2>
            <p className="text-sm text-muted-foreground">{d.email}</p>
            <div className="mt-3">
              <p className="text-sm font-bold text-muted-foreground">فيديو التعريف به</p>
              <VideoLink v={d.bioVideo} />
            </div>
          </Panel>

          <Panel as="section">
            <h2 className="text-base font-black">صورُه ({d.photos.length})</h2>
            {d.photos.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">لم يرفع صورةً بعد.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d.photos.map((p) => (
                  <li key={p.id}>
                    <a href={mediaSrc(p.imageUrl)} target="_blank" rel="noreferrer noopener" download className="block">
                      <Inset className="aspect-square overflow-hidden p-0">
                        {p.imageUrl && <img src={mediaSrc(p.imageUrl)} alt={`صورةُ ${d.fullName}`} className="h-full w-full object-cover" loading="lazy" />}
                      </Inset>
                      <span className="mt-1 inline-flex items-center gap-1 text-sm text-teal-light-ink"><Download className="h-3.5 w-3.5" aria-hidden="true" /> افتحْها بدقّتها</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section className="grid gap-3">
            <h2 className="text-base font-black">دوراتُه ومساراتُه — والملصقات</h2>
            {d.targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا دورةَ مؤهَّلا لها ولا مسار.</p>
            ) : d.targets.map((t) => (
              <TargetPosters key={`${t.kind}:${t.id}`} profileId={d.profileId} target={t} uploadsEnabled={d.uploadsEnabled} onChanged={load} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function VideoLink({ v }: { v: VideoRow | null }) {
  if (!v) return <p className="mt-1 text-sm text-muted-foreground">لم يُضِف رابطا بعد.</p>;
  return (
    <div className="mt-1">
      <a href={v.url} target="_blank" rel="noreferrer noopener" dir="ltr"
        className="inline-flex max-w-full items-center gap-1.5 text-read font-bold text-teal-light-ink hover:underline">
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{v.url}</span>
      </a>
      {v.noteAr && <p className="text-sm text-muted-foreground">{v.noteAr}</p>}
    </div>
  );
}

function TargetPosters({
  profileId, target: t, uploadsEnabled, onChanged,
}: { profileId: string; target: Target; uploadsEnabled: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastDecision = t.posters.find((p) => p.status === "changes_requested");

  /* الرفعُ والإرسالُ نقرةٌ واحدة: مسوّدةٌ ثمّ بايتاتُها ثمّ إرسالُها. ومن سقط
     رفعُه بقيت مسوّدتُه ظاهرةً بزرّ حذف، لا صفّا يتيما لا يُرى. */
  const send = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; uploadUrl?: string; maxBytes?: number }>(
        `/api/admin/trainer-marketing/${profileId}/posters`,
        { targetKind: t.kind, targetId: t.id, staffNoteAr: note.trim() || null, ...(file ? { mime: file.type } : { url: link.trim() }) },
      );
      if (file && r.uploadUrl) await putSigned(r.uploadUrl, file, r.maxBytes);
      await apiPost(`/api/admin/trainer-marketing/posters/${r.id}/submit`, {});
      toast("أُرسل الملصقُ إلى المدرّب");
      setNote(""); setLink(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "تعذّر الإرسال");
      onChanged();
    } finally { setBusy(false); }
  };

  const dropDraft = async (id: string) => {
    setBusy(true);
    try { await apiDelete(`/api/admin/trainer-marketing/posters/${id}`); onChanged(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الحذف"); }
    finally { setBusy(false); }
  };

  const ready = file !== null || cleanMarketingUrl(link) !== null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-read font-bold leading-6">{t.titleAr || "دورةٌ بلا اسمٍ في الكتالوج"}</h3>
        <Chip tone="neutral">{t.kind === "course" ? "دورة" : "مسار"}</Chip>
      </div>
      <div className="mt-2">
        <p className="text-sm font-bold text-muted-foreground">فيديو المدرّب عنها</p>
        <VideoLink v={t.video} />
      </div>

      {lastDecision?.trainerNoteAr && (
        <Inset tone="danger" className="mt-3 p-3 text-sm leading-6">
          طلب تعديلَ النسخة {lastDecision.version}: {lastDecision.trainerNoteAr}
        </Inset>
      )}

      {t.posters.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {t.posters.map((p) => {
            const st = POSTER_STATUS_AR[p.status] ?? { staffAr: p.status, tone: "neutral" as const };
            return (
              <li key={p.id}>
                <Inset className="overflow-hidden p-0">
                  {p.imageUrl
                    ? <a href={mediaSrc(p.imageUrl)} target="_blank" rel="noreferrer noopener"><img src={mediaSrc(p.imageUrl)} alt={`النسخة ${p.version}`} className="aspect-[4/5] w-full object-cover" loading="lazy" /></a>
                    : <div className="grid aspect-[4/5] place-items-center text-sm text-muted-foreground">لم يُرفع التصميم</div>}
                </Inset>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Chip tone={st.tone}>{st.staffAr}</Chip>
                  <span className="text-sm text-muted-foreground">النسخة {p.version}</span>
                </div>
                {p.decidedAt && <p className="text-sm text-muted-foreground">قرّر {fmtDateLong(p.decidedAt)}</p>}
                {p.status === "draft" && (
                  <Button size="sm" tone="ghost" icon={Trash2} disabled={busy} onClick={() => void dropDraft(p.id)}>احذفِ المسوّدة</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Inset className="mt-4 grid gap-3 p-3">
        <p className="text-read font-bold">{t.posters.length ? "نسخةٌ جديدة" : "أوّلُ ملصق"}</p>
        {uploadsEnabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="اختر ملفَّ الملصق"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()}>اختر التصميم</Button>
            <span className="text-sm text-muted-foreground">{file ? file.name : "JPEG أو PNG أو WebP حتّى ٤ ميغابايت"}</span>
          </div>
        ) : (
          <StaffField label="رابطُ التصميم" hint="رفعُ الملفّات غيرُ مفعّل — ألصِقْ رابطَ صورة الملصق">
            <input dir="ltr" className={staffControlCls} value={link} maxLength={500} placeholder="https://…" onChange={(e) => setLink(e.target.value)} />
          </StaffField>
        )}
        <StaffField label="ملحوظةٌ للمدرّب" hint="لا تلزم — ما تغيّر في هذه النسخة مثلا">
          <input className={staffControlCls} value={note} maxLength={MAX_MARKETING_NOTE} onChange={(e) => setNote(e.target.value)} />
        </StaffField>
        <div>
          <Button size="sm" tone="confirm" icon={Send} loading={busy} disabled={!ready} onClick={() => void send()}>
            أرسِلْه ليوافق
          </Button>
        </div>
      </Inset>
    </Card>
  );
}
