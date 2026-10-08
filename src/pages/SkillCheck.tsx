/* فحصُ المهارة في المجال — صفحةُ المتعلّم (٨ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: فحوصٌ قصيرةٌ في أربعة مجالات، **اختياريّةٌ من صفحة النتيجة**
   كاختبار الإنجليزيّة، و«تُفتح فورا وتُراجَع بعدُ». اثنا عشر سؤالا: أربعةٌ لكلّ مستوى
   (أساسيّ · متوسّط · متقدّم). وإن خالفت النتيجةُ ما وصفه المتعلّمُ عُرض الخياران وأثرُ
   كلٍّ — «حدّث خطّتي» أو «أبقِ مستواي الموصوف» — ولا يُبدَّل مستواه عنه.

   والتصحيحُ على الخادم: الجوابُ الصحيحُ لا يصل المتصفّح. */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Gauge, Loader2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import Button from "@/components/ui/Button";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import { ApiError } from "@/services/api";
import { fetchPlacementBank, scoreFieldCheckOn, type PlacementBank } from "@/services/placement";
import { CHECK_LEVELS, FIELD_CHECKS, type FieldCheckResult, type FieldSubject } from "@/domain/placement/field-check";
import { FIELD_LEVELS } from "@/domain/diagnostic/v2_1/focus";
import { applyFieldLevelHref, statedFieldLevelOf } from "@/application/placement/links";

const levelOf = (code: string) => FIELD_LEVELS.find((l) => l.code === code);

export default function SkillCheck() {
  const { subject = "" } = useParams();
  const check = FIELD_CHECKS.find((c) => c.subject === subject) ?? null;
  const [params] = useSearchParams();
  const stated = statedFieldLevelOf(params);
  const [bank, setBank] = useState<PlacementBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<FieldCheckResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!check) return;
    fetchPlacementBank(check.subject).then(setBank, (e) => setError(e instanceof ApiError ? e.message : "تعذّر الوصول إلى الخادم"));
  }, [check]);

  const pages = useMemo(
    () => CHECK_LEVELS.map((l) => (bank?.items ?? []).filter((i) => i.level === l)).filter((p) => p.length > 0),
    [bank],
  );
  const total = pages.reduce((s, p) => s + p.length, 0);

  const submit = async () => {
    if (!check) return;
    setSending(true);
    try {
      setResult(await scoreFieldCheckOn(check.subject as FieldSubject, answers));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تصحيح الفحص");
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl px-5 py-12 md:py-16">
        <h1 className="text-2xl font-black leading-snug md:text-3xl">
          {check ? `فحصُ المهارة: ${check.title_ar}` : "فحصُ المهارة"}
        </h1>

        {!check && (
          <Panel className="mt-6 text-sm leading-7 text-foreground">
            لا فحصَ لهذا المجال بعد. <Link to="/diagnostic" className="font-bold underline">عُد إلى التشخيص</Link>
          </Panel>
        )}

        {error && <Panel tone="danger" className="mt-6 text-sm leading-7 text-foreground">{error}</Panel>}

        {check && !bank && !error && (
          <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
        )}

        {bank && !bank.open && (
          <Panel tone="accent" className="mt-6">
            <p className="text-sm font-black text-foreground">هذا الفحصُ غيرُ متاحٍ الآن</p>
            <p className="mt-2 text-read leading-relaxed text-muted-foreground">
              تُراجَع أسئلتُه. وخطّتُك قائمةٌ على المستوى الذي وصفتَه، ويُراجَع معك في أوّل لقاء.
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
              <li>{total} سؤالا من الأساسيّ إلى المتقدّم — ثلاثُ دقائق تقريبا.</li>
              <li>مجّانيّ، ولا حاجةَ إلى حساب.</li>
              <li>ما لا تعرفه اتركه — التخمينُ يُفسد القياس ولا يرفع مستواك.</li>
              <li>والنتيجةُ لك: تحدّث بها خطّتك أو تُبقي مستواك الموصوف.</li>
            </ul>
            <Button tone="confirm" className="mt-5" onClick={() => setPage(0)}>ابدأ الفحص</Button>
          </Card>
        )}

        {bank?.open && !result && page >= 0 && pages[page] && (
          <div className="mt-6">
            <p className="text-read font-bold text-muted-foreground">
              الجزء {page + 1} من {pages.length} · أجبتَ عن {Object.keys(answers).length} من {total}
            </p>
            <ol className="mt-4 flex flex-col gap-4">
              {pages[page].map((q, n) => (
                <Card as="li" key={q.id}>
                  <p className="text-sm font-bold leading-7 text-foreground">{n + 1}. {q.stem}</p>
                  <div role="radiogroup" aria-label={q.stem} className="mt-3 flex flex-col gap-2">
                    {q.options.map((o, k) => (
                      <Inset as="label" key={k} tone={answers[q.id] === k ? "accent" : "default"}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition ${answers[q.id] === k ? "text-foreground" : "text-muted-foreground"}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === k}
                          onChange={() => setAnswers({ ...answers, [q.id]: k })} />
                        {o}
                      </Inset>
                    ))}
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
                <Button tone="confirm" onClick={() => void submit()} loading={sending}>صحّح الفحص</Button>
              )}
            </div>
          </div>
        )}

        {result && check && <CheckOutcome result={result} stated={stated} field={check.title_ar} />}
      </section>
    </SiteShell>
  );
}

