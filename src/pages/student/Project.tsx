import { useState } from "react";
import { Link } from "react-router";
import {
  CheckCircle2, CircleDashed, FileText, Film, Link2, Lock,
  Mic, Send, Trophy, Upload,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { getEnrollment } from "@/services/access";
import { pathwayById, pathways } from "@/data/pathways";
import { pathwayCourses } from "@/data/courses";
import {
  loadPortal, savePortal, projectConditions, PROJECT_RUBRIC,
  issueCertificate, readUserName, type PortalState, type ProjectStatus,
} from "@/data/student";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  not_open: "مقفل — الشروط غير مكتملة",
  open: "مفتوح — التسليم متاح",
  draft: "مسودة محفوظة",
  submitted: "مُرسل — بانتظار الإسناد لمقيم",
  under_review: "قيد التقييم",
  revision: "مطلوب تعديل — راجع الملاحظات",
  passed: "معتمد — مبارك!",
  failed: "لم يُجتز — متاح الاعتراض",
};

const KINDS = [
  { key: "file", label: "ملف (PDF/عرض/خطة)", icon: FileText },
  { key: "video", label: "فيديو / Demo", icon: Film },
  { key: "audio", label: "صوت / Pitch", icon: Mic },
  { key: "link", label: "رابط (GitHub/Figma/موقع)", icon: Link2 },
] as const;

