/* من عبّأ نموذج المنحة — بالأسماء، وما فعل، وزرُّ واتساب (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «الاثنان معا» — قائمةٌ يتابع منها فريقُه بواتساب الأكاديميّة، ومستشارٌ يُسند تلقائيّا لمن
   لم يشترِ بعد ساعة، ويتّصل به خلال ساعتين (`server/services/grant-followup.service.ts`). وهنا القائمة: من اشترى، ومن ينتظر الدفع،
   ومن لم يشترِ بعد، ومستشارُه إن كانت له حالة. وزرُّ واتساب يفتح المحادثةَ ورسالةُ المتابعة فيها جاهزة.

   ═══ ومصدرُه ورسائلُه وإحصاءاتٌ وExcel وحذفٌ وبريد (٣١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: وقتُ فتح الرابط والمصدرُ لكلّ شخص، وتنزيلُ القائمة Excel، وما يصلهم من رسائل ومواعيدُها، وإحصاءاتٌ
   كاملة، وحذفُ من لا يريده، وبريدٌ يكتبه هو للجميع أو لواحدٍ كزرّ الواتساب. فعمودُ «المصدر» يقول من أين جاء ومتى فتح الصفحة،
   و«التفاصيل» تفتح تحت صفّه رسائلَه بأوقاتها وما هو آتٍ له، والإحصاءاتُ فوق القائمة تتبع تصفيتها، وزرُّ «بريد للقائمة» يكتب
   لمن في التصفية نفسِها. والحذفُ بخيارين بأثر كلٍّ (قاعدةُ «لا إجبار على فعل»). والخادم: `grant-registrants.service.ts`. */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, FileDown, Mail, MessageCircle, Send, Trash2 } from "lucide-react";
