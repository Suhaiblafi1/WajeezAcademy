/* اسمُك وعنوانُك ونبذتُك في «المدربون» — تكتبها هنا، ونعتمدها قبل أن تظهر.

   قرارُ صاحب المنصّة (٣ أكتوبر ٢٠٢٦) — والطريقُ كلُّه في
   `server/services/trainer-public-text.service.ts`: ما ترسله ينتظر، والمعتمَدُ
   قبله يبقى معروضا، ومن يعتمده قد يحرّره تحريرا يسيرا — فيُقال لك ذلك هنا
   قبل أن ترسل، لا بعد أن ترى نصّا غيرَ نصّك.

   واسمُك معها (قرارُ ٢١ أكتوبر ٢٠٢٦، «A»): كان الاسمُ ما كُتب في طلبك ولا يغيّره أحد. فصار حقلا هنا،
   يُرسل إن غيّرته، ويبقى القديمُ ظاهرا حتّى نعتمده. */

import { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, Globe, Send } from "lucide-react";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import SectionHead from "@/components/ui/SectionHead";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import {
  BIO_MAX_WORDS, HEADLINE_MAX_CHARS, NAME_MAX_CHARS, countWords, publicNameProblemAr, publicTextProblemAr,
} from "@/application/trainer/public-text";

interface MyPublicText {
  headline: string | null; bioPublic: string | null;
  headlinePending: string | null; bioPending: string | null;
  name: string; namePending: string | null;
  pendingAt: string | null; rejectNoteAr: string | null; published: boolean;
}

export default function PublicTextCard({ inputCls }: { inputCls: string }) {
  const [data, setData] = useState<MyPublicText | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);

  const fill = (d: MyPublicText) => {
    setData(d);
    /* الحقلان يبدآن بآخر ما كتبه: المعلَّقُ إن كان، وإلّا المعتمَد */
    setHeadline(d.headlinePending ?? d.headline ?? "");
    setBio(d.bioPending ?? d.bioPublic ?? "");
    setName(d.namePending ?? d.name);
  };

  useEffect(() => {
    let alive = true;
    apiGet<MyPublicText>("/api/trainer/public-text").then((d) => { if (alive) fill(d); }).catch(() => undefined);
    return () => { alive = false };
  }, []);

  if (!data) return null;
  const words = countWords(bio);
  const problem = publicNameProblemAr(name) ?? publicTextProblemAr(headline, bio);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      fill(await apiPut<MyPublicText>("/api/trainer/public-text", { headline, bio, name }));
      setMsg({ bad: false, text: "أرسلت — تظهر حين نعتمدها، ويصلك خبر." });
    } catch (e) {
      setMsg({ bad: true, text: e instanceof ApiError ? e.message : "تعذّر الإرسال" });
    } finally { setBusy(false); }
  };

  /* حالُ ما يراه الناسُ الآن — شارةٌ في رأس القسم بدل فقرةٍ يُبحث فيها عنه */
  const status = data.pendingAt
    ? <Chip tone="warn" icon={Clock}>بانتظار اعتمادنا</Chip>
    : data.published
      ? <Chip tone="positive" icon={Eye}>ظاهر للناس</Chip>
      : <Chip tone="neutral" icon={EyeOff}>لم ينشر بعد</Chip>;

  return (
    <Panel as="section" className="md:p-8" aria-labelledby="public-text-h">
      <SectionHead
        id="public-text-h" icon={Globe} action={status}
        title="ما يراه الناس عنك في «المدربون»"
        desc={<>
          تظهر مع صورتك في «المدربون» وصفحتك العامة. نراجعها قبل النشر وقد نحرّرها يسيرا.
          والاسم هنا هو ما يراه الناس، لا اسم حسابك أعلاه.
          {!data.published && " ولا يظهر اسمك للعامة حتى نعتمد نشر ملفك."}
        </>}
      />

      {data.pendingAt && (
        <Inset tone="accent" className="mt-5 p-3 text-read leading-6">
          أرسلتها {fmtDateTime(data.pendingAt)} — بانتظار اعتمادنا، والمعتمد قبلها يبقى معروضا.
          {data.namePending && <> واسمك الجديد «{data.namePending}» يظهر حين نعتمده.</>}
        </Inset>
      )}
      {data.rejectNoteAr && !data.pendingAt && (
        <Inset tone="warn" className="mt-5 p-3 text-read leading-6">
          لم نعتمد آخر ما أرسلت — السبب: {data.rejectNoteAr}
        </Inset>
      )}

      <div className="mt-6 grid gap-5">
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-bold text-muted-foreground">
            الاسم كما يظهر للناس
            <span className="text-fine font-semibold tabular-nums">{name.length} / {NAME_MAX_CHARS}</span>
          </span>
          <input value={name} maxLength={NAME_MAX_CHARS} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-bold text-muted-foreground">
            العنوان المهنيّ
            <span className="text-fine font-semibold tabular-nums">{headline.length} / {HEADLINE_MAX_CHARS}</span>
          </span>
          <input value={headline} maxLength={HEADLINE_MAX_CHARS} onChange={(e) => setHeadline(e.target.value)}
            placeholder="مثال: مدرّب تحليل بيانات تطبيقيّ" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-bold text-muted-foreground">
            النبذة
            <span className={`text-fine font-semibold tabular-nums ${words > BIO_MAX_WORDS ? "text-gold-ink" : ""}`}>
              {words} / {BIO_MAX_WORDS} كلمة
            </span>
          </span>
          <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="ما تدرّبه، وخبرتك، وما يخرج به متعلّمك." className={`${inputCls} leading-7`} />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <span className="min-w-0 flex-1 text-read text-muted-foreground">{problem ?? ""}</span>
        <Button tone="confirm" icon={Send} loading={busy} disabled={Boolean(problem)} onClick={() => void submit()} className="shrink-0">
          {data.pendingAt ? "أرسل التعديل للاعتماد" : "أرسلها للاعتماد"}
        </Button>
      </div>
      {msg && (
        <p role="alert" className={`mt-3 text-read font-semibold ${msg.bad ? "text-red-300" : "text-teal-light-ink"}`}>{msg.text}</p>
      )}
    </Panel>
  );
}
