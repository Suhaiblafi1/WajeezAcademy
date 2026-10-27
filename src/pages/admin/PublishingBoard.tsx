/* لوحة النشر والإصدارات — ما يقرؤه الموقع الآن، و«انشر الآن»، والإصدارات والرجوع إليها.

   ═══ وصغرت (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — ج) ═══

   كانت أربعَ خطواتٍ آخرُها «نشر للطلاب — من هذه الشاشة»، وثلاثَ بطاقاتٍ مرقّمة: «التحقق البنيوي» و«تحليل الأثر» و«نشر
   إصدار» بوسمٍ يُكتب باليد (`2026.08.16-01`)، وتحتها «اختبار الارتداد». والموقعُ اليومَ ينشر نفسَه مع كلّ تحديث ومع كلّ
   اسم دورةٍ يُعتمد، والنشرُ يتحقّق ويحلّل الأثرَ قبل أن ينشر (`publishSnapshotIfChanged`)، واختبارُ الارتداد بتفصيله في
   «جودة التشخيص». فبقي ما لا يقع إلّا هنا: «انشر الآن» لما اعتُمد ولم يُنشر بعد، والإصدارات، والرجوعُ إلى لقطةٍ سابقة —
   ويُقال قبله إنّه يبقى حتى النشر التالي، فكلُّ نشرٍ يعيد ما في الجداول.

   والأزرارُ لمن يملك فعلَها (`catalog.pathway.publish` و`catalog.rollback`) — كانت لكلّ من يفتح الصفحة فيُردّ ٤٠٣. */
