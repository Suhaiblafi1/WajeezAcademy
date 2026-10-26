/* ═══ «انقلها إلى دورة أخرى» — لشعبةٍ فُتحت على الدورة الخطأ (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: شعبةُ «علامتك الشخصية» فُتحت على «كتابة المحتوى الاستراتيجي»، فتُنقل إلى دورتها
   الجديدة بزرٍّ يبقى لكلّ شعبةٍ مثلها. ويُعرض قبل التنفيذ ما ينتقل معها، وتأهيلُ مدرّبها في الجديدة، وما
   يمنعه — ولا شيءَ يُنقل وفيها متعلّم. والقاعدةُ في الخادم (`cohort-course-move.service.ts`) لا هنا. */

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { controlCls } from "@/components/FormKit";

interface CourseRow { id: string; title: string; status: string }
interface Preview {
  canMove: boolean;
  blockedAr: string | null;
  from: { id: string; titleAr: string };
  to: { id: string; titleAr: string; status: string };
  trainers: { name: string; qualification: "has" | "created" | "blocked" }[];
  noticeAr: string | null;
}

const QUAL_AR = { has: "مؤهل لها", created: "يؤهل لها بالنقل", blocked: "لا يؤهل" } as const;

export default function CourseMoveBox({ cohortId, status, courseId, onDone }: {
  cohortId: string;
  status: string;
  courseId: string;
  onDone: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [pick, setPick] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || courses) return;
    apiGet<CourseRow[]>("/api/admin/catalog/courses")
      .then((rows) => setCourses(rows.filter((c) => c.id !== courseId && c.status !== "archived")))
      .catch(() => setErr("تعذرت قراءة الدورات"));
  }, [open, courses, courseId]);

  useEffect(() => {
    setPreview(null);
    if (!pick) return;
    let alive = true;
    apiGet<Preview>(`/api/admin/cohorts/${cohortId}/course-move-preview?to=${encodeURIComponent(pick)}`)
      .then((p) => { if (alive) setPreview(p); })
      .catch((e) => { if (alive) setErr(e instanceof ApiError ? e.message : "تعذرت المعاينة"); });
    return () => { alive = false; };
  }, [cohortId, pick]);

  if (["completed", "cancelled"].includes(status)) return null;

  if (!open) {
    return (
      <Button tone="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> انقلها إلى دورة أخرى
      </Button>
    );
  }

  const move = async () => {
    if (!preview?.canMove) return;
    setBusy(true); setErr(null);
    try {
      await apiPost(`/api/admin/cohorts/${cohortId}/course-move`, { toCourseId: pick });
      setOpen(false); setPick("");
      onDone(`نقلت إلى «${preview.to.titleAr}»`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذر النقل — حاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Inset className="grid w-full gap-2 p-3">
      <p className="text-read leading-6 text-muted-foreground">
        لشعبة فتحت على الدورة الخطأ. تنتقل معها إسنادات مدربها وقواعد أجرها وإتمامها، وتبقى خطته كما هي. ولا تنقل وفيها متعلم.
      </p>
      <select aria-label="الدورة" value={pick} onChange={(e) => { setErr(null); setPick(e.target.value); }}
        className={`${controlCls} [&>option]:bg-surface`} disabled={!courses}>
        <option value="">{courses ? "اختر الدورة…" : "تحميل…"}</option>
        {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.title} ({c.id})</option>)}
      </select>
      {preview && (
        <div className="grid gap-1 text-read leading-6">
          <p>من «{preview.from.titleAr}» إلى «{preview.to.titleAr}».</p>
          {preview.trainers.map((t) => (
            <p key={t.name} className="text-muted-foreground">{t.name}: {QUAL_AR[t.qualification]}</p>
          ))}
          {preview.noticeAr && <p className="text-muted-foreground">{preview.noticeAr}</p>}
          {preview.blockedAr && <p role="alert" className="font-bold text-danger-ink">{preview.blockedAr}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button tone="confirm" size="sm" type="button" loading={busy}
          disabled={busy || !preview?.canMove} onClick={() => void move()}>
          انقلها
        </Button>
        <Button tone="secondary" size="sm" type="button" disabled={busy} onClick={() => { setOpen(false); setPick(""); setErr(null); }}>
          إلغاء
        </Button>
      </div>
      {err && <p role="alert" className="text-read text-danger-ink">{err}</p>}
    </Inset>
  );
}
