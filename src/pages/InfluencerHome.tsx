/* حسابُ المؤثّر — كودُه ورابطُه، ومن جاء به، وعمولتُه عن كلٍّ منهم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «كيف يدخل لحساب مؤثّرٍ يرى فيه مستحقّاته لكلّ شخصٍ استخدم رابط المنحة الخاصّ به». فهنا شاشةٌ
   واحدة: الكودُ والرابطُ يُنسخان، ثمّ الأرقام (من سجّل، من اشترى، كم له، كم دُفع، كم بقي)، ثمّ كلُّ طلبٍ بعمولته،
   ثمّ ما دُفع له. والمشتري باسمه الأوّل وحدَه. والعلّةُ في `server/services/influencer.service.ts`.

   ═══ و«صمم منشورك» أوّلَ الصفحة (٢٦ أكتوبر ٢٠٢٦) ═══

   «امنح المؤثّرَ تصاميمَ يشاركها مع عملائه ليمثّل المنحةَ والتقديمَ عبر الرابط الذي يُرفقه بالنصّ، كما فعلنا للمدرّب»
   (صاحب المنصّة). فاللوحةُ لوحةُ المدرّب (`ShareKit`) بمحتوى المنحة: صورُها (`influencer/grant-art.ts`) ونصُّها لكلّ
   منصّة برابط صفحته (`influencer-share.ts`). ومفتوحةٌ أوّلَ الصفحة كما قال للمدرّب: «صمم منشورك هو الأهمّ». */

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ImagePlus, Loader2, Megaphone, ServerOff, Share2 } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { toast } from "@/components/Toast";
import InfluencerLayout from "./influencer/InfluencerLayout";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import { controlCls } from "@/components/FormKit";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { fmtDate, fmtDayMonth, fmtMoney } from "@/application/text/format-ar";
import ShareKit, { type ShareContent } from "@/components/trainer/ShareKit";
import { drawGrantArt, grantArtPlan, grantDesigns, GRANT_DESIGNS, parseGrantKind, type GrantArtData, type GrantDesign } from "@/components/influencer/grant-art";
import { grantEmailSubject, grantShareText, grantShareUrl, type GrantShareInput } from "@/application/commerce/influencer-share";
import { waShare } from "@/application/site/whatsapp";
import ImageFramer from "@/components/ImageFramer";
import { ImageConditionError } from "@/lib/prepare-image";
import { AvatarUploadError, uploadAccountAvatar } from "@/services/avatar-upload";

interface Row { orderId: string; at: string; buyerAr: string; courses: number; listTotal: number; percent: number; commission: number; stateAr: string; refunded: boolean }
interface Me {
  nameAr: string; code: string; active: boolean; commissionPercent: number; link: string; currency: string;
  photoUrl: string | null;
  /** مادّةُ التصاميم — الدوراتُ وصورُ المدرّبين بلا أسماء (`designMaterial`) */
  designs: { termAr: string | null; courses: { title: string; startsAt: string | null }[]; photos: string[]; trainerTotal: number };
  grant: { nameAr: string; open: boolean; percentOff: number; maxCourses: number; closesAt: string | null };
  totals: { signups: number; codes: number; buyers: number; sales: number; earned: number; paid: number; balance: number };
  rows: Row[];
  payouts: { id: string; amount: number; currency: string; noteAr: string | null; paidAt: string }[];
}

/** «صمم منشورك» — تصاميمُ المنحة والأكاديميّة، ونصُّها لكلّ منصّة برابط صفحته وكوده.

    وبلا صورته: «لا داعيَ لوجود صورة صاحب المنحة، فهو ينشرها لحساباته فقط، اذكرها مع الكود كاسمه» (صاحب المنصّة،
    ٢٦ أكتوبر ٢٠٢٦). فيختار تصميما من سبعة (`GRANT_DESIGNS`)، ومادّتُها من كشفه (`designMaterial` في الخادم):
    الدوراتُ وصورُ مدرّبيها بلا أسماء، وبلا صاحب المنصّة.

    ثمّ «تصميمك الخاص» أوّلَها ومختارا عند الفتح: «امنحه فرصةً أن يصمّم تصميما خاصّا به، ويُطلب منه رفعُ صورته واسمه!
    اجعل هذا تلقائيّا» (٢٧ أكتوبر ٢٠٢٦). فبلا صورةٍ يرى القالبَ ويُطلب منه رفعُها، وبها يُرسم التصميمُ وحدَه. وصورتُه صورةُ
    حسابه (`uploadAccountAvatar`) فتبقى لكلّ زيارة، واسمُه في التصميم يكتبه هو ويُحفظ في متصفّحه. */
