/* مساراتُ المدرّبين — مراجعةُ ما يُعرض على الرفّ العامّ (ن-١ · ن-٢ · ن-٧).

   ═══ ما يُراجَع هنا ═══

   إدراجٌ على الرفّ نفسِه الذي تقف عليه مساراتُ الأكاديميّة، يحمل اسمَ
   إنسان. فالاسمُ يُعتمد **مع المسار في المراجعة نفسِها** (ن-٧): اسمٌ على رفٍّ
   عامّ نصُّ تسويقٍ يحمل مصداقيّةَ الأكاديميّة.

   ═══ وحالُ ظهور المدرّب تُعرض قبل الضغط ═══

   ن-٢ قاعدةُ المستودَع: «لا اسمَ مدرّبٍ يُعرض حقيقةً قبل اعتمادِ نشره».
   والخادمُ يردّ الاعتمادَ لمن لم يُعتمد ظهورُه — لكنّ الردَّ بعد الضغط أسوأُ
   من العلم قبله، فتُعرض الحالُ في البطاقة نفسِها ويُعطَّل الزرّ.

   ═══ والسحبُ لا يمسّ من التحق ═══

   ن-٤: «الرفُّ آليٌّ والعقدُ ليس». فالسحبُ يُخرج المسارَ من الرفّ ولا يُلغي
   تسجيلا ولا يشطب موسما — ويُقال ذلك في الشاشة كي لا يُظنَّ السحبُ إلغاء. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Route, ShieldAlert, X } from "lucide-react";
import AdminLayout from "./AdminLayout";
import EmptyState from "@/components/EmptyState";
import ListToolbar from "@/components/admin/ListToolbar";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";

interface Row {
  id: string;
  titleAr: string;
  blurbAr: string | null;
  status: string;
  slug: string | null;
  termTitleAr: string | null;
  trainerName: string;
  trainerEmail: string;
  trainerPubliclyVisible: boolean;
  reviewNoteAr: string | null;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  courses: { courseId: string; titleAr: string }[];
}

const SAID: Record<string, string> = {
  draft: "مسودّة عند صاحبه",
  submitted: "ينتظر المراجعة",
  published: "على الرفّ العامّ",
  rejected: "ردّ إلى صاحبه",
  retired: "سحب من الرفّ",
};

export default function TrainerPaths() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteKind, setNoteKind] = useState<"reject" | "retire">("reject");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    apiGet<Row[]>(`/api/admin/trainer-paths?scope=${showAll ? "all" : "open"}`)
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل الطابور"));
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setNoteFor(null);
      setNote("");
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(
    () => (rows ?? []).filter((r) => matchesQuery(q, [r.titleAr, r.blurbAr ?? "", r.trainerName, r.trainerEmail])),
    [rows, q],
  );
  const view = paginate(shown, page, 8);

  return (
    <AdminLayout title="مسارات المدرّبين">
      <Card className="mb-4">
        <p className="text-sm leading-7 text-muted-foreground">
          مسار يرتّبه مدرّب من دوراته، ويظهر باسمه في صفحة المسارات تحت
          {" "}<b>«مسارات أعدّها مدرّبونا المعتمدون»</b>. تعتمد اسمه مع المسار هنا لأنّه
          نصّ عامّ يمثّل الأكاديميّة. ولا يدخل في مسارات التشخيص.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
        </div>
      ) : (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مسارا"
            placeholder="ابحث باسم المسار أو باسم المدرّب…" />

          <div className="mb-3 mt-2">
            <Button tone="ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? "أظهر ما ينتظر المراجعة فقط" : "أظهر كلّ المسارات"}
            </Button>
          </div>

          {view.total === 0 ? (
            <EmptyState
              icon={Route}
              titleAr={showAll ? "لا مسار يطابق بحثك" : "لا مسار ينتظر المراجعة"}
              reasonAr="حين يرسل مدرّب مسارا من دوراته يصل هنا قبل أن يظهر للعامّة."
            />
          ) : (
            <div className="grid gap-3">
              {view.rows.map((r) => {
                const pending = r.status === "submitted";
                const live = r.status === "published";
                return (
                  <Card key={r.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[16rem] flex-1">
                        <div className="text-read font-bold text-foreground">{r.titleAr}</div>
                        {r.blurbAr ? (
                          <div className="mt-0.5 text-sm text-muted-foreground">{r.blurbAr}</div>
                        ) : null}
                        <div className="mt-1 text-sm text-muted-foreground">
                          أعدّه <b className="text-foreground">{r.trainerName}</b>
                          <span className="text-muted-foreground/70"> · {r.trainerEmail}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold">{SAID[r.status] ?? r.status}</span>
                          {r.termTitleAr ? <span>{r.termTitleAr}</span> : <span>بلا موسم</span>}
                          <span>{r.courses.length} دورات</span>
                          <span>{r.publishedAt ? `نشر ${fmtDateLong(r.publishedAt)}` : `وصل ${fmtDateLong(r.createdAt)}`}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {pending ? (
                          <>
                            <Button
                              tone="confirm" icon={Check} disabled={busy || !r.trainerPubliclyVisible}
                              onClick={() => run(
                                () => apiPost(`/api/admin/trainer-paths/${r.id}/approve`),
                                "نشر المسار على الرفّ",
                              )}
                            >
                              انشره
                            </Button>
                            <Button
                              tone="danger" icon={X} disabled={busy}
                              onClick={() => { setNoteFor(noteFor === r.id ? null : r.id); setNoteKind("reject"); }}
                            >
                              ردّه
                            </Button>
                          </>
                        ) : null}
                        {live ? (
                          <Button
                            tone="danger" icon={X} disabled={busy}
                            onClick={() => { setNoteFor(noteFor === r.id ? null : r.id); setNoteKind("retire"); }}
                          >
                            اسحبه من الرفّ
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* ن-٢ — يُقال قبل الضغط، لا يُردّ بعده */}
                    {pending && !r.trainerPubliclyVisible ? (
                      <Inset tone="danger" className="mt-3 flex items-start gap-2 text-sm leading-7 text-red-300">
                        <ShieldAlert className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                        <span>
                          لم يعتمد ظهور <b>{r.trainerName}</b> للعامّة بعد، والمسار يحمل اسمه فلا ينشر قبل ذلك.
                          اعتمده من «طلبات المدربين» ثمّ عد.
                        </span>
                      </Inset>
                    ) : null}

                    {r.reviewNoteAr ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        <b className="text-foreground">ما قيل لصاحبه:</b> {r.reviewNoteAr}
                      </Inset>
                    ) : null}

                    <ol className="mt-3 grid gap-1">
                      {r.courses.map((c, i) => (
                        <li key={c.courseId} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="font-bold text-teal">{i + 1}.</span>{c.titleAr}
                          <span className="text-muted-foreground/60">({c.courseId})</span>
                        </li>
                      ))}
                    </ol>

                    {noteFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField
                          label={noteKind === "reject" ? "لماذا يردّ؟" : "لماذا يسحب؟"}
                          hint={noteKind === "reject"
                            ? "يقرؤه المدرّب في بوّابته — وبلا سبب قد يعيده كما هو"
                            : "السحب يخفيه من الصفحة، ولا يؤثّر على المسجّلين ولا يلغي أيّ موسم"}
                        >
                          <input
                            className={staffControlCls} value={note} maxLength={2000}
                            placeholder={noteKind === "reject"
                              ? "مثلا: الاسم يعد بما لا تغطّيه دوراته الثلاث"
                              : "مثلا: انتهى تعاقدنا معه"}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="danger" icon={Check} loading={busy}
                            disabled={noteKind === "reject" && note.trim().length < 5}
                            onClick={() => run(
                              () => noteKind === "reject"
                                ? apiPost(`/api/admin/trainer-paths/${r.id}/reject`, { noteAr: note.trim() })
                                : apiPost(`/api/admin/trainer-paths/${r.id}/retire`, { noteAr: note.trim() || null }),
                              noteKind === "reject" ? "ردّ إلى صاحبه" : "سحب من الرفّ",
                            )}
                          >
                            {noteKind === "reject" ? "ردّه" : "اسحبه"}
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setNoteFor(null)}>تراجع</Button>
                        </div>
                      </Inset>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
