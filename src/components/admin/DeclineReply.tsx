/* ردُّنا على من اعتذر عن عقده — في صفّ عقده (٣ أكتوبر ٢٠٢٦).

   القرارُ في `src/application/trainer/decline-reply.ts`: الرسالةُ معبّأةٌ تُحرَّر
   ثمّ تُرسَل مرّةً، ويُلحَق بها زرٌّ إلى صفحةٍ يختار فيها إبقاءَ بياناته أو
   حذفَها في الحال. وبعد الإرسال يقول الصفُّ ما اختار — أو أنّه لم يختر بعد. */

import { useState } from "react";
import { MailCheck, Send, X } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffAreaCls, staffControlCls } from "@/components/FormKit";
import { toast, toastError } from "@/components/Toast";
import { apiPost, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import {
  DATA_CHOICE_LINK_DAYS, DECLINE_REPLY_BODY_MAX, DECLINE_REPLY_BODY_MIN,
  DEFAULT_DECLINE_REPLY_SUBJECT_AR, defaultDeclineReplyAr,
} from "@/application/trainer/decline-reply";

export interface DeclineReplyRow {
  id: string;
  fullName: string;
  declineRepliedAt?: string | null;
  dataChoice?: string | null;
  dataChoiceAt?: string | null;
}

export default function DeclineReply({ c, onDone }: { c: DeclineReplyRow; onDone: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_DECLINE_REPLY_SUBJECT_AR);
  const [body, setBody] = useState(() => defaultDeclineReplyAr(c.fullName));
  const [busy, setBusy] = useState(false);

  if (c.declineRepliedAt) {
    const choice = c.dataChoice === "keep"
      ? `واختار إبقاءَ بياناته للمواسم القادمة${c.dataChoiceAt ? ` (${fmtDateTime(c.dataChoiceAt)})` : ""}.`
      : c.dataChoice === "delete"
        ? "وطلب حذفَ بياناته، وتعذّر الحذفُ الآليّ لما في سجلّه — احذفه بيدك من «طلبات المدربين»."
        : `ولم يختر بعدُ ما نفعله ببياناته — رابطُ خياره صالحٌ ${DATA_CHOICE_LINK_DAYS} يوما، ومن لم يختر تبقى بياناتُه.`;
    return (
      <Inset tone={c.dataChoice === "delete" ? "warn" : "default"} className="mt-2 flex items-start gap-2 p-3 text-read leading-7">
        <MailCheck className="mt-1.5 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
        <span>رددتَ على اعتذاره {fmtDateTime(c.declineRepliedAt)} — {choice}</span>
      </Inset>
    );
  }

  if (!open) {
    return (
      <Button size="sm" className="mt-2" icon={Send} onClick={() => setOpen(true)}>ردَّ على اعتذاره</Button>
    );
  }

  const len = body.trim().length;
  const send = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ emailDelivery: string }>(`/api/admin/trainer-contracts/${c.id}/decline-reply`,
        { subjectAr: subject.trim(), bodyAr: body.trim() });
      toast(r.emailDelivery === "sent" ? "أُرسل ردُّك — ومعه خيارُه في بياناته" : "حُفظ ردُّك — وتعذّر البريد، فأعِد إرساله يدويّا");
      setOpen(false);
      await onDone();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الإرسال");
    } finally { setBusy(false); }
  };

  return (
    <Inset className="mt-2 grid gap-2 p-3">
      <label className="grid gap-1 text-read">
        <span className="font-bold">العنوان</span>
        <input className={staffControlCls} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="grid gap-1 text-read">
        <span className="font-bold">الرسالة — حرّرها كما تشاء</span>
        <textarea className={staffAreaCls} rows={12} value={body} maxLength={DECLINE_REPLY_BODY_MAX}
          onChange={(e) => setBody(e.target.value)} />
      </label>
      <p className="text-read leading-6 text-muted-foreground">
        يُلحَق بالرسالة زرُّ «اختر ما نفعله ببياناتك»: صفحةٌ يختار فيها إبقاءَها للمواسم القادمة أو حذفَها،
        ويقع الحذفُ في الحال حين يؤكّده — ويصلك خبرُ ما اختار. وتُرسَل الرسالةُ مرّةً واحدة.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button tone="confirm" size="sm" icon={Send} loading={busy}
          disabled={len < DECLINE_REPLY_BODY_MIN || subject.trim().length < 3} onClick={() => void send()}>
          أرسِلِ الردّ
        </Button>
        <Button tone="ghost" size="sm" icon={X} disabled={busy} onClick={() => setOpen(false)}>تراجعْ</Button>
      </div>
    </Inset>
  );
}