import { useCallback, useEffect, useState } from "react";
import { History, Rocket, Trash2, Undo2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiDelete, apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { useRealSession } from "@/services/session";
import {
  publishNowAr, versionLineAr, VERSION_STATUS_AR, type PublishNowResult, type VersionRow,
} from "@/application/catalog/publishing-text";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ConfirmAction from '@/components/ConfirmAction'
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";

type Version = VersionRow & { id: string; label: string; snapshots: { payloadHash: string }[] };

export default function PublishingBoard() {
  const [versions, setVersions] = useState<Version[]>([]);
  /* الإصداراتُ تتراكم ولا تُحذف — فهي أطولُ ما في اللوحة نموّا، وكانت
     تُصبّ دفعةً واحدةً بلا بحثٍ ولا ترقيم. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null)
  const [published, setPublished] = useState<string | null>(null);
  /* مسودّةٌ تنتظر تأكيدَ حذفها — نافذةٌ واحدةٌ للفعل الذي لا يُستعاد */
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  /* والرجوعُ يغيّر ما يراه المتعلّمون كلُّهم — فيُقال أثرُه ومدّتُه قبل أن يقع */
  const [pendingRollback, setPendingRollback] = useState<{ id: string; label: string } | null>(null);
  const { user: me } = useRealSession();
  const canPublish = me?.permissions.includes("catalog.pathway.publish") ?? false;
  const canRollback = me?.permissions.includes("catalog.rollback") ?? false;

  const refresh = useCallback(async () => {
    try {
      setVersions(await apiGet<Version[]>("/api/admin/publishing/versions"));
    } catch (e) {
      setError(permissionMessage(e, "تعذر تحميل الإصدارات"));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const current = versions.find((v) => v.status === "published") ?? null;
  const matched = versions.filter((v) => matchesQuery(q, [v.label, VERSION_STATUS_AR[v.status], v.status]));
  const view = paginate(matched, page, 20);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(null); }
  };

  const publishNow = () => act("now", async () => {
    setPublished(null);
    setPublished(publishNowAr(await apiPost<PublishNowResult>("/api/admin/publishing/publish-now")));
  });

  return (
    <AdminLayout title="النشر والإصدارات">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      <Card as="section">
        <h2 className="flex items-center gap-2 font-black"><Rocket className="h-5 w-5 text-gold-ink" /> ما يقرؤه الموقع</h2>
        <p className="mt-3 text-sm text-foreground">
          {current
            ? <>المنشور الآن: <span dir="ltr" className="font-bold">{current.label}</span> · {versionLineAr(current)}</>
            : "لا لقطة منشورة بعد."}
        </p>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          ينشر الموقع ما في الجداول مع كل تحديث له، ومع كل اسم دورة يعتمد. وما اعتمد غير ذلك ينتظر النشر التالي، أو «انشر الآن».
        </p>
        {canPublish && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button tone="confirm" loading={busy === "now"} disabled={busy !== null} onClick={() => void publishNow()}>
              انشر الآن
            </Button>
            <span className="text-read text-muted-foreground">يحلل أثره على الشخصيات ثم ينشر كاملا، ولا ينشر شيئا إن لم يتغير شيء.</span>
          </div>
        )}
        {published && <p role="status" className="mt-3 text-sm text-teal-light-ink">{published}</p>}
      </Card>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><History className="h-5 w-5 text-gold-ink" /> الإصدارات</h2>
        <div className="mt-4">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="إصدارا"
            placeholder="ابحث بوسم الإصدار أو حاله…" />
        </div>
        <div className="space-y-2">
          {view.rows.map((v) => (
            <Card key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold text-sm" dir="ltr">{v.label}</p>
                <p className="mt-0.5 text-read text-muted-foreground">{versionLineAr(v)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-fine font-bold ${v.status === "published" ? "border-emerald-400/30 text-emerald-300" : "border-white/15 text-muted-foreground"}`}>
                  {VERSION_STATUS_AR[v.status] ?? v.status}
                </span>
                {canRollback && v.status !== "published" && v.snapshots.length > 0 && (
                  <Button tone="secondary" size="sm" disabled={busy !== null} onClick={() => setPendingRollback({ id: v.id, label: v.label })}>
                    <Undo2 className="h-3.5 w-3.5" /> ارجع إليه
                  </Button>
                )}
                {/* مسودة بلا لقطة = نشرٌ أخفق بعد إنشاء الإصدار: لا تُنشر ولا
                    تُسترجع، وتحجز تسميتها للأبد. هذا طريقها الوحيد للخروج. */}
                {canPublish && v.status === "draft" && v.snapshots.length === 0 && (
                  <Button tone="danger" size="sm" disabled={busy !== null}
                    /* كان `confirm` خامّا: سطرٌ واحدٌ في حوار متصفّحٍ يملك
                       المستخدمُ كتمَه — فيصير الحذفُ لا يقع ولا يُقال لماذا. */
                    onClick={() => setPendingDelete({ id: v.id, label: v.label })}>
                    <Trash2 className="h-3.5 w-3.5" /> احذف المسودة
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {pendingRollback && (
        <ConfirmAction
          titleAr={`الرجوع إلى «${pendingRollback.label}»`}
          confirmLabelAr="ارجع إليه"
          tone="default"
          busy={busy !== null}
          onCancel={() => setPendingRollback(null)}
          onConfirm={() => {
            const target = pendingRollback
            setPendingRollback(null)
            void act(`rb-${target.id}`, () => apiPost("/api/admin/publishing/rollback", { targetVersionId: target.id, reasonAr: "رجوع من لوحة النشر" }))
          }}
        >
          <p>ينشر لقطة هذا الإصدار كما هي، فيرى المتعلمون الكتالوج كما كان يومها. ولا يتغير شيء في الجداول.</p>
          <p><b className="text-foreground">ويبقى حتى النشر التالي</b>: كل تحديث للموقع، وكل اسم دورة يعتمد، و«انشر الآن» تنشر ما في الجداول من جديد.</p>
        </ConfirmAction>
      )}

      {pendingDelete && (
        <ConfirmAction
          titleAr={`حذف المسودّة المعلّقة «${pendingDelete.label}»`}
          confirmLabelAr="احذف المسودّة"
          busy={busy !== null}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void act(`del-${target.id}`, () => apiDelete(`/api/admin/publishing/versions/${target.id}`, { reasonAr: "تنظيف مسودة معلّقة من لوحة النشر" }))
          }}
        >
          <p>مسودّة بلا لقطة تعني أنّ النشر فشل بعد إنشاء الإصدار: لا تنشر ولا تسترجع، وتبقى تسميتها محجوزة دائما.</p>
          <p>بحذفها <b className="text-foreground">تصبح التسمية متاحة</b>، ويسجّل الحذف في سجلّ الأثر مع صاحبه ووقته. ولا يتأثّر أيّ إصدار منشور.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
