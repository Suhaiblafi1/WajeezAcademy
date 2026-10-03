/* عنوانُك ونبذتُك في «المدربون» — تكتبهما هنا، ونعتمدهما قبل أن يظهرا.

   قرارُ صاحب المنصّة (٣ أكتوبر ٢٠٢٦) — والطريقُ كلُّه في
   `server/services/trainer-public-text.service.ts`: ما ترسله ينتظر، والمعتمَدُ
   قبله يبقى معروضا، ومن يعتمده قد يحرّره تحريرا يسيرا — فيُقال لك ذلك هنا
   قبل أن ترسل، لا بعد أن ترى نصّا غيرَ نصّك. */

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import {
  BIO_MAX_WORDS, HEADLINE_MAX_CHARS, countWords, publicTextProblemAr,
} from "@/application/trainer/public-text";

interface MyPublicText {
  headline: string | null; bioPublic: string | null;
  headlinePending: string | null; bioPending: string | null;
  pendingAt: string | null; rejectNoteAr: string | null; published: boolean;
}

export default function PublicTextCard({ inputCls }: { inputCls: string }) {
  const [data, setData] = useState<MyPublicText | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);

  const fill = (d: MyPublicText) => {
    setData(d);
    /* الحقلان يبدآن بآخر ما كتبه: المعلَّقُ إن كان، وإلّا المعتمَد */
    setHeadline(d.headlinePending ?? d.headline ?? "");
    setBio(d.bioPending ?? d.bioPublic ?? "");
  };

  useEffect(() => {
    let alive = true;
    apiGet<MyPublicText>("/api/trainer/public-text").then((d) => { if (alive) fill(d); }).catch(() => undefined);
    return () => { alive = false };
  }, []);

  if (!data) return null;
  const words = countWords(bio);
  const problem = publicTextProblemAr(headline, bio);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      fill(await apiPut<MyPublicText>("/api/trainer/public-text", { headline, bio }));
      setMsg({ bad: false, text: "أُرسلت — تظهر في «المدربون» حين نعتمدها، ويصلك خبرُ ذلك." });
    } catch (e) {
      setMsg({ bad: true, text: e instanceof ApiError ? e.message : "تعذّر الإرسال" });
    } finally { setBusy(false); }
  };

  return (
    <Panel as="section" className="mt-6 md:p-8" aria-labelledby="public-text-h">
      <h2 id="public-text-h" className="text-base font-black">ما يراه الناس عنك في «المدربون»</h2>
      <p className="mt-2 max-w-3xl text-read leading-7 text-muted-foreground">
        عنوانُك المهنيُّ ونبذتُك يظهران مع صورتك في صفحة «المدربون» وفي صفحتك العامّة. اكتبهما لمتعلّمٍ يوازن
        بينك وبين غيرك: ما تدرّبه، وما يصدّقه من خبرتك، وما يخرج به من يتعلّم معك. ونقرؤهما قبل أن يظهرا —
        وقد نحرّرهما تحريرا يسيرا، ويصلك خبرُ ذلك.
        {!data.published && " ولا يظهر اسمُك للعامّة أصلا حتّى نعتمد نشرَ ملفّك."}
      </p>

      {data.pendingAt && (
        <Inset tone="accent" className="mt-3 p-3 text-read leading-6">
          أرسلتَهما {fmtDateTime(data.pendingAt)} — ينتظران اعتمادَنا. وما هو معتمَدٌ قبلهما يبقى معروضا حتّى نقرّر.
        </Inset>
      )}
      {data.rejectNoteAr && !data.pendingAt && (
        <Inset tone="warn" className="mt-3 p-3 text-read leading-6">
          لم نعتمد آخرَ ما أرسلت — السبب: {data.rejectNoteAr}
        </Inset>
      )}

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1.5 block text-fine font-bold text-muted-foreground">العنوانُ المهنيّ</span>
          <input value={headline} maxLength={HEADLINE_MAX_CHARS} onChange={(e) => setHeadline(e.target.value)}
            placeholder="مثال: مدرّبُ تحليل بياناتٍ تطبيقيّ" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-fine font-bold text-muted-foreground">النبذة</span>
          <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
          <span className={`mt-1 block text-read ${words > BIO_MAX_WORDS ? "text-gold-ink" : "text-muted-foreground"}`}>
            {words} / {BIO_MAX_WORDS} كلمة
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button tone="confirm" icon={Send} loading={busy} disabled={Boolean(problem)} onClick={() => void submit()}>
          {data.pendingAt ? "أرسِلِ التعديلَ للاعتماد" : "أرسِلْهما للاعتماد"}
        </Button>
        {problem && <span className="text-read text-muted-foreground">{problem}</span>}
      </div>
      {msg && (
        <p role="alert" className={`mt-2 text-read font-semibold ${msg.bad ? "text-red-300" : "text-teal-light-ink"}`}>{msg.text}</p>
      )}
    </Panel>
  );
}
