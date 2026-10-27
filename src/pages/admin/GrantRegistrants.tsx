/* من عبّأ نموذج المنحة — بالأسماء، وما فعل، وزرُّ واتساب (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «الاثنان معا» — قائمةٌ يتابع منها فريقُه بواتساب الأكاديميّة، ومستشارٌ يُسند تلقائيّا لمن
   لم يشترِ بعد ساعة، ويتّصل به خلال ساعتين (`server/services/grant-followup.service.ts`). وهنا القائمة: من اشترى، ومن ينتظر الدفع،
   ومن لم يشترِ بعد، ومستشارُه إن كانت له حالة. وزرُّ واتساب يفتح المحادثةَ ورسالةُ المتابعة فيها جاهزة. */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { MessageCircle } from "lucide-react";
import { apiGet } from "@/services/api";
import { fmtDate } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { grantFollowupAr } from "@/application/commerce/grant-landing";
import { INFLUENCER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { waToPerson } from "@/application/site/whatsapp";
import ListToolbar from "@/components/admin/ListToolbar";
import { staffSelectCls } from "@/components/FormKit";
import { Card } from "@/components/ui/Surface";

type State = "bought" | "pending" | "none";
interface Registrant {
  id: string; fullName: string; phone: string | null; email: string | null; workField: string | null;
  careerLevel: string | null; interests: string[];
  channel: string | null; wave: string | null; createdAt: string; code: string | null; state: State; advisor: string | null;
  /** الدوراتُ التي اختارها في صفحة المنحة بأسمائها */
  picks: string[];
  /** من «منحة مؤثرين وجيز» — وبكود أيّ مؤثّر */
  influencer: boolean; influencerCode: string | null;
}

const STATE_AR: Record<State, string> = { bought: "اشترى", pending: "ينتظر الدفع", none: "لم يشتر بعد" };

export default function GrantRegistrants() {
  const [rows, setRows] = useState<Registrant[] | null>(null);
  /* من جاء من رابط ملفّ صاحب المنحة (`/g/<كوده>`) تُفتح له القائمةُ مبحوثا فيها بكوده، ويُنزل إليها */
  const [params] = useSearchParams();
  const fromLink = params.get("q") ?? "";
  const [q, setQ] = useState(fromLink);
  const [page, setPage] = useState(1);
  const [only, setOnly] = useState<"" | State>("");
  useEffect(() => { apiGet<Registrant[]>("/api/admin/member-grant/registrants").then(setRows).catch(() => setRows(null)); }, []);
  useEffect(() => {
    if (rows && fromLink) document.getElementById("grant-registrants")?.scrollIntoView({ block: "start" });
  }, [rows, fromLink]);

  const matched = useMemo(
    () => (rows ?? []).filter((r) => (!only || r.state === only)
      && matchesQuery(q, [r.fullName, r.phone, r.email, r.workField, r.careerLevel, ...r.interests, ...r.picks, r.code, r.id, r.influencerCode])),
    [rows, q, only],
  );
  if (!rows) return null;
  const view = paginate(matched, page, 25);

  return (
    <>
      <h2 id="grant-registrants" className="mt-6 scroll-mt-24 text-lg font-black">من عبأ النموذج</h2>
      <p className="mt-1 text-read text-muted-foreground">
        من لم يشتر بعد ساعة تفتح له حالة عند مستشار يتصل به خلال ساعتين. وزر واتساب يفتح المحادثة ورسالة المتابعة جاهزة.
      </p>
      <Card className="mt-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={only} onChange={(e) => { setOnly(e.target.value as "" | State); setPage(1); }} aria-label="الحالة" className={staffSelectCls}>
            <option value="">الكل ({rows.length})</option>
            {(Object.keys(STATE_AR) as State[]).map((s) => (
              <option key={s} value={s}>{STATE_AR[s]} ({rows.filter((r) => r.state === s).length})</option>
            ))}
          </select>
        </div>
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} placeholder="ابحث بالاسم أو الرقم أو البريد أو الكود" unit="شخصا" />
        {view.rows.length === 0 ? (
          <p className="text-read text-muted-foreground">لا أحد بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-read">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start">الاسم</th>
                  <th className="p-2 text-start">التواصل</th>
                  <th className="p-2 text-start">المجال والاهتمام</th>
                  <th className="p-2 text-start">من أين</th>
                  <th className="p-2 text-start">الحالة</th>
                  <th className="p-2 text-start">المستشار</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => {
                  const wa = waToPerson(r.phone, grantFollowupAr(r.fullName, r.influencer ? INFLUENCER_GRANT_NAME_AR : undefined));
                  /* ومن منحة المؤثّرين يقال ذلك أوّلَ «من أين»، وبكود مؤثّره */
                  const from = [r.influencer && `منحة المؤثرين${r.influencerCode ? ` · كود ${r.influencerCode}` : ""}`, r.channel, r.wave && `دفعة ${r.wave}`];
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-2"><span className="font-bold">{r.fullName}</span><br /><span className="text-muted-foreground">{fmtDate(r.createdAt)}</span></td>
                      <td className="p-2">
                        <span dir="ltr">{r.phone ?? "—"}</span>
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" className="ms-2 inline-flex items-center gap-1 font-bold text-teal-light-ink">
                            <MessageCircle className="h-4 w-4" aria-hidden="true" /> واتساب
                          </a>
                        )}
                        <br /><span dir="ltr" className="text-muted-foreground">{r.email ?? "—"}</span>
                      </td>
                      <td className="p-2">
                        {r.workField ?? "—"}
                        {r.careerLevel && <><br /><span className="text-muted-foreground">{r.careerLevel}</span></>}
                        {r.interests.length > 0 && <><br /><span className="text-muted-foreground">يريد: {r.interests.join("، ")}</span></>}
                        {r.picks.length > 0 && <><br /><span className="font-bold">اختار: {r.picks.join("، ")}</span></>}
                      </td>
                      <td className="p-2">{from.filter(Boolean).join(" · ") || "—"}</td>
                      <td className={`p-2 font-bold ${r.state === "bought" ? "text-teal-light-ink" : ""}`}>{STATE_AR[r.state]}</td>
                      <td className="p-2">{r.advisor ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