function CheckOutcome({ result, stated, field }: { result: FieldCheckResult; stated: string | null; field: string }) {
  const tested = levelOf(result.level);
  const said = stated ? levelOf(stated) : null;
  const differs = said && said.code !== result.level;
  return (
    <div className="mt-6 flex flex-col gap-5">
      <Card tone="positive">
        <p className="flex items-center gap-2 text-lg font-black text-foreground">
          <Gauge className="h-5 w-5 text-teal-light-ink" aria-hidden="true" />
          مستواك في «{field}»: {tested?.name_ar}
        </p>
        <p className="mt-3 text-read text-muted-foreground">أصبتَ {result.correct} من {result.total}.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {result.per_level.map((l) => (
            <li key={l.level}>
              <Inset className={`px-3 py-1 text-read font-bold ${l.passed ? "text-teal-light-ink" : "text-muted-foreground"}`}>
                {levelOf(l.level)?.name_ar} · {l.correct}/{l.total}
              </Inset>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          يُحسب المستوى مجتازا بثلثي أسئلته، ومستواك أعلى ما اجتزتَه وكلُّ ما دونه مجتاز.
        </p>
      </Card>

      {differs ? (
        <Panel>
          <p className="text-sm font-black text-foreground">
            وصفتَ مستواك «{said.name_ar}»، والفحصُ يقول «{tested?.name_ar}» — والخيارُ لك:
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            <li>
              <Button as={Link} to={applyFieldLevelHref(result.level)} tone="primary" className="w-full justify-start text-right">
                <CheckCircle2 className="h-4 w-4" /> حدّث خطّتي بمستوى الفحص ({tested?.name_ar})
              </Button>
              <p className="mt-1 text-read leading-6 text-muted-foreground">نعيد بناء خطّتك على هذا المستوى بلا إعادة الأسئلة — وتتغيّر الدوراتُ المقترحة إن لزم.</p>
            </li>
            <li>
              <Button as={Link} to="/diagnostic" tone="secondary" className="w-full justify-start text-right">
                أبقِ مستواي الموصوف ({said.name_ar})
              </Button>
              <p className="mt-1 text-read leading-6 text-muted-foreground">تبقى خطّتك كما هي — ويُراجَع مستواك مع مدرّبك في أوّل لقاء.</p>
            </li>
          </ul>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm leading-7 text-foreground">
            {said
              ? "الفحصُ يؤكّد ما وصفتَه — خطّتك مبنيّةٌ على مستواك الصحيح."
              : "صِف مستواك في التشخيص بما قاله الفحص — فتُبنى خطّتك عليه."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {/* والمؤكَّدُ يعود عبر بابِ التعديل بالمستوى نفسِه: تُبنى الخطّةُ كما هي، ويقول سطرُ
                مستواها «بناءً على فحص المهارة» بدل جوابه */}
            <Button as={Link} to={said ? applyFieldLevelHref(result.level) : "/diagnostic"} tone="secondary">
              {said ? "عُد إلى خطّتي" : "إلى التشخيص"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
