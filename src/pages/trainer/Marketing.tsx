/* «التسويق» — فيديوهاتُ المدرّب وصورُه، وملصقاتٌ تصمّمها الإدارةُ ويوافق عليها.

   قرارُ صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦)، والعلّةُ كاملةً في رأس
   `server/services/trainer-marketing.service.ts`.

   ═══ ترتيبُ الشاشة ترتيبُ ما يُطلب منه ═══

   ① ما ينتظر قرارَه أوّلا — ملصقٌ لا يُستعمل علنا حتّى يوافق، فلا يُدفن
      تحت فيديوهاتٍ كتبها من قبل.
   ② ثمّ التعريفُ به: فيديو واحدٌ عن نفسه.
   ③ ثمّ صورُه — منها تُصنع الملصقات.
   ④ ثمّ دوراتُه ومساراتُه: لكلٍّ فيديو وملصقُه. */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, ChevronDown, ExternalLink, ImagePlus, Loader2, Megaphone, PenLine, Trash2, UserRound, Video, X,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { mediaSrc, putSigned } from "@/services/signed-upload";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { fmtDateLong } from "@/application/text/format-ar";
import { cleanMarketingUrl, MAX_MARKETING_NOTE, MAX_MARKETING_PHOTOS, POSTER_STATUS_AR } from "@/application/trainer/marketing";

interface VideoRow { url: string; noteAr: string | null; updatedAt: string }
interface Poster {
  id: string; targetKind: string; targetId: string; version: number; imageUrl: string | null;
  status: string; staffNoteAr: string | null; trainerNoteAr: string | null;
  createdAt: string; submittedAt: string | null; decidedAt: string | null;
}
interface Target { kind: "course" | "path"; id: string; titleAr: string; video: VideoRow | null; posters: Poster[] }
interface Photo { id: string; captionAr: string | null; createdAt: string; imageUrl: string | null }
interface MarketingState { uploadsEnabled: boolean; bioVideo: VideoRow | null; photos: Photo[]; targets: Target[] }

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export default function Marketing() {
  const [data, setData] = useState<MarketingState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<MarketingState>("/api/trainer/marketing")
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميلُ قسم التسويق"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const awaiting = (data?.targets ?? []).flatMap((t) => t.posters.filter((p) => p.status === "pending").map((p) => ({ p, t })));

  return (
    <TrainerLayout title="التسويق">
      <p className="mb-5 max-w-3xl text-sm leading-7 text-muted-foreground">
        عرِّفْ الناسَ بك وبدوراتك: فيديو قصيرٌ تتحدّث فيه عن نفسك، وفيديو لكلّ دورةٍ أو مسارٍ يقنع من يتردّد،
        وصورٌ لك نصنع منها ملصقاتِك. ونحن نصمّم لكلّ دورةٍ أو مسارٍ ملصقا —
        <b className="text-foreground"> ولا نستعمله علنا حتّى توافق عليه.</b>
      </p>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !data ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* ① ما ينتظر قرارَه */}
          {awaiting.length > 0 && (
            <Panel as="section" tone="warn">
              <h2 className="flex items-center gap-2 text-base font-black text-gold-ink">
                <Megaphone className="h-5 w-5" aria-hidden="true" />
                ملصقاتٌ تنتظر موافقتك ({awaiting.length})
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {awaiting.map(({ p, t }) => (
                  <PosterCard key={p.id} poster={p} titleAr={t.titleAr} onDone={load} />
                ))}
              </div>
            </Panel>
          )}

          {/* ② التعريفُ به */}
          <Panel as="section">
            <h2 className="flex items-center gap-2 text-base font-black">
              <UserRound className="h-5 w-5 text-teal" aria-hidden="true" />
              فيديو تعريفيٌّ بك
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              دقيقةٌ أو اثنتان: من أنت، وما خبرتُك، ولماذا يتعلّم الناسُ معك. ارفعه على يوتيوب أو Drive وألصِقْ رابطَه.
            </p>
            <VideoEditor targetKind="bio" targetId="" value={data.bioVideo} onSaved={load} />
          </Panel>

          {/* ③ صورُه */}
          <PhotosPanel photos={data.photos} uploadsEnabled={data.uploadsEnabled} onChanged={load} />

          {/* ④ دوراتُه ومساراتُه */}
          <section>
            <h2 className="mb-1 flex items-center gap-2 text-base font-black">
              <Video className="h-5 w-5 text-teal" aria-hidden="true" />
              دوراتي ومساراتي
            </h2>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              لكلّ دورةٍ اخترناها لك ولكلّ مسارٍ بنيتَه: فيديو يقنع بها، وملصقُها حين نصمّمه.
            </p>
            {data.targets.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                titleAr="لا دورةَ ولا مسارَ بعد"
                reasonAr="يظهر هنا ما اخترناه لك من دورات وما بنيتَه من مسارات — ولكلٍّ فيديو وملصق."
                actions={[{ to: "/trainer/qualifications", labelAr: "دوراتي" }]}
              />
            ) : (
              <ul className="grid gap-3">
                {data.targets.map((t) => <TargetRow key={`${t.kind}:${t.id}`} target={t} onChanged={load} />)}
              </ul>
            )}
          </section>
        </div>
      )}
    </TrainerLayout>
  );
}