export default function Project() {
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? pathways[0].id;
  const pathway = pathwayById(pathwayId);
  const [state, setState] = useState<PortalState>(() => loadPortal(pathwayId));
  const [kind, setKind] = useState<"file" | "video" | "audio" | "link">("file");
  const [fields, setFields] = useState({ problem: "", solution: "", tools: "", role: "", evidence: "", reflection: "" });
  const conditions = projectConditions(pathwayId, state);
  const project = state.project;
  const locked = project.status === "not_open";

  const update = (fn: (s: PortalState) => void) => {
    setState((prev) => {
      const next: PortalState = JSON.parse(JSON.stringify(prev));
      fn(next);
      savePortal(next);
      return next;
    });
  };

  const saveDraft = () => update((s) => { s.project = { ...s.project, status: "draft", kind, fields }; });
  const submit = () => {
    update((s) => { s.project = { ...s.project, status: "submitted", kind, fields }; });
    // محاكاة إسناد مقيم ثم اعتماد
    window.setTimeout(() => update((s) => { if (s.project.status === "submitted") s.project.status = "under_review"; }), 6000);
    window.setTimeout(() => {
      update((s) => {
        if (s.project.status === "under_review") {
          s.project = {
            ...s.project, status: "passed",
            feedback: "مشروع متكامل — طبقت مهارات المسار بوضوح، والمخرج قابل للاستخدام فعلا. اعتُمد بامتياز.",
            rubricScores: { problem: 14, skills: 27, quality: 22, analysis: 13, presentation: 9, originality: 5 },
          };
          s.notifications.unshift({ id: `n-${Date.now()}`, text: "اعتُمد مشروع تخرجك — شهادة المسار صدرت!", kind: "certificate", read: false });
        }
      });
      issueCertificate(readUserName(), pathway?.name ?? "مسار وجيز", "pathway");
    }, 15000);
  };

  return (
    <PortalLayout title="مشروع التخرج">
      {/* حالة المشروع */}
      <section className={`rounded-3xl border p-6 ${locked ? "border-white/10 bg-white/[0.02]" : "border-[#FABC05]/30 bg-gradient-to-b from-[#2A2108]/40 to-transparent"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${locked ? "bg-white/5 text-white/30" : "bg-[#FABC05]/15 text-[#FABC05]"}`}>
              {locked ? <Lock className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
            </span>
            <div>
              <h2 className="font-black">مشروع تخرج مسار «{pathway?.name}»</h2>
              <p className="mt-0.5 text-xs text-white/50">{STATUS_LABEL[project.status]}</p>
            </div>
          </div>
        </div>

        {/* شروط الفتح */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {conditions.map((c) => (
            <p key={c.label} className={`flex items-center gap-2 text-xs ${c.met ? "text-[#6EC7D1]" : "text-white/50"}`}>
              {c.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
              {c.label}
            </p>
          ))}
        </div>
        {locked && (
          <Link to="/student/pathway" className="mt-5 inline-block rounded-full bg-[#38A7B4] px-6 py-2.5 text-sm font-black text-[#08272B] hover:bg-[#6EC7D1]">
            أكمل شروط الفتح من خريطة مساري
          </Link>
        )}
      </section>

      {/* نموذج التسليم */}
      {!locked && project.status !== "passed" && (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-black">موجز المشروع</h3>
          <p className="mt-2 text-sm leading-7 text-white/55">
            ابنِ مخرجا حقيقيا على واقعك يثبت مهارات المسار. اختر الصيغة المناسبة، وعبّئ الحقول بصدق —
            يقيّمه مقيم بشري وفق المعايير الموحدة أدناه.
          </p>

          {/* الصيغة */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-bold transition ${
                  kind === k.key ? "border-[#38A7B4] bg-[#38A7B4]/10 text-[#6EC7D1]" : "border-white/10 text-white/55 hover:border-white/25"
                }`}
              >
                <k.icon className="h-5 w-5" />
                {k.label}
              </button>
            ))}
          </div>

          {/* حقول الوصف (الجدول 12.3) */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {([
              ["problem", "المشكلة التي عالجها مشروعك"],
              ["solution", "الحل الذي بنيته"],
              ["tools", "الأدوات التي استخدمتها"],
              ["role", "دورك أنت تحديدا"],
              ["evidence", "الدليل (رابط/وصف المخرج)"],
              ["reflection", "ماذا تعلمت عن نفسك؟"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-bold text-white/60">{label}</label>
                <textarea
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* رفع / رابط */}
          <div className="mt-4 rounded-2xl border-2 border-dashed border-white/15 p-6 text-center text-sm text-white/50">
            <Upload className="mx-auto h-6 w-6 text-white/55" />
            <p className="mt-2">{kind === "link" ? "ألصق الرابط في حقل «الدليل» أعلاه" : "ارفع ملف مشروعك هنا (محاكاة — يُرفع فعليا عند الربط)"}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={saveDraft} className="cursor-pointer rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/75 transition hover:border-white/40">
              احفظ مسودة
            </button>
            <button
              onClick={submit}
              disabled={Object.values(fields).some((v) => !v.trim())}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-[#FABC05] px-6 py-3 text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" /> تسليم نهائي
            </button>
          </div>
        </section>
      )}

      {/* النتيجة والمعايير */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="font-black">معايير التقييم الموحدة (Rubric)</h3>
        <div className="mt-4 space-y-2.5">
          {PROJECT_RUBRIC.map((r) => {
            const got = project.rubricScores?.[r.key];
            return (
              <div key={r.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm">
                <span>{r.label}</span>
                <span className="text-xs text-white/50">
                  {got !== undefined ? <span className="font-black text-[#6EC7D1]">{got} / {r.weight}</span> : `${r.weight}%`}
                </span>
              </div>
            );
          })}
        </div>
        {project.feedback && (
          <div className="mt-4 rounded-xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-4">
            <p className="text-xs font-bold text-[#6EC7D1]">ملاحظات المقيم:</p>
            <p className="mt-1.5 text-sm leading-7 text-white/70">{project.feedback}</p>
          </div>
        )}
        {project.status === "passed" && (
          <Link to="/student/certificates" className="mt-5 block rounded-full bg-[#FABC05] py-3 text-center font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90">
            شهادة مسارك صدرت — اعرضها
          </Link>
        )}
      </section>
    </PortalLayout>
  );
}
