/* دوراتٌ اقترحها المدرّبون — تُصنَّف قبل أن تدخل الكتالوج (ح-٤).

   ═══ القرارُ أوّلا، ثمّ الإنشاء ═══

   «قريبةٌ من رمزٍ قائم → نسخةٌ منه · جديدةٌ حقّا → دورةٌ لها مهاراتُها».
   وهما بابان مختلفان في الأثر: الأوّلُ لا يزيد الكتالوجَ شيئا — الرمزُ
   موجودٌ وبصمةُ مهارته محسوبةٌ في التشخيص — والثاني يزيده عقدةً جديدة.
   فالخلطُ بينهما يقيس المهارةَ مرّتَين أو يترك دورةً لا يجدها التشخيص.

   ═══ ولا يُنشأ الإصدارُ باسم صاحبه ═══

   «نسخةٌ من رمزٍ قائم» **تربط ولا تكتب**: الاقتراحُ يُعلَّق بالرمز، ويُترك
   للمدرّب أن يقترح اسمَه ومحاورَه بنفسه في قناة ح-٣ (maker-checker ودائرةُ
   أثرٍ وإصدارٌ جديد). وإنشاؤه آليّا يضع في فمه ما لم يكتبه، ثمّ يُنسب إليه
   في سجلّ الأثر.

   ═══ والدورةُ الجديدةُ تُنشأ في نموذجها لا في نموذجٍ ثانٍ هنا ═══

   نموذجُ الكتالوج يحمل المسارَ والتسلسلَ والساعاتِ والمهاراتِ والوحداتِ
   ومدقّقَ التمارين. ونسخةٌ أنحفُ منه في هذه الشاشة تتخلّف عنه بعد شهرٍ
   وتُنشئ دوراتٍ ناقصةً بابُها من هنا. فالزرُّ يُحيل إلى النموذج نفسِه
   محمَّلا بعنوان الاقتراح، ثمّ يعود فيربط ما أُنشئ بالاقتراح.

   ═══ والرفضُ بسبب ═══

   من رُفض اقتراحُه بلا سببٍ لا يتعلّم شيئا: يُعيده كما هو بعد شهر. فالسببُ
   يلزم في الخادم لا في الشاشة وحدَها. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookPlus, Check, Link2, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router";
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
  profileId: string;
  trainerName: string;
  trainerEmail: string;
  titleAr: string;
  audienceAr: string | null;
  status: string;
  courseId: string | null;
  courseTitleAr: string | null;
  decisionNoteAr: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/* والحقلُ `title` لا `titleAr`: هكذا يردّه `/api/admin/catalog/courses`.
   وواجهةٌ تسمّيه بغير اسمه تُظهر قائمةً من الفراغ بلا خطأٍ يُرى. */
interface CourseRow { id: string; title: string; status: string }

const OPEN = ["draft", "submitted"];

const SAID: Record<string, string> = {
  linked: "نسخةٌ من رمزٍ قائم",
  became_course: "صارت دورةً في الكتالوج",
  rejected: "لم تُقبل",
};