function GrantShare({ me }: { me: Me }) {
  const [design, setDesign] = useState<GrantDesign>("personal");
  const [photo, setPhoto] = useState<string | null>(me.photoUrl);
  const [ownName, setOwnName] = useState(() => readOwnName(me.code) ?? me.nameAr);
  const art = useMemo<GrantArtData>(() => ({
    name: me.nameAr, code: me.code, percentOff: me.grant.percentOff, maxCourses: me.grant.maxCourses,
    lastDayAr: me.grant.closesAt ? fmtDayMonth(new Date(new Date(me.grant.closesAt).getTime() - 1).toISOString()) : null,
    termAr: me.designs.termAr, photos: me.designs.photos, trainerTotal: me.designs.trainerTotal,
    courses: me.designs.courses, dayAr: (iso: string) => fmtDayMonth(iso),
    own: { photo, name: ownName.trim() || me.nameAr },
  }), [me, photo, ownName]);
  const available = useMemo(() => grantDesigns(art), [art]);

  const content = useMemo<ShareContent>(() => {
    const g: GrantShareInput = {
      nameAr: me.nameAr, code: me.code, percentOff: art.percentOff, maxCourses: art.maxCourses, lastDayAr: art.lastDayAr, url: me.link,
    };
    return {
      text: (p) => grantShareText(p, g),
      subject: () => grantEmailSubject(g),
      door: (p) => grantShareUrl(p, g),
      plan: (f) => grantArtPlan(f, design, available, Boolean(photo)),
      draw: (kind) => { const k = parseGrantKind(kind); return drawGrantArt(k.design, k.size, art); },
      key: `${design}|${available.join(",")}|${JSON.stringify({ ...art, dayAr: undefined })}`,
    };
  }, [me, art, design, available, photo]);
  const needsPhoto = design === "personal" && !photo;

  return (
    <Panel as="section" className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Share2 className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> صمم منشورك
        </h2>
        <p className="text-read text-muted-foreground">تصاميم عن المنحة والأكاديمية وكودك باسمك، ونص جاهز لكل منصة برابطك.</p>
      </div>
      <p className="mt-3 text-read font-bold">التصميم</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="التصميم">
        {GRANT_DESIGNS.filter((x) => available.includes(x.id)).map((x) => (
          <Button key={x.id} size="sm" type="button" tone={design === x.id ? "confirm" : "secondary"}
            aria-pressed={design === x.id} onClick={() => setDesign(x.id)}>
            {x.label}
          </Button>
        ))}
      </div>
      {design === "personal" && (
        <OwnDesign photo={photo} name={ownName} art={art}
          onPhoto={setPhoto} onName={(v) => { setOwnName(v); writeOwnName(me.code, v); }} />
      )}
      {!needsPhoto && (
        <ShareKit face={{ name: me.nameAr, photoUrl: null }} courses={[]} url={me.link}
          code={{ code: me.code, percentOff: me.grant.percentOff }} fileStem={`wajeez-grant-${design}`} content={content} />
      )}
    </Panel>
  );
}

/** اسمُه في التصميم — في متصفّحه، وقد يمنعه المتصفّح فيبقى اسمُ ملفّه */
const ownNameKey = (code: string) => `wajeez_influencer_design_name:${code}`;
function readOwnName(code: string): string | null {
  try { return localStorage.getItem(ownNameKey(code)); } catch { return null; }
}
function writeOwnName(code: string, v: string) {
  try { localStorage.setItem(ownNameKey(code), v); } catch { /* يبقى للزيارة وحدَها */ }
}

