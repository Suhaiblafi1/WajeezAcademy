/* مساراتي — أرتّب دوراتي في مسارٍ باسمي ويُعرض على الرفّ العامّ (ن-١).

   ═══ وما يفصل هذا عن «دعوتي» (و-١) ═══

   رابطُ الدعوة تسويقٌ خاصّ يُرسله صاحبُه لمن يعرف. وهذا **إدراجٌ على الرفّ
   نفسِه** الذي تقف عليه مساراتُ الأكاديميّة، يحمل اسمَ إنسانٍ أمام غرباء.
   ولذلك يمرّ بمراجعة، ولذلك يشترط أن يكون ظهورُ اسمه معتمَدا.

   ═══ وما ينقص يُقال قبل الإرسال لا بعده ═══

   `blockersAr` تأتي من الخادم محسوبةً بالقسمة نفسِها التي يردّ بها الإرسالَ
   (`path-rules.ts`) — فما يراه هنا هو بعينه ما سيمنعه، لا تخمينُ شاشة.

   ═══ ولا سعرَ في هذه الشاشة ═══

   ن-٦: «السعرُ والسعةُ بيد الإدارة». ولا حقلَ سعرٍ في المخطّط أصلا، فليس
   ثمّة ما تخفيه الشاشةُ — ليس ثمّة ما يُكتب. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Route, Send, Trash2, X } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import {
  MAX_PATH_BLURB, MAX_PATH_COURSES, MAX_PATH_TITLE, MIN_PATH_COURSES,
} from "@/application/trainer/path-rules";

interface PathCourse { courseId: string; titleAr: string; sequence: number }
interface MyPath {
  id: string;
  titleAr: string;
  blurbAr: string | null;
  status: string;
  slug: string | null;
  reviewNoteAr: string | null;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  term: { id: string; titleAr: string; registrationOpensAt: string | null; startsOn: string } | null;
  courses: PathCourse[];
  blockersAr: string[];
  editable: boolean;
}
interface MyCourse { courseId: string; titleAr: string }
interface MyTerm { id: string; titleAr: string }

const SAID: Record<string, { label: string; tone: "wait" | "good" | "bad" }> = {
  draft: { label: "مسودّة عندك", tone: "wait" },
  submitted: { label: "عند الإدارة", tone: "wait" },
  published: { label: "على الرفّ العامّ", tone: "good" },
  rejected: { label: "رُدَّ إليك", tone: "bad" },
  retired: { label: "سُحب من الرفّ", tone: "bad" },
};

interface Draft { titleAr: string; blurbAr: string; termId: string; courseIds: string[] }
const EMPTY: Draft = { titleAr: "", blurbAr: "", termId: "", courseIds: [] };

export default function MyPaths() {
  const [rows, setRows] = useState<MyPath[] | null>(null);
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [terms, setTerms] = useState<MyTerm[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* محرّرٌ واحدٌ في كلّ وقت: `null` مغلق · `"new"` جديد · معرّفٌ تعديل */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const load = useCallback(() => {
    Promise.all([
      apiGet<MyPath[]>("/api/trainer/paths"),
      apiGet<MyCourse[]>("/api/trainer/paths/courses"),
      apiGet<MyTerm[]>("/api/trainer/me/terms"),
    ])
      .then(([p, c, t]) => { setRows(p); setMyCourses(c); setTerms(t); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل مساراتك"));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setEditing(null);
      setDraft(EMPTY);
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ ما طلبت");
    } finally {
      setBusy(false);
    }
  }

  const toggleCourse = (id: string) =>
    setDraft((d) => ({
      ...d,
      courseIds: d.courseIds.includes(id)
        ? d.courseIds.filter((x) => x !== id)
        : d.courseIds.length >= MAX_PATH_COURSES ? d.courseIds : [...d.courseIds, id],
    }));

  const openEditor = (p: MyPath | null) => {
    setEditing(p ? p.id : "new");
    setDraft(p
      ? {
        titleAr: p.titleAr, blurbAr: p.blurbAr ?? "", termId: p.term?.id ?? "",
        courseIds: p.courses.map((c) => c.courseId),
      }
      : EMPTY);
  };

  const canSave = useMemo(
    () => draft.titleAr.trim().length > 0 && draft.courseIds.length > 0,
    [draft],
  );

  const editor = (
    <Inset className="mt-3 grid gap-3">
      <StaffField label="اسمُ المسار" hint="يظهر على الرفّ العامّ ويُعتمد مع المسار">
        <input
          value={draft.titleAr} maxLength={MAX_PATH_TITLE} className={staffControlCls}
          placeholder="مثلا: من الفكرة إلى أوّل عمليّة مؤتمتة"
          onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })}
        />
      </StaffField>

      <StaffField label="نبذةٌ قصيرة" hint="لا تلزم">
        <input
          value={draft.blurbAr} maxLength={MAX_PATH_BLURB} className={staffControlCls}
          placeholder="لمن هو، وما يخرج به"
          onChange={(e) => setDraft({ ...draft, blurbAr: e.target.value })}
        />
      </StaffField>

      {/* ن-٣: موسمٌ من التقويم لا نصّ — فالبطاقةُ تقول متى يُفتح التسجيلُ صدقا */}
      <StaffField label="الموسمُ الذي يعمل فيه" hint="من تقويم الأكاديميّة — لا نصّ يبلى">
        <select
          className={staffControlCls} value={draft.termId}
          onChange={(e) => setDraft({ ...draft, termId: e.target.value })}
        >
          <option value="">اختر موسما…</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.titleAr}</option>)}
        </select>
      </StaffField>

      <StaffField
        as="div"
        label={`دوراتُه (${draft.courseIds.length} من ${MAX_PATH_COURSES})`}
        hint={`من دوراتك التي أُهِّلتَ لها — ${MIN_PATH_COURSES} فأكثر، والترتيبُ ترتيبُ اختيارك`}
      >
        {myCourses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            لا دورةَ أُهِّلتَ لها بعد — والمسارُ يُبنى من دوراتك.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {myCourses.map((c) => {
              const at = draft.courseIds.indexOf(c.courseId);
              return (
                <button
                  key={c.courseId} type="button"
                  onClick={() => toggleCourse(c.courseId)}
                  className={
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-right text-sm transition "
                    + (at >= 0
                      ? "border-teal/60 bg-teal/10 text-foreground font-bold"
                      : "border-white/15 text-muted-foreground hover:border-white/40")
                  }
                >
                  <span className={at >= 0 ? "text-teal" : "text-muted-foreground/50"}>
                    {at >= 0 ? at + 1 : "—"}
                  </span>
                  {c.titleAr}
                </button>
              );
            })}
          </div>
        )}
      </StaffField>

      <div className="flex gap-2">
        <Button
          tone="confirm" icon={Check} loading={busy} disabled={!canSave}
          onClick={() => run(
            () => editing === "new"
              ? apiPost("/api/trainer/paths", {
                titleAr: draft.titleAr.trim(), blurbAr: draft.blurbAr.trim() || null,
                termId: draft.termId || null, courseIds: draft.courseIds,
              })
              : apiPatch(`/api/trainer/paths/${editing}`, {
                titleAr: draft.titleAr.trim(), blurbAr: draft.blurbAr.trim() || null,
                termId: draft.termId || null, courseIds: draft.courseIds,
              }),
            "حُفظ المسار",
          )}
        >
          احفظ
        </Button>
        <Button tone="ghost" icon={X} onClick={() => { setEditing(null); setDraft(EMPTY); }}>تراجَع</Button>
      </div>
    </Inset>
  );

  return (
    <TrainerLayout title="مساراتي">
      <Card className="mb-4">
        <h2 className="mb-1 text-read font-bold text-foreground">مسارٌ ترتّبه من دوراتك — باسمك</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          تختار دوراتٍ أُهِّلتَ لها، وترتّبها، وتسمّيها. وبعد اعتماد الإدارة يظهر على صفحة
          المسارات تحت <b>«مسارات أعدّها مدرّبونا المعتمدون»</b> باسمك وبالموسم الذي يعمل فيه.
          {" "}والسعرُ والسعةُ بيد الإدارة كما في شعبك.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <>
          {editing === "new" ? (
            <Card className="mb-4">
              <h3 className="text-read font-bold text-foreground">مسارٌ جديد</h3>
              {editor}
            </Card>
          ) : (
            <div className="mb-4">
              <Button tone="primary" icon={Route} onClick={() => openEditor(null)}>ابنِ مسارا</Button>
            </div>
          )}

          {rows.length === 0 && editing !== "new" ? (
            <EmptyState
              icon={Route}
              titleAr="لا مسارَ بعد"
              reasonAr="رتّب دوراتك في مسارٍ يحمل اسمَك — يراه الزائرُ على صفحة المسارات بعد اعتماد الإدارة."
            />
          ) : (
            <div className="grid gap-3">
              {rows.map((p) => {
                const st = SAID[p.status] ?? { label: p.status, tone: "wait" as const };
                return (
                  <Card key={p.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[14rem] flex-1">
                        <div className="text-read font-bold text-foreground">{p.titleAr}</div>
                        {p.blurbAr ? (
                          <div className="mt-0.5 text-sm text-muted-foreground">{p.blurbAr}</div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              "rounded-full px-2.5 py-0.5 text-xs font-bold "
                              + (st.tone === "good"
                                ? "bg-teal/15 text-teal"
                                : st.tone === "bad"
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-white/10 text-muted-foreground")
                            }
                          >
                            {st.label}
                          </span>
                          {p.term ? (
                            <span className="text-xs text-muted-foreground/70">{p.term.titleAr}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground/70">
                            {p.courses.length} دوراتٍ
                          </span>
                        </div>
                      </div>

                      {p.editable ? (
                        <div className="flex flex-wrap gap-2">
                          <Button tone="ghost" icon={Pencil} disabled={busy} onClick={() => openEditor(p)}>عدّل</Button>
                          <Button
                            tone="confirm" icon={Send} disabled={busy || p.blockersAr.length > 0}
                            onClick={() => run(() => apiPost(`/api/trainer/paths/${p.id}/submit`), "وصل الإدارةَ")}
                          >
                            أرسِله للمراجعة
                          </Button>
                          <Button
                            tone="danger" icon={Trash2} disabled={busy}
                            onClick={() => run(() => apiDelete(`/api/trainer/paths/${p.id}`), "حُذف المسار")}
                          >
                            احذف
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {/* ما ينقص — قبل الإرسال لا بعده */}
                    {p.editable && p.blockersAr.length > 0 ? (
                      <Inset className="mt-3">
                        <p className="mb-1 text-sm font-bold text-foreground">قبل أن يُرسَل:</p>
                        <ul className="grid gap-1">
                          {p.blockersAr.map((b) => (
                            <li key={b} className="text-sm text-muted-foreground">· {b}</li>
                          ))}
                        </ul>
                      </Inset>
                    ) : null}

                    {/* وجوابُ الإدارة — وهو ما جاء يقرؤه */}
                    {p.reviewNoteAr ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        <b className="text-foreground">من الإدارة:</b> {p.reviewNoteAr}
                      </Inset>
                    ) : null}

                    {p.status === "published" ? (
                      <Inset className="mt-3 text-sm text-muted-foreground">
                        على الرفّ منذ {fmtDateLong(p.publishedAt ?? "")} — يظهر في صفحة المسارات باسمك.
                      </Inset>
                    ) : null}

                    <ol className="mt-3 grid gap-1">
                      {p.courses.map((c, i) => (
                        <li key={c.courseId} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="font-bold text-teal">{i + 1}.</span>{c.titleAr}
                        </li>
                      ))}
                    </ol>

                    {editing === p.id ? editor : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </TrainerLayout>
  );
}