/* ═══ رابطُ فيديو — يُكتب ويُبدَّل ويُمحى ═══ */
function VideoEditor({
  targetKind, targetId, value, onSaved,
}: { targetKind: "bio" | "course" | "path"; targetId: string; value: VideoRow | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(!value);
  const [url, setUrl] = useState(value?.url ?? "");
  const [noteAr, setNoteAr] = useState(value?.noteAr ?? "");
  const [busy, setBusy] = useState(false);
  const valid = cleanMarketingUrl(url) !== null;

  const save = async (next: string | null) => {
    setBusy(true);
    try {
      await apiPut("/api/trainer/marketing/videos", { targetKind, targetId, url: next, noteAr: noteAr.trim() || null });
      toast(next ? "حُفظ الرابط" : "حُذف الفيديو");
      if (!next) { setUrl(""); setNoteAr(""); }
      setEditing(!next);
      onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally { setBusy(false); }
  };

  if (value && !editing) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <a href={value.url} target="_blank" rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-1.5 truncate text-read font-bold text-teal-light-ink hover:underline" dir="ltr">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{value.url}</span>
          </a>
          {value.noteAr && <p className="mt-1 text-sm text-muted-foreground">{value.noteAr}</p>}
          <p className="mt-0.5 text-sm text-muted-foreground/80">حُدِّث {fmtDateLong(value.updatedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" tone="secondary" icon={PenLine} onClick={() => setEditing(true)}>بدّلْه</Button>
          <Button size="sm" tone="ghost" icon={Trash2} disabled={busy} onClick={() => void save(null)}>احذفْه</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_16rem] sm:items-end">
      <StaffField label="رابطُ الفيديو" hint="يبدأ بـhttps:// — يوتيوب أو Vimeo أو Drive بمشاركةٍ مفتوحة">
        <input dir="ltr" className={staffControlCls} value={url} maxLength={500} inputMode="url"
          placeholder="https://youtu.be/…" onChange={(e) => setUrl(e.target.value)} />
      </StaffField>
      <StaffField label="ملحوظة" hint="لا تلزم">
        <input className={staffControlCls} value={noteAr} maxLength={MAX_MARKETING_NOTE}
          placeholder="مثلا: النسخة القصيرة" onChange={(e) => setNoteAr(e.target.value)} />
      </StaffField>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button size="sm" tone="confirm" icon={Check} loading={busy} disabled={!valid} onClick={() => void save(url.trim())}>
          احفظ الرابط
        </Button>
        {value && <Button size="sm" tone="ghost" icon={X} onClick={() => { setEditing(false); setUrl(value.url); setNoteAr(value.noteAr ?? ""); }}>تراجعْ</Button>}
        {url.trim() && !valid && <span className="text-sm font-bold text-red-300">الرابطُ يبدأ بـhttps:// بلا مسافات</span>}
      </div>
    </div>
  );
}

/* ═══ صورُه — منها تُصنع الملصقات ═══ */
function PhotosPanel({ photos, uploadsEnabled, onChanged }: { photos: Photo[]; uploadsEnabled: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const full = photos.length >= MAX_MARKETING_PHOTOS;

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const r = await apiPost<{ uploadUrl: string; maxBytes: number; id: string }>("/api/trainer/marketing/photos", { mime: file.type });
      try {
        await putSigned(r.uploadUrl, file, r.maxBytes);
      } catch (e) {
        /* صفٌّ بلا بايتات لا يبقى — يُحذف فلا يرى صورةً فارغة */
        await apiDelete(`/api/trainer/marketing/photos/${r.id}`).catch(() => undefined);
        throw e;
      }
      toast("رُفعت الصورة");
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "تعذّر رفعُ الصورة");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addLink = async () => {
    setBusy(true);
    try {
      await apiPost("/api/trainer/marketing/photos", { url: link.trim() });
      setLink("");
      toast("أُضيفت الصورة");
      onChanged();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّرت الإضافة");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await apiDelete(`/api/trainer/marketing/photos/${id}`);
      onChanged();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black">
            <ImagePlus className="h-5 w-5 text-teal" aria-hidden="true" />
            صوري للملصقات <span className="text-sm font-bold text-muted-foreground">({photos.length}/{MAX_MARKETING_PHOTOS})</span>
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            صورٌ واضحةٌ بخلفيّةٍ هادئة ودقّةٍ عالية — نختار منها ما يناسب كلَّ ملصق. JPEG أو PNG أو WebP حتّى ٤ ميغابايت.
          </p>
        </div>
        {uploadsEnabled && (
          <>
            <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" aria-label="اختر صورة"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            <Button size="sm" icon={ImagePlus} loading={busy} disabled={full} onClick={() => fileRef.current?.click()}>
              ارفعْ صورة
            </Button>
          </>
        )}
      </div>

      {!uploadsEnabled && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <StaffField label="رابطُ صورتك" hint="رفعُ الملفّات غيرُ مفعّلٍ بعد — ألصِقْ رابطَ الصورة من Drive أو غيره بمشاركةٍ مفتوحة">
            <input dir="ltr" className={staffControlCls} value={link} maxLength={500} placeholder="https://…"
              onChange={(e) => setLink(e.target.value)} />
          </StaffField>
          <Button size="sm" icon={ImagePlus} loading={busy} disabled={full || cleanMarketingUrl(link) === null} onClick={() => void addLink()}>
            أضِفْها
          </Button>
        </div>
      )}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <Inset className="aspect-square overflow-hidden p-0">
                {p.imageUrl && <img src={mediaSrc(p.imageUrl)} alt={p.captionAr ?? "صورةٌ للملصقات"} className="h-full w-full object-cover" loading="lazy" />}
              </Inset>
              <Button
                size="sm" tone="ghost" icon={Trash2} disabled={busy}
                className="absolute top-1.5 left-1.5 bg-paper/80"
                aria-label="احذف الصورة" onClick={() => void remove(p.id)}
              >
                احذفْ
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ═══ دورةٌ أو مسار — فيديوها وملصقُها ═══ */
function TargetRow({ target: t, onChanged }: { target: Target; onChanged: () => void }) {
  const live = t.posters.filter((p) => p.status !== "superseded");
  const latest = live[0] ?? null;
  const history = t.posters.filter((p) => p !== latest);
  const approved = t.posters.find((p) => p.status === "approved");
  return (
    <Card as="li" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-read font-bold leading-6">{t.titleAr || "دورةٌ بلا اسمٍ في الكتالوج"}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="neutral">{t.kind === "course" ? "دورة" : "مسار"}</Chip>
          {approved && <Chip tone="positive">ملصقٌ معتمَد</Chip>}
        </div>
      </div>

      <VideoEditor targetKind={t.kind} targetId={t.id} value={t.video} onSaved={onChanged} />

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-sm font-bold text-muted-foreground">الملصق</p>
        {latest ? (
          latest.status === "pending"
            ? <p className="mt-1 text-sm text-gold-ink">نسخةٌ جديدةٌ تنتظر موافقتك — في أعلى الصفحة.</p>
            : <div className="mt-2 max-w-sm"><PosterCard poster={latest} onDone={onChanged} /></div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">لم نصمّم ملصقَها بعد — نُخبرك حين يصل.</p>
        )}
        {history.length > 0 && (
          <details className="group mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              نسخٌ سابقة ({history.length})
            </summary>
            <ul className="mt-2 grid gap-1 border-s border-white/10 ps-3 text-sm text-muted-foreground">
              {history.map((p) => (
                <li key={p.id}>
                  النسخة {p.version} — {POSTER_STATUS_AR[p.status]?.trainerAr ?? p.status}
                  {p.trainerNoteAr ? `: ${p.trainerNoteAr}` : ""}
                  {p.imageUrl && <> · <a className="text-teal-light-ink hover:underline" href={mediaSrc(p.imageUrl)} target="_blank" rel="noreferrer noopener">افتحها</a></>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}

/* ═══ الملصق — يُرى كبيرا، ويُقرَّر عنده ═══ */
function PosterCard({ poster: p, titleAr, onDone }: { poster: Poster; titleAr?: string; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const st = POSTER_STATUS_AR[p.status] ?? { trainerAr: p.status, tone: "neutral" as const };

  const decide = async (decision: "approve" | "changes") => {
    setBusy(true);
    try {
      await apiPost(`/api/trainer/marketing/posters/${p.id}/decision`, { decision, noteAr: note.trim() || null });
      toast(decision === "approve" ? "وافقتَ على الملصق" : "وصل طلبُ التعديل");
      setAsking(false); setNote("");
      onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر إرسالُ قرارك");
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-3">
      {titleAr && <p className="mb-2 text-read font-bold leading-6">{titleAr}</p>}
      {p.imageUrl ? (
        <a href={mediaSrc(p.imageUrl)} target="_blank" rel="noreferrer noopener" className="block">
          <Inset className="overflow-hidden p-0">
            <img src={mediaSrc(p.imageUrl)} alt={`ملصقُ ${titleAr ?? "الدورة"} — النسخة ${p.version}`} className="max-h-[28rem] w-full object-contain" loading="lazy" />
          </Inset>
        </a>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Chip tone={st.tone} srPrefixAr="حالُ الملصق">{st.trainerAr}</Chip>
        <span className="text-sm text-muted-foreground">النسخة {p.version}{p.submittedAt ? ` · ${fmtDateLong(p.submittedAt)}` : ""}</span>
      </div>
      {p.staffNoteAr && <p className="mt-2 text-sm leading-6 text-muted-foreground">من الإدارة: {p.staffNoteAr}</p>}
      {p.trainerNoteAr && <p className="mt-1 text-sm leading-6 text-muted-foreground">ما طلبتَه: {p.trainerNoteAr}</p>}

      {p.status === "pending" && !asking && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" tone="confirm" icon={Check} loading={busy} onClick={() => void decide("approve")}>أوافق عليه</Button>
          <Button size="sm" tone="secondary" icon={PenLine} disabled={busy} onClick={() => setAsking(true)}>أطلب تعديلا</Button>
        </div>
      )}
      {p.status === "pending" && asking && (
        <Inset className="mt-3 grid gap-2 p-3">
          <StaffField label="ما الذي تريد تعديلَه؟" hint="الصورة، أو النصّ، أو الألوان — سطرٌ يكفي">
            <textarea className={staffControlCls} rows={2} value={note} maxLength={MAX_MARKETING_NOTE}
              placeholder="مثلا: استعملوا صورتي الثانية، وصحّحوا اسمَ الدورة" onChange={(e) => setNote(e.target.value)} />
          </StaffField>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone="confirm" icon={PenLine} loading={busy} disabled={note.trim().length < 5} onClick={() => void decide("changes")}>
              أرسِلْ طلبَ التعديل
            </Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setAsking(false)}>تراجعْ</Button>
          </div>
        </Inset>
      )}
    </Card>
  );
}