/** «تصميمك الخاص»: صورتُه واسمُه — وبلا صورةٍ القالبُ ومكانُها «صورتك هنا» */
function OwnDesign({ photo, name, art, onPhoto, onName }: {
  photo: string | null; name: string; art: GrantArtData;
  onPhoto: (url: string) => void; onName: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [framing, setFraming] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [template, setTemplate] = useState<string | null>(null);

  /* القالبُ يُرسم ما دامت لا صورة — يرى أين تقع صورتُه واسمُه قبل أن يرفع */
  useEffect(() => {
    if (photo) { setTemplate(null); return; }
    let live = true;
    void drawGrantArt("personal", "post", art).then((c) => { if (live) setTemplate(c.toDataURL("image/png")); });
    return () => { live = false; };
  }, [photo, art]);

  const upload = async (blob: Blob) => {
    setBusy(true); setMsg(null);
    try {
      const r = await uploadAccountAvatar(blob);
      setFraming(null);
      onPhoto(r.avatarUrl);
      setMsg({ bad: false, text: "رفعت صورتك، وصار تصميمك جاهزا." });
    } catch (e) {
      setMsg({ bad: true, text: e instanceof ImageConditionError || e instanceof AvatarUploadError || e instanceof ApiError ? e.message : "تعذر رفع الصورة" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Inset tone="accent" className="mt-4 p-4">
      <p className="text-read font-bold">{photo ? "تصميمك بصورتك واسمك" : "ارفع صورتك واكتب اسمك، ويجهز تصميمك وحده"}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-read text-muted-foreground">اسمك في التصميم</span>
          <input value={name} maxLength={40} onChange={(e) => onName(e.target.value)}
            className={`mt-1 ${controlCls}`} />
        </label>
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMsg(null); setFraming(f); } }} />
          <Button tone={photo ? "secondary" : "confirm"} icon={busy ? undefined : ImagePlus} loading={busy}
            onClick={() => fileRef.current?.click()}>
            {busy ? "جار الرفع…" : photo ? "غير صورتك" : "ارفع صورتك"}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-read text-muted-foreground">صورة واضحة لوجهك. وهي صورة حسابك أيضا.</p>
      {msg && <p role="alert" className={`mt-2 text-read font-semibold ${msg.bad ? "text-red-300" : "text-teal-light-ink"}`}>{msg.text}</p>}
      {framing && <ImageFramer file={framing} onDone={upload} onCancel={() => { setFraming(null); if (fileRef.current) fileRef.current.value = ""; }} />}
      {template && (
        <img src={template} alt="قالب تصميمك الخاص — صورتك مكان «صورتك هنا»"
          className="mx-auto mt-4 w-full max-w-sm rounded-xl shadow-sm ring-1 ring-black/10" />
      )}
    </Inset>
  );
}

export default function InfluencerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Me>("/api/influencer/me").then(setMe).catch((e) => setFailed(e instanceof ApiError ? e.message : "تعذر تحميل حسابك"));
  }, []);

  const copy = async (text: string, doneAr: string) => {
    try { await navigator.clipboard.writeText(text); toast(doneAr); } catch { /* المتصفّحُ منعه — النصُّ ظاهرٌ يُنسخ باليد */ }
  };
  const money = (n: number) => fmtMoney(n, me?.currency ?? "USD");

  return (
    <InfluencerLayout>
      {failed ? (
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-read leading-7 text-muted-foreground">{failed}</p>
        </Panel>
      ) : !me ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      ) : (
        <>
          <h1 className="text-2xl font-black">مرحبا {me.nameAr}</h1>
          <p className="mt-1 text-read text-muted-foreground">
            {me.grant.nameAr}: متابعوك يحصلون على {me.grant.percentOff}% من سعر الدورات، ولك {me.commissionPercent}% من سعر الدورات عن كل من يشتري بكودك.
          </p>
          {!me.grant.open && <p className="mt-2"><Chip tone="warn">المنحة غير مفتوحة الآن</Chip></p>}
          {!me.active && <p className="mt-2"><Chip tone="warn">كودك موقوف الآن. تواصل مع الأكاديمية</Chip></p>}

          <GrantShare me={me} />

          <Card tone="accent" className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-read text-muted-foreground"><Megaphone className="h-4 w-4" aria-hidden="true" /> كودك</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black" dir="ltr">
                {me.code}
                <button type="button" aria-label="انسخ الكود" onClick={() => void copy(me.code, "نسخ الكود")} className="cursor-pointer"><Copy className="h-5 w-5" /></button>
              </p>
              <p className="mt-0.5 text-read text-muted-foreground">يكتبه متابعك في نموذج المنحة.</p>
            </div>
            <div className="min-w-0">
              <p className="text-read text-muted-foreground">رابطك</p>
              <p className="mt-1 truncate font-bold" dir="ltr">{me.link}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" icon={Copy} onClick={() => void copy(me.link, "نسخ الرابط")}>انسخ الرابط</Button>
                <Button size="sm" as="a" href={waShare(`${me.grant.nameAr}: دورات مباشرة على Zoom بخصم ${me.grant.percentOff}%.\n${me.link}`)} target="_blank" rel="noreferrer" icon={Share2}>واتساب</Button>
              </div>
            </div>
          </Card>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "سجلوا بكودك", value: String(me.totals.signups) },
              { label: "اشتروا", value: String(me.totals.buyers) },
              { label: "عمولتك", value: money(me.totals.earned) },
              { label: "دفعنا لك", value: money(me.totals.paid) },
              { label: "لك الآن", value: money(me.totals.balance) },
            ].map((x) => (
              <Card key={x.label} className="text-center">
                <p className="text-read text-muted-foreground">{x.label}</p>
                <p className="mt-1 text-xl font-black" dir="ltr">{x.value}</p>
              </Card>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-black">من اشترى بكودك</h2>
          {me.rows.length === 0 ? (
            <Card as="p" className="mt-3 text-read text-muted-foreground">لم يشتر أحد بكودك بعد. انشر رابطك ليصل لمتابعيك.</Card>
          ) : (
            <Card className="mt-3 overflow-x-auto">
              <table className="w-full text-read">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-2 text-start">التاريخ</th>
                    <th className="p-2 text-start">المتعلم</th>
                    <th className="p-2 text-start">الدورات</th>
                    <th className="p-2 text-start">سعر الدورات</th>
                    <th className="p-2 text-start">عمولتك</th>
                    <th className="p-2 text-start">الحال</th>
                  </tr>
                </thead>
                <tbody>
                  {me.rows.map((r) => (
                    <tr key={r.orderId} className="border-t border-border">
                      <td className="p-2">{fmtDate(new Date(r.at))}</td>
                      <td className="p-2 font-bold">{r.buyerAr}</td>
                      <td className="p-2">{r.courses}</td>
                      <td className="p-2" dir="ltr">{money(r.listTotal)}</td>
                      <td className="p-2 font-bold" dir="ltr">{money(r.commission)}</td>
                      <td className="p-2">{r.stateAr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-2 text-read text-muted-foreground">العمولة {me.commissionPercent}% من سعر الدورات قبل الخصم. وإن رد المبلغ لمتعلم نقصت عمولته بقدر ما رد.</p>

          <h2 className="mt-8 text-lg font-black">ما دفعناه لك</h2>
          {me.payouts.length === 0 ? (
            <Card as="p" className="mt-3 text-read text-muted-foreground">لا دفعات بعد.</Card>
          ) : (
            <Card className="mt-3 space-y-2">
              {me.payouts.map((p) => (
                <p key={p.id} className="flex flex-wrap justify-between gap-2 text-read">
                  <span>{fmtDate(new Date(p.paidAt))}{p.noteAr ? ` · ${p.noteAr}` : ""}</span>
                  <bdi dir="ltr" className="font-bold">{fmtMoney(p.amount, p.currency)}</bdi>
                </p>
              ))}
            </Card>
          )}
        </>
      )}
    </InfluencerLayout>
  );
}
