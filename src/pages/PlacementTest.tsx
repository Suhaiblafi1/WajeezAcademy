/* اختبارُ تحديد مستوى الإنجليزيّة — صفحةُ المتعلّم (٨ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: اختبارٌ على المنصّة، مجّانيّ، **اختياريٌّ من صفحة النتيجة**،
   ثلاثون سؤالا تقريبا (قواعد · مفردات · قراءة)، ومن شاء سجّل بمستواه الموصوف بلا
   اختبار. وإن خالف الاختبارُ ما وصفه يُعرض عليه الخياران وأثرُ كلٍّ — لا يُبدَّل
   مستواه عنه (قاعدةُ «لا إجبارَ على فعل»).

   والأسئلةُ مستوى بعد مستوى (ستّةٌ في الصفحة): أخفُّ على العين من ثلاثين دفعة،
   ويرى المتعلّمُ أين وصل. ولا تصحيحَ في المتصفّح — الأجوبةُ تُرسَل والخادمُ يحكم. */

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Gauge, Loader2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import Button from "@/components/ui/Button";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import { ApiError } from "@/services/api";
import { fetchPlacementBank, scorePlacement, type PlacementBank } from "@/services/placement";
import { PLACEMENT_LEVELS, type PlacementResult } from "@/domain/placement/english-placement";
import { ENGLISH_LEVELS } from "@/domain/diagnostic/v2_1/english";
import { applyPlacementHref, statedLevelOf } from "@/application/placement/links";

const levelOf = (code: string) => ENGLISH_LEVELS.find((l) => l.code === code);

