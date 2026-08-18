import { useMemo, useState } from "react";
import { CheckCircle2, EyeOff, LifeBuoy, Send, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { adminIdentity } from "./admin-identity";
import {
  addTicketMessage, loadTickets, updateTicket,
  TICKET_FLOW, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL,
  type Ticket, type TicketStatus,
} from "@/data/admin-extras";

const STATUS_CLS: Record<TicketStatus, string> = {
  open: "bg-[#FABC05]/15 text-[#FABC05]",
  in_progress: "bg-[#38A7B4]/15 text-[#6EC7D1]",
  waiting_customer: "bg-purple-500/15 text-purple-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-white/10 text-white/40",
};

const AGENTS = ["وكيل الدعم — ديمو", "وكيل الدعم الثاني — ديمو"];

/** الدعم الفني — التذاكر والإسناد والردود الداخلية وخريطة التحولات (يوافق support.routes) */
export default function AdminSupport() {
  const me = adminIdentity();
  const [tick, setTick] = useState(0);
  const tickets = useMemo(() => { void tick; return loadTickets(); }, [tick]);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const shown = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const open = tickets.find((t) => t.id === openId) ?? null;

  const bump = (msg: string) => { setNote(msg); setTick(tick + 1); };

  const assign = (t: Ticket, agent: string) => {
    updateTicket(t.id, { assignee: agent });
    bump(`أُسندت ${t.id} إلى ${agent} — تاريخ الإسناد محفوظ في سجل التذكرة.`);
  };

  const move = (t: Ticket, status: TicketStatus) => {
    updateTicket(t.id, { status });
    bump(`حُوّلت ${t.id} إلى «${TICKET_STATUS_LABEL[status]}» — التحويل مسجل بالحالة السابقة واللاحقة.`);
  };

  const sendReply = (t: Ticket) => {
    if (!reply.trim()) return;
    addTicketMessage(t.id, { from: "agent", internal, text: reply.trim(), at: new Date().toISOString().slice(0, 16).replace("T", " ") });
    bump(internal ? "أُضيفت ملاحظة داخلية — مخفية عن العميل دائما." : `أُرسل ردك على ${t.id} باسم ${me?.name}.`);
    setReply("");
  };

  return (
    <AdminLayout title="الدعم الفني — التذاكر">
      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}

      {/* ترشيح بالحالة */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {(["all", ...Object.keys(TICKET_STATUS_LABEL)] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s as typeof filter)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === s ? "bg-[#FABC05] text-[#0D0D0D]" : "bg-white/[0.04] text-white/50 hover:text-white"
            }`}>
            {s === "all" ? "الكل" : TICKET_STATUS_LABEL[s as TicketStatus]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* قائمة التذاكر */}
        <div className="space-y-3">
          {shown.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)}
              className={`w-full cursor-pointer rounded-2xl border p-4 text-right transition ${
                openId === t.id ? "border-[#FABC05]/50 bg-[#FABC05]/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white/40" dir="ltr">{t.id}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLS[t.status]}`}>{TICKET_STATUS_LABEL[t.status]}</span>
              </div>
              <p className="mt-1.5 text-sm font-black">{t.subject}</p>
              <p className="mt-1 text-[11px] text-white/45">
                {t.customer} · أولوية {TICKET_PRIORITY_LABEL[t.priority]} · {t.assignee ?? "غير مسندة"}
              </p>
            </button>
          ))}
          {shown.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">لا تذاكر بهذه الحالة</p>}
        </div>

        {/* تفاصيل التذكرة */}
        {open ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-lg font-black">{open.subject}</h2>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_CLS[open.status]}`}>{TICKET_STATUS_LABEL[open.status]}</span>
            </div>
            <p className="mt-1 text-[11px] text-white/45">{open.customer} · فُتحت {open.openedAt}</p>

            {/* الإسناد والأولوية والتحويل */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <UserPlus className="h-4 w-4 text-white/40" />
              {AGENTS.map((a) => (
                <button key={a} onClick={() => assign(open, a)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    open.assignee === a ? "bg-[#38A7B4]/20 text-[#6EC7D1] ring-1 ring-[#38A7B4]/50" : "bg-white/[0.04] text-white/45 hover:text-white"
                  }`}>
                  {a}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/10" />
              {TICKET_FLOW[open.status].map((s) => (
                <button key={s} onClick={() => move(open, s)}
                  className="cursor-pointer rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/55 transition hover:border-[#FABC05]/50 hover:text-[#FABC05]">
                  → {TICKET_STATUS_LABEL[s]}
                </button>
              ))}
              {TICKET_FLOW[open.status].length === 0 && <span className="text-[11px] text-white/35">التذكرة مغلقة — إعادة الفتح من جهة العميل</span>}
            </div>

            {/* الرسائل */}
            <div className="mt-5 space-y-3">
              {open.messages.map((m, i) => (
                <div key={i} className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                  m.internal
                    ? "border-[#FABC05]/30 bg-[#FABC05]/[0.05] text-[#FABC05]/90"
                    : m.from === "customer"
                      ? "border-white/10 bg-white/[0.03] text-white/75"
                      : "border-[#38A7B4]/25 bg-[#38A7B4]/[0.06] text-white/85"
                }`}>
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                    {m.from === "customer" ? open.customer : "الدعم"} · {m.at}
                    {m.internal && <span className="flex items-center gap-1 text-[#FABC05]"><EyeOff className="h-3 w-3" /> داخلية — لا يراها العميل</span>}
                  </p>
                  {m.text}
                </div>
              ))}
            </div>

            {/* الرد */}
            <div className="mt-4">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                placeholder={internal ? "ملاحظة داخلية للفريق…" : "رد على العميل…"}
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none" />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-white/50">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 accent-[#FABC05]" />
                  رد داخلي (internal:true — مخفي عن العميل)
                </label>
                <button onClick={() => sendReply(open)} disabled={!reply.trim()}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1] disabled:opacity-40">
                  <Send className="h-3.5 w-3.5" /> {internal ? "أضف الملاحظة" : "أرسل الرد"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 p-10 text-center">
            <LifeBuoy className="h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm text-white/40">اختر تذكرة من القائمة لعرض المحادثة والإجراءات</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