export default function CourseProposals() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showDecided, setShowDecided] = useState(false);

  /* بابٌ مفتوحٌ واحدٌ في كلّ وقت: الربطُ أو الرفض، لا الاثنان معا */
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkCourse, setLinkCourse] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(() => {
    Promise.all([
      apiGet<Row[]>(`/api/admin/course-proposals?scope=${showDecided ? "all" : "open"}`),
      apiGet<CourseRow[]>("/api/admin/catalog/courses"),
    ])
      .then(([r, c]) => { setRows(r); setCourses(c); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل الطابور"));
  }, [showDecided]);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setLinkFor(null);
      setRejectFor(null);
      setLinkCourse("");
      setRejectNote("");
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(
    () => (rows ?? []).filter((r) => matchesQuery(q, [r.titleAr, r.audienceAr ?? "", r.trainerName, r.trainerEmail])),
    [rows, q],
  );

  const view = paginate(shown, page, 8);

  return (
    <AdminLayout title="دوراتٌ اقترحها المدرّبون">
      <Card className="mb-4">
        <p className="text-sm leading-7 text-muted-foreground">
          كلُّ اقتراحٍ هنا <b>ليس دورةً بعد</b>: لا يظهر في الكتالوج ولا يُحسب في التشخيص حتّى يُصنَّف.
          وبابان لا ثالثَ لهما — <b>نسخةٌ من رمزٍ قائم</b> إن كانت قريبةً منه فتُربط به ويقترح المدرّبُ
          نسختَه بنفسه، أو <b>دورةٌ جديدة</b> تُنشأ في نموذج الكتالوج بمهاراتها ثمّ تُربط هنا.
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
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="اقتراحا"
            placeholder="ابحث بعنوانِ الدورة أو باسم المدرّب…" />

          <div className="mb-3 mt-2">
            <Button tone="ghost" onClick={() => setShowDecided(!showDecided)}>
              {showDecided ? "أظهِر ما لم يُصنَّف وحدَه" : "أظهِر ما صُنِّف أيضا"}
            </Button>
          </div>

          {view.total === 0 ? (
            <EmptyState
              icon={BookPlus}
              titleAr={showDecided ? "لا اقتراحَ يطابق بحثَك" : "لا اقتراحَ ينتظر التصنيف"}
              reasonAr="تصل هنا الدوراتُ التي يقولها المدرّبون في طلبِ انضمامهم أو من بوّابتهم — ولا تدخل الكتالوجَ حتّى تُصنَّف."
            />
          ) : (
            <div className="grid gap-3">
              {view.rows.map((r) => {
                const open = OPEN.includes(r.status);
                return (
                  <Card key={r.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[16rem] flex-1">
                        <div className="text-read font-bold text-foreground">{r.titleAr}</div>
                        {r.audienceAr ? (
                          <div className="mt-0.5 text-sm text-muted-foreground">لمن: {r.audienceAr}</div>
                        ) : null}
                        <div className="mt-1 text-sm text-muted-foreground">
                          اقترحها <b className="text-foreground">{r.trainerName}</b>
                          <span className="text-muted-foreground/70"> · {r.trainerEmail}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground/70">
                          {r.decidedAt ? `صُنِّفت ${fmtDateLong(r.decidedAt)}` : `وصلت ${fmtDateLong(r.createdAt)}`}
                        </div>
                      </div>

                      {open ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            tone="secondary" icon={Link2} disabled={busy}
                            onClick={() => { setLinkFor(linkFor === r.id ? null : r.id); setRejectFor(null); }}
                          >
                            نسخةٌ من رمزٍ قائم
                          </Button>
                          {/* الإنشاءُ في نموذج الكتالوج نفسِه — مع عنوان الاقتراح ومعرّفه،
                              فيعود النموذجُ ويربط ما أُنشئ بصاحبه بلا نسخٍ يدويّ. */}
                          <Button
                            tone="confirm" icon={BookPlus} disabled={busy}
                            onClick={() => nav(
                              `/admin/catalog?proposalId=${r.id}`
                              + `&titleAr=${encodeURIComponent(r.titleAr)}#course`,
                            )}
                          >
                            دورةٌ جديدة
                          </Button>
                          <Button
                            tone="danger" icon={X} disabled={busy}
                            onClick={() => { setRejectFor(rejectFor === r.id ? null : r.id); setLinkFor(null); }}
                          >
                            لا تُقبل
                          </Button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                          {SAID[r.status] ?? r.status}
                        </span>
                      )}
                    </div>

                    {/* ما صارت إليه، وما قيل لصاحبها */}
                    {!open ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        {r.courseId ? <>الرمز: <b className="text-foreground">{r.courseId}</b>{r.courseTitleAr ? ` — ${r.courseTitleAr}` : ""}. </> : null}
                        {r.decisionNoteAr || (r.status === "rejected" ? "بلا سببٍ مكتوب." : "")}
                      </Inset>
                    ) : null}

                    {/* ── الربطُ برمزٍ قائم ── */}
                    {linkFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField
                          label="أيُّ رمزٍ هي نسخةٌ منه؟"
                          hint="يُربط الاقتراحُ به، ويقترح المدرّبُ اسمَه ومحاورَه بنفسه"
                        >
                          <select
                            className={staffControlCls} value={linkCourse}
                            onChange={(e) => setLinkCourse(e.target.value)}
                          >
                            <option value="">اختر دورة…</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.title} — {c.id}</option>
                            ))}
                          </select>
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="confirm" icon={Check} loading={busy} disabled={!linkCourse}
                            onClick={() => run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/link`, { courseId: linkCourse }),
                              "رُبط الاقتراحُ بالرمز",
                            )}
                          >
                            اربِطها
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setLinkFor(null)}>تراجَع</Button>
                        </div>
                      </Inset>
                    ) : null}

                    {/* ── الرفضُ بسبب ── */}
                    {rejectFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField label="لماذا لا تُقبل؟" hint="يقرؤه المدرّبُ في بوّابته — وبلا سببٍ يُعيدها كما هي">
                          <input
                            className={staffControlCls} value={rejectNote} maxLength={2000}
                            placeholder="مثلا: مغطّاةٌ في C-AUT-103، ولا تضيف مهارةً جديدة"
                            onChange={(e) => setRejectNote(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="danger" icon={Check} loading={busy} disabled={rejectNote.trim().length < 5}
                            onClick={() => run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/reject`, { noteAr: rejectNote.trim() }),
                              "سُجّل الرفضُ بسببه",
                            )}
                          >
                            ارفِضها
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setRejectFor(null)}>تراجَع</Button>
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
