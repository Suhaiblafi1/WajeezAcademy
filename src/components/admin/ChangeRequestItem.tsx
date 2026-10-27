/* بندُ طلبٍ في طابور «طلبات التغيير» — ما يطلبه بكلمات، وما يقع إن اعتُمد أو رُدّ (`change-request-view.ts`).

   كان «دورة · C-MKT-104» وعددَ قراراته، وزرُّه الثاني «طلب تعديل» بملاحظةٍ ثابتة لا يُعدَّل الطلبُ بعدها.
   والزرّان لمن يملك القرارَ وحدَه (`catalog.pathway.review`، حبّةُ مساره) — كانا لكلّ من يرى الكتالوج فيُردّ ٤٠٣.
   والحالةُ تُمرَّر شارةً من الصفحة، فلا تُنسخ شارةُ الكتالوج هنا فتفترقان. */

import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { changeRequestView, REJECT_AR, type ChangeRequestLike } from "@/application/catalog/change-request-view";
import { fmtDateTime } from "@/application/text/format-ar";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

export type QueuedChangeRequest = ChangeRequestLike & { status: string; createdAt: string };

export default function ChangeRequestItem({ cr, status, canDecide, busy, onDecide }: {
  cr: QueuedChangeRequest
  status: ReactNode
  canDecide: boolean
  busy: boolean
  onDecide: (decision: "approve" | "reject") => void
}) {
  const v = changeRequestView(cr);
  const waiting = cr.status === "in_review";
  return (
    <Card className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-read leading-6">
        <p className="text-sm font-bold">{v.kindAr} · {v.subjectAr}</p>
        {v.lines.map((line) => <p key={line} className="whitespace-pre-line text-foreground">{line}</p>)}
        <p className="text-muted-foreground">{fmtDateTime(new Date(cr.createdAt))}</p>
        {waiting && (
          <p className="mt-1 text-muted-foreground">
            {v.blockedAr ?? (
              <><b className="text-foreground">اعتمد:</b> {v.approveAr} <b className="text-foreground">ارفض:</b> {REJECT_AR}</>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status}
        {waiting && canDecide && (
          <>
            <Button tone="secondary" size="sm" disabled={busy || v.blockedAr !== null} onClick={() => onDecide("approve")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> اعتمد
            </Button>
            <Button tone="secondary" size="sm" disabled={busy} onClick={() => onDecide("reject")}>
              <XCircle className="h-3.5 w-3.5" /> ارفض
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