import { apiDelete, apiDownload, apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { grantFollowupAr } from "@/application/commerce/grant-landing";
import {
  GRANT_MESSAGE_BODY_MAX, GRANT_MESSAGE_SUBJECT_MAX, MAIL_STATE_AR, SOURCE_GROUP_AR, registrantStats,
  type MailState, type RegistrantSource, type SourceGroup, type Upcoming,
} from "@/application/commerce/grant-registrants";
import { shortCourseTitleAr } from "@/application/text/course-lines";
import { INFLUENCER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { waToPerson } from "@/application/site/whatsapp";
import ListToolbar from "@/components/admin/ListToolbar";
import { staffAreaCls, staffControlCls, staffSelectCls } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Modal from "@/components/Modal";
import { toast, toastError } from "@/components/Toast";
import GrantRegistrantStats from "./GrantRegistrantStats";

type State = "bought" | "pending" | "none";
interface Mail { id: string; subject: string; purposeAr: string; purpose: string | null; status: MailState; createdAt: string; sentAt: string | null }
interface Registrant {
  id: string; fullName: string; phone: string | null; email: string | null; workField: string | null;
  careerLevel: string | null; interests: string[];
  channel: string | null; wave: string | null; createdAt: string; code: string | null; codeActive: boolean | null; state: State; advisor: string | null;
  /** الدوراتُ التي اختارها في صفحة المنحة بأسمائها */
  picks: string[];
  /** من «منحة مؤثرين وجيز» — وبكود أيّ مؤثّر */
  influencer: boolean; influencerCode: string | null;
  /** متى فتح صفحةَ المنحة، ومتى زار الموقعَ أوّلَ مرّة، ومن أين جاء */
  pageOpenedAt: string | null; firstSeenAt: string | null; landingPath: string | null; source: RegistrantSource;
  /** ما كُتب لبريده، وما هو آتٍ له */
  mails: Mail[]; upcoming: Upcoming[];
}
interface List { mailOn: boolean; rows: Registrant[] }

const STATE_AR: Record<State, string> = { bought: "اشترى", pending: "ينتظر الدفع", none: "لم يشتر بعد" };
const GRANT_AR = { member: "منحة وجيز", influencer: "منحة المؤثرين" } as const;

/** كم بين لحظتين — «بعد ٥ د» */
function gapAr(from: string, to: string): string | null {
  const min = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  if (!Number.isFinite(min) || min < 0) return null;
  if (min < 60) return `${min} د`;
  if (min < 48 * 60) return `${Math.round(min / 60)} س`;
  return `${Math.round(min / 1440)} يوم`;
}

export default function GrantRegistrants() {
  const [data, setData] = useState<List | null>(null);
  /* من جاء من رابط ملفّ صاحب المنحة (`/g/<كوده>`) تُفتح له القائمةُ مبحوثا فيها بكوده، ويُنزل إليها */
  const [params] = useSearchParams();
  const fromLink = params.get("q") ?? "";
  const [q, setQ] = useState(fromLink);
  const [page, setPage] = useState(1);
  const [only, setOnly] = useState<"" | State>("");
  const [source, setSource] = useState<"" | SourceGroup>("");
  const [grant, setGrant] = useState<"" | keyof typeof GRANT_AR>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [writeTo, setWriteTo] = useState<Registrant[] | null>(null);
  const [removing, setRemoving] = useState<Registrant | null>(null);
  const [downloading, setDownloading] = useState(false);
  const load = useCallback(() => apiGet<List>("/api/admin/member-grant/registrants").then(setData).catch(() => setData(null)), []);
  useEffect(() => { void load(); }, [load]);
  const rows = data?.rows ?? null;
  useEffect(() => {
    if (rows && fromLink) document.getElementById("grant-registrants")?.scrollIntoView({ block: "start" });
  }, [rows, fromLink]);

  const matched = useMemo(
    () => (rows ?? []).filter((r) => (!only || r.state === only) && (!source || r.source.group === source)
      && (!grant || (grant === "influencer") === r.influencer)
      && matchesQuery(q, [r.fullName, r.phone, r.email, r.workField, r.careerLevel, ...r.interests, ...r.picks, r.influencerCode, r.source.labelAr, r.code, r.id])),
    [rows, q, only, source, grant],
  );
  const stats = useMemo(() => registrantStats(matched), [matched]);
  if (!rows || !data) return null;
  const view = paginate(matched, page, 25);
  const filtered = matched.length !== rows.length;
  const reset = () => setPage(1);
  const groups = (Object.keys(SOURCE_GROUP_AR) as SourceGroup[]).filter((g) => rows.some((r) => r.source.group === g));

  const download = async () => {
    setDownloading(true);
    try { await apiDownload("/api/admin/member-grant/registrants.xlsx", "grant-registrants.xlsx"); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر التنزيل"); }
    finally { setDownloading(false); }
  };

  return (
    <>
      <h2 id="grant-registrants" className="mt-6 scroll-mt-24 text-lg font-black">من عبأ النموذج</h2>
      <p className="mt-1 text-read text-muted-foreground">
        من لم يشتر بعد ساعة تفتح له حالة عند مستشار يتصل به خلال ساعتين. وزر واتساب يفتح المحادثة ورسالة المتابعة جاهزة.
      </p>
      {!data.mailOn && (
        <p className="mt-2 text-read font-bold text-gold-ink">البريد غير موصول الآن: الرسائل تنتظر في الطابور حتى يوصل من الإعدادات.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button icon={FileDown} loading={downloading} onClick={() => void download()}>تنزيل Excel</Button>
        <Button icon={Send} disabled={matched.length === 0} onClick={() => setWriteTo(matched)}>
          بريد {filtered ? "لمن في التصفية" : "للكل"} ({matched.filter((r) => r.email).length})
        </Button>
      </div>

      <GrantRegistrantStats s={stats} filtered={filtered} />

      <Card className="mt-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={only} onChange={(e) => { setOnly(e.target.value as "" | State); reset(); }} aria-label="الحالة" className={staffSelectCls}>
            <option value="">الكل ({rows.length})</option>
            {(Object.keys(STATE_AR) as State[]).map((s) => (
              <option key={s} value={s}>{STATE_AR[s]} ({rows.filter((r) => r.state === s).length})</option>
            ))}
          </select>
          <select value={source} onChange={(e) => { setSource(e.target.value as "" | SourceGroup); reset(); }} aria-label="المصدر" className={staffSelectCls}>
            <option value="">كل المصادر</option>
            {groups.map((g) => (
              <option key={g} value={g}>{SOURCE_GROUP_AR[g]} ({rows.filter((r) => r.source.group === g).length})</option>
            ))}
          </select>
          <select value={grant} onChange={(e) => { setGrant(e.target.value as "" | keyof typeof GRANT_AR); reset(); }} aria-label="المنحة" className={staffSelectCls}>
            <option value="">كل المنح</option>
            <option value="member">{GRANT_AR.member} ({rows.filter((r) => !r.influencer).length})</option>
            <option value="influencer">{GRANT_AR.influencer} ({rows.filter((r) => r.influencer).length})</option>
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
                  <th className="p-2 text-start">المصدر</th>
                  <th className="p-2 text-start">الحالة</th>
                  <th className="p-2 text-start">المستشار</th>
                  <th className="p-2 text-start"><span className="sr-only">أفعال</span></th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => {
                  const wa = waToPerson(r.phone, grantFollowupAr(r.fullName, r.influencer ? INFLUENCER_GRANT_NAME_AR : undefined));
                  const isOpen = openId === r.id;
                  const next = r.upcoming[0];
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-t border-border align-top">
                        <td className="p-2">
                          <span className="font-bold">{r.fullName}</span><br />
                          <span className="text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                        </td>
                        <td className="p-2">
                          <span dir="ltr">{r.phone ?? "—"}</span>
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="ms-2 inline-flex items-center gap-1 font-bold text-teal-light-ink">
                              <MessageCircle className="h-4 w-4" aria-hidden="true" /> واتساب
                            </a>
                          )}
                          <br /><span dir="ltr" className="text-muted-foreground">{r.email ?? "—"}</span>
                          {/* وبريدٌ يكتبه لهذا الشخص وحدَه — كزرّ الواتساب، ويخرج من بريد الأكاديمية فيُرى في رسائله */}
                          {r.email && (
                            <button type="button" onClick={() => setWriteTo([r])} className="ms-2 inline-flex items-center gap-1 font-bold text-teal-light-ink">
                              <Mail className="h-4 w-4" aria-hidden="true" /> بريد
                            </button>
                          )}
                        </td>
                        <td className="p-2">
                          {r.workField ?? "—"}
                          {r.careerLevel && <><br /><span className="text-muted-foreground">{r.careerLevel}</span></>}
                          {r.interests.length > 0 && <><br /><span className="text-muted-foreground">يريد: {r.interests.join("، ")}</span></>}
                          {/* ما اختاره سطرٌ لكلّ دورةٍ مرقّمٌ بعنوانها القصير — كرسالة واتساب (`course-lines.ts`) */}
                          {r.picks.length > 0 && (
                            <span className="mt-1 block">
                              <span className="font-bold">اختار:</span>
                              <ol className="list-inside list-decimal font-bold">
                                {r.picks.map((p) => <li key={p}>{shortCourseTitleAr(p)}</li>)}
                              </ol>
                            </span>
                          )}
                        </td>
                        {/* من أين جاء ومتى فتح الصفحة — `registrantSource` */}
                        <td className="p-2">
                          <span className="font-bold">{r.source.labelAr}</span>
                          <br /><span className="text-muted-foreground">{r.influencer ? GRANT_AR.influencer : GRANT_AR.member}</span>
                          {r.pageOpenedAt && (
                            <><br /><span className="text-muted-foreground">فتح الرابط {fmtDateTime(r.pageOpenedAt)}</span></>
                          )}
                          {r.source.detailAr && <><br /><span className="text-fine text-muted-foreground">{r.source.detailAr}</span></>}
                        </td>
                        <td className={`p-2 font-bold ${r.state === "bought" ? "text-teal-light-ink" : ""}`}>
                          {STATE_AR[r.state]}
                          {r.code && <><br /><span dir="ltr" className="font-normal text-muted-foreground">{r.code}{r.codeActive === false ? " · مبطل" : ""}</span></>}
                        </td>
                        <td className="p-2">{r.advisor ?? "—"}</td>
                        <td className="p-2">
                          <button
                            type="button" onClick={() => setOpenId(isOpen ? null : r.id)} aria-expanded={isOpen}
                            className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-teal-light-ink"
                          >
                            التفاصيل ({r.mails.length}) <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                          </button>
                          {next && !isOpen && <p className="text-read text-muted-foreground">التالي: {fmtDateTime(next.at)}</p>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-surface/40">
                          <td colSpan={7} className="p-3">
                            <Details r={r} onRemove={() => setRemoving(r)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {writeTo && <WriteMail to={writeTo} mailOn={data.mailOn} onClose={() => setWriteTo(null)} onSent={() => { setWriteTo(null); void load(); }} />}
      {removing && <Remove r={removing} onClose={() => setRemoving(null)} onDone={() => { setRemoving(null); setOpenId(null); void load(); }} />}
    </>
  );
}

/* ─────────── تحت الصفّ: أوقاتُه، ورسائلُه، وما هو آتٍ له ─────────── */

function Details({ r, onRemove }: { r: Registrant; onRemove: () => void }) {
  const gap = r.pageOpenedAt ? gapAr(r.pageOpenedAt, r.createdAt) : null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <p className="font-bold">الأوقات</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-read">
          <dt className="text-muted-foreground">أول زيارة للموقع</dt><dd>{r.firstSeenAt ? fmtDateTime(r.firstSeenAt) : "—"}</dd>
          <dt className="text-muted-foreground">فتح صفحة المنحة</dt><dd>{r.pageOpenedAt ? fmtDateTime(r.pageOpenedAt) : "—"}</dd>
          <dt className="text-muted-foreground">عبأ النموذج</dt><dd>{fmtDateTime(r.createdAt)}{gap ? ` · بعد ${gap}` : ""}</dd>
          {r.landingPath && <><dt className="text-muted-foreground">أول صفحة</dt><dd dir="ltr" className="text-start">{r.landingPath}</dd></>}
        </dl>
        <Button tone="danger" size="sm" icon={Trash2} className="mt-3" onClick={onRemove}>احذفه من القائمة</Button>
      </div>
      <div>
        <p className="font-bold">ما وصله ({r.mails.length})</p>
        {r.mails.length === 0 ? (
          <p className="mt-1 text-read text-muted-foreground">{r.email ? "لم يكتب له بريد بعد." : "لا بريد له."}</p>
        ) : (
          <ol className="mt-1 grid gap-1.5 text-read">
            {[...r.mails].reverse().map((m) => (
              <li key={m.id}>
                <span className="font-bold">{m.purposeAr}</span>
                <span className={`ms-2 text-fine ${m.status === "failed" ? "font-bold text-danger-ink" : "text-muted-foreground"}`}>{MAIL_STATE_AR[m.status]}</span>
                <br /><span className="text-muted-foreground">{m.subject}</span>
                <br /><span className="text-fine text-muted-foreground">{fmtDateTime(m.sentAt ?? m.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <p className="font-bold">ما هو آت</p>
        {r.upcoming.length === 0 ? (
          <p className="mt-1 text-read text-muted-foreground">
            {r.state === "bought" ? "اشترى، فلا تذكير له." : "لا موعد مجدول له."}
          </p>
        ) : (
          <ol className="mt-1 grid gap-1.5 text-read">
            {r.upcoming.map((u) => (
              <li key={`${u.kind}-${u.at}`}>
                <span className="font-bold">{u.labelAr}</span>
                <br /><span className="text-fine text-muted-foreground">{fmtDateTime(u.at)}</span>
              </li>
            ))}
          </ol>
        )}
        {r.code && (
          <p className="mt-3 text-read text-muted-foreground">
            كوده <span dir="ltr" className="font-bold">{r.code}</span>{r.codeActive === false ? " — مبطل" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── بريدٌ يكتبه صاحبُ المنصّة — لواحدٍ أو لمن في التصفية ─────────── */

function WriteMail({ to, mailOn, onClose, onSent }: { to: Registrant[]; mailOn: boolean; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const withMail = to.filter((r) => r.email);
  const one = to.length === 1 ? to[0] : null;
  const send = async () => {
    setBusy(true);
    try {
      const out = await apiPost<{ sent: number; noEmail: number }>("/api/admin/member-grant/registrants/mail", {
        ids: withMail.map((r) => r.id), subject, body,
      });
      toast(out.sent === 1 ? "كتبت الرسالة، وتصله خلال دقائق" : `كتبت الرسالة لـ${out.sent} شخصا، وتصلهم خلال دقائق`);
      onSent();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الإرسال"); }
    finally { setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label={one ? `بريد إلى ${one.fullName}` : "بريد للقائمة"} panelClassName="w-full max-w-xl">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">{one ? `بريد إلى ${one.fullName}` : `بريد إلى ${withMail.length} شخصا`}</h2>
        <p className="mt-1 text-read text-muted-foreground">
          {one ? <span dir="ltr">{one.email}</span> : "يصل كلا باسمه، بقالب الأكاديمية."}
          {!one && to.length > withMail.length && ` ولا يصل ${to.length - withMail.length} لا بريد لهم.`}
        </p>
        <label className="mt-3 block text-read font-bold" htmlFor="grant-mail-subject">العنوان</label>
        <input
          id="grant-mail-subject" value={subject} maxLength={GRANT_MESSAGE_SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)}
          className={`${staffControlCls} mt-1 w-full`}
        />
        <label className="mt-3 block text-read font-bold" htmlFor="grant-mail-body">النص</label>
        <textarea
          id="grant-mail-body" value={body} maxLength={GRANT_MESSAGE_BODY_MAX} rows={8} onChange={(e) => setBody(e.target.value)}
          className={`${staffAreaCls} mt-1 w-full`}
        />
        <p className="mt-1 text-read text-muted-foreground">يبدأ بـ«مرحبا» واسمه. وسطر فارغ يفصل الفقرات.</p>
        {!mailOn && <p className="mt-2 text-read font-bold text-gold-ink">البريد غير موصول الآن: تنتظر الرسالة حتى يوصل.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="confirm" icon={Send} loading={busy} disabled={!subject.trim() || !body.trim() || withMail.length === 0} onClick={() => void send()}>
            أرسل {one ? "" : `(${withMail.length})`}
          </Button>
          <Button tone="secondary" disabled={busy} onClick={onClose}>ليس الآن</Button>
        </div>
        <p className="mt-2 text-read text-muted-foreground">لا يمكن سحبها بعد الإرسال، وتظهر في «التفاصيل» عند كل منهم.</p>
      </Inset>
    </Modal>
  );
}

/* ─────────── الحذف: خياران بأثر كلٍّ ─────────── */

function Remove({ r, onClose, onDone }: { r: Registrant; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState<"" | "off" | "keep">("");
  /* كودٌ اشتُري به لا يُبطَل — فلا يُعرض له إلّا خيارُ الإبقاء */
  const canDisable = !!r.code && r.codeActive !== false && r.state !== "bought";
  const go = async (disableCode: boolean) => {
    setBusy(disableCode ? "off" : "keep");
    try {
      await apiDelete(`/api/admin/member-grant/registrants/${r.id}`, { disableCode });
      toast(disableCode ? "حذفناه وأبطلنا كوده" : "حذفناه");
      onDone();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الحذف"); setBusy(""); }
  };
  return (
    <Modal onClose={onClose} label={`أتحذف ${r.fullName}؟`} panelClassName="w-full max-w-lg">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">أتحذف {r.fullName} من القائمة؟</h2>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          يمحى اسمه ورقمه وبريده، وتغلق حالته عند المستشار، ولا يصله تذكير بعدها. ويبقى عدده في نتائج الحملة. ولا يمس حسابه إن كان له حساب.
        </p>
        <div className="mt-4 grid gap-3">
          {canDisable && (
            <div>
              <Button tone="danger" loading={busy === "off"} disabled={!!busy} onClick={() => void go(true)}>احذفه وأبطل كوده</Button>
              <p className="mt-1 text-read leading-6 text-muted-foreground">لا يشترى بكوده <span dir="ltr">{r.code}</span> بعدها، ولو أهداه لغيره.</p>
            </div>
          )}
          <div>
            <Button tone="danger" loading={busy === "keep"} disabled={!!busy} onClick={() => void go(false)}>{r.code ? "احذفه وأبق كوده" : "احذفه"}</Button>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              {r.code ? (r.state === "bought" ? "اشترى بكوده، فيبقى كما هو." : "يبقى كوده يعمل لمن معه.") : "لا كود له."}
            </p>
          </div>
          <div>
            <Button tone="secondary" disabled={!!busy} onClick={onClose}>ليس الآن</Button>
            <p className="mt-1 text-read leading-6 text-muted-foreground">يبقى في القائمة كما هو.</p>
          </div>
        </div>
      </Inset>
    </Modal>
  );
}