export default function PlacementTest() {
  const [params] = useSearchParams();
  const stated = statedLevelOf(params);
  const [bank, setBank] = useState<PlacementBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchPlacementBank().then(setBank, (e) => setError(e instanceof ApiError ? e.message : "تعذّر الوصول إلى الخادم"));
  }, []);

  const pages = useMemo(
    () => PLACEMENT_LEVELS.map((l) => (bank?.items ?? []).filter((i) => i.level === l)).filter((p) => p.length > 0),
    [bank],
  );
  const total = pages.reduce((s, p) => s + p.length, 0);
  const answered = Object.keys(answers).length;

  const submit = async () => {
    setSending(true);
    try {
      setResult(await scorePlacement(answers));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تصحيح الاختبار");
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl px-5 py-12 md:py-16">
        <h1 className="text-2xl font-black leading-snug md:text-3xl">اختبارُ تحديد مستوى الإنجليزيّة</h1>

        {error && <Panel tone="danger" className="mt-6 text-sm leading-7 text-foreground">{error}</Panel>}

        {!bank && !error && (
          <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
        )}

        {bank && !bank.open && (
          <Panel tone="accent" className="mt-6">
            <p className="text-sm font-black text-foreground">الاختبارُ قيد المراجعة — يُفتح قريبا</p>
            <p className="mt-2 text-read leading-relaxed text-muted-foreground">
              يراجع مدرّبُ الإنجليزيّة أسئلتَه قبل أن يُعرض على أحد. وإلى أن يُفتح فلك خياران:
              أن تسجّل بالمستوى الذي وصفتَه الآن — ويُراجَع معك في أوّل لقاء — أو أن تعود هنا حين يُفتح.
            </p>
            <Button as={Link} to="/diagnostic" tone="secondary" className="mt-4">عُد إلى خطّتي</Button>
          </Panel>
        )}

        {bank?.open && !result && page === -1 && (
          <Card className="mt-6">
            <p className="flex items-center gap-2 text-sm font-black text-foreground">
              <ClipboardCheck className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> قبل أن تبدأ
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-read leading-relaxed text-muted-foreground">
              <li>{total} سؤالا في قواعد اللغة ومفرداتها والقراءة — من المستوى الأوّل إلى المتقدّم.</li>
              <li>بين ربع ساعةٍ وعشرين دقيقة، ومجّانيّ، ولا حاجةَ إلى حساب.</li>
              <li>ما لا تعرفه اتركه — التخمينُ يُفسد القياس ولا يرفع مستواك.</li>
              <li>والنتيجةُ لك: تحدّث بها خطّتك أو تُبقي مستواك الموصوف.</li>
            </ul>
            <Button tone="primary" className="mt-5" onClick={() => setPage(0)}>ابدأ الاختبار</Button>
          </Card>
        )}

        {bank?.open && !result && page >= 0 && pages[page] && (
          <div className="mt-6">
            <p className="text-fine font-bold text-muted-foreground">
              الجزء {page + 1} من {pages.length} · أجبتَ عن {answered} من {total}
            </p>
            <ol className="mt-4 flex flex-col gap-4">
              {pages[page].map((q, n) => (
                <Card as="li" key={q.id}>
                  <div dir="ltr" className="text-left">
                    {q.passage && <Inset as="p" className="mb-3 p-3 text-sm leading-7 text-foreground">{q.passage}</Inset>}
                    <p className="text-sm font-bold leading-7 text-foreground">{n + 1}. {q.stem}</p>
                    <div role="radiogroup" aria-label={q.stem} className="mt-3 flex flex-col gap-2">
                      {q.options.map((o, k) => (
                        <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${answers[q.id] === k ? "border-teal text-foreground" : "border-white/10 text-muted-foreground hover:border-white/30"}`}>
                          <input type="radio" name={q.id} checked={answers[q.id] === k}
                            onChange={() => setAnswers({ ...answers, [q.id]: k })} />
                          {o}
                        </label>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button tone="ghost" onClick={() => setPage(page - 1)} disabled={page === 0}>
                <ArrowRight className="h-4 w-4" /> السابق
              </Button>
              {page < pages.length - 1 ? (
                <Button tone="confirm" onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }); }}>
                  التالي <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button tone="primary" onClick={() => void submit()} loading={sending}>
                  صحّح الاختبار
                </Button>
              )}
            </div>
          </div>
        )}

        {result && <PlacementOutcome result={result} stated={stated} />}
      </section>
    </SiteShell>
  );
}

function PlacementOutcome({ result, stated }: { result: PlacementResult; stated: ReturnType<typeof statedLevelOf> }) {
  const tested = levelOf(result.level);
  const said = stated ? levelOf(stated) : null;
  const differs = said && said.code !== result.level;
  return (
    <div className="mt-6 flex flex-col gap-5">
      <Card tone="positive">
        <p className="flex items-center gap-2 text-lg font-black text-foreground">
          <Gauge className="h-5 w-5 text-teal-light-ink" aria-hidden="true" />
          مستواك في الاختبار: <span dir="ltr">{result.cefr}</span>
        </p>
        {tested && <p className="mt-1 text-read text-muted-foreground">{tested.label_ar}</p>}
        <p className="mt-3 text-read text-muted-foreground">أصبتَ {result.correct} من {result.total}.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {result.per_level.map((l) => (
            <li key={l.level}>
              <Inset className={`px-3 py-1 text-fine font-bold ${l.passed ? "text-teal-light-ink" : "text-muted-foreground"}`}>
                <span dir="ltr">{l.level}</span> · {l.correct}/{l.total}
              </Inset>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-fine leading-6 text-muted-foreground">
          يُحسب المستوى مجتازا بثلثي أسئلته، ومستواك أعلى ما اجتزتَه وكلُّ ما دونه مجتاز.
        </p>
      </Card>

      {differs ? (
        <Panel>
          <p className="text-sm font-black text-foreground">
            وصفتَ مستواك <span dir="ltr">{said.cefr}</span>، والاختبارُ يقول <span dir="ltr">{result.cefr}</span> — والخيارُ لك:
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            <li>
              <Button as={Link} to={applyPlacementHref(result.level)} tone="primary" className="w-full justify-start text-right">
                <CheckCircle2 className="h-4 w-4" /> حدّث خطّتي بمستوى الاختبار (<span dir="ltr">{result.cefr}</span>)
              </Button>
              <p className="mt-1 text-fine leading-6 text-muted-foreground">نعيد بناء خطّتك على هذا المستوى بلا إعادة الأسئلة — وتتغيّر الدوراتُ المقترحة إن لزم.</p>
            </li>
            <li>
              <Button as={Link} to="/diagnostic" tone="secondary" className="w-full justify-start text-right">
                أبقِ مستواي الموصوف (<span dir="ltr">{said.cefr}</span>)
              </Button>
              <p className="mt-1 text-fine leading-6 text-muted-foreground">تبقى خطّتك كما هي — ويُراجَع مستواك مع مدرّبك في أوّل لقاء.</p>
            </li>
          </ul>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm leading-7 text-foreground">
            {/* بلا مستوى موصوفٍ في الرابط لا نعرف أنّ على الجهاز خطّةَ إنجليزيّةٍ تُحدَّث —
                فلا يُعرض «حدّث خطّتي» على تشخيصٍ قد يكون في غيرها */}
            {said
              ? "الاختبارُ يؤكّد ما وصفتَه — خطّتك مبنيّةٌ على مستواك الصحيح."
              : "اختر «اللغة الإنجليزيّة» في التشخيص وصِف مستواك بما قاله الاختبار — فتُبنى خطّتك عليه."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button as={Link} to="/diagnostic" tone="secondary">{said ? "عُد إلى خطّتي" : "إلى التشخيص"}</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
