/* سجلُّ المتقدّم كما يراه قارئٌ بلا حساب — يقرأ ويقيّم ويحفظ.

   ═══ لماذا وُجدت ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «اجعله رابطا خارجيّا نرسله بين الفريق
   ليقرأه الجميعُ ويعدّل عليه، بدلا من ملفِّ طباعةٍ قد يساهم في تدمير البيئة».

   والرابطُ **باسمِ قارئٍ بعينه** لا عامّا: يُفتح بنقرةٍ بلا تسجيل، والرابطُ
   نفسُه هو الهويّة، فما يُحفظ يحمل اسمَ كاتبه — وتقييمٌ بلا اسمٍ لا يصلح
   مرجعا يُرجَع إليه إن سأل مرفوضٌ عن سببِ رفضه.

   ═══ وما لا تجده هنا ═══

   بريدُ المتقدّم وهاتفُه محجوبان (الخادمُ لا يرسلهما أصلا)، وتقييماتُ
   الزملاء كذلك: من رأى أنّ زميله أعطى ٥ لم يعد رأيُه رأيَه. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { apiGet, apiPut, ApiError } from '@/services/api'
import { RUBRIC_AXES } from '@/application/trainer/rubric'
import { INTERVIEW_OUTCOMES, outcomeLabelAr } from '@/application/trainer/interview-outcome'
import ApplicationDossier, { type Dossier } from './admin/ApplicationDossier'
import InterviewQuestions from './admin/InterviewQuestions'
import { Panel, Inset } from '@/components/ui/Surface'
import { fmtDateLong, fmtDateTime } from '@/application/text/format-ar'

interface MyReview {
  scores: Record<string, number> | null
  overallNote: string | null
  verdict: string | null
  interviewId: string | null
  coursesNote: string | null
  feeExpectationAr: string | null
  feeProposalAr: string | null
  updatedAt: string
}

/** موعدُ لقاءٍ كما يراه القارئ — ليُعلَّق حكمُه بواحدٍ منها */
interface SharedInterview {
  id: string
  scheduledAt: string
  mode: string
  canceledAt: string | null
  outcome: string | null
}

interface SharedView {
  reviewer: { name: string; expiresAt: string }
  application: Dossier & {
    reference: string
    documents: { id: string; kind: string; originalName: string; storageKey: string }[]
    interviews?: SharedInterview[]
  }
  documentUrls: Record<string, string>
  myReview: MyReview | null
}

/* ═══ والأربعةُ كلُّها من معجمها (٢١ سبتمبر ٢٠٢٦) ═══

   كانت ثلاثةً مكتوبةً هنا بألفاظٍ أخرى: «يجتاز» و«يُعاد لقاؤه» و«لا يجتاز»
   — بينما قسمُ المقابلة يقول «ناجح» و«تعليق» و«غير مناسب». لفظان لحقيقةٍ
   واحدة، وهو ما شُكي منه: «لا أريد شيئين».

   وقد صار الحكمُ معلَّقا بمقابلةٍ بعينها ويُكتب في عمودها، فالحاكمُ هو من
   جلس إليها — و«لم يحضر» خبرٌ يملكه. فهي `INTERVIEW_OUTCOMES` بعينها. */

const KIND_AR: Record<string, string> = {
  cv: 'السيرة الذاتيّة', certificate: 'شهادة', training_video: 'مادّةٌ تدريبيّة',
  evidence: 'دليلٌ على الخبرة', reference_letter: 'رسالةُ تزكية', other: 'أخرى',
}

export default function SharedDossier() {
  const { token = '' } = useParams()
  const [view, setView] = useState<SharedView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [scores, setScores] = useState<Record<string, number>>({})
  const [overallNote, setOverallNote] = useState('')
  const [verdict, setVerdict] = useState<string>('')
  /* المقابلةُ التي يحكم فيها — لا قرارَ بلا موعدٍ يُنسَب إليه */
  const [interviewId, setInterviewId] = useState<string>('')
  const [coursesNote, setCoursesNote] = useState('')
  /* الاتفاقُ الماليُّ — نصّا لا رقما، ويُملأ إن جرى ذكرُه ويُترك إن لم يُذكر */
  const [feeExpectation, setFeeExpectation] = useState('')
  const [feeProposal, setFeeProposal] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  /* صفحةٌ تحمل اسمَ إنسانٍ وسيرتَه لا تُفهرَس — والترويسةُ على الردّ كذلك */
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    return () => { document.head.removeChild(tag) }
  }, [])

  useEffect(() => {
    let alive = true
    apiGet<SharedView>(`/api/r/${encodeURIComponent(token)}`)
      .then((v) => {
        if (!alive) return
        setView(v)
        setScores((v.myReview?.scores as Record<string, number>) ?? {})
        setOverallNote(v.myReview?.overallNote ?? '')
        setVerdict(v.myReview?.verdict ?? '')
        setInterviewId(v.myReview?.interviewId ?? '')
        setCoursesNote(v.myReview?.coursesNote ?? '')
        setFeeExpectation(v.myReview?.feeExpectationAr ?? '')
        setFeeProposal(v.myReview?.feeProposalAr ?? '')
        setSavedAt(v.myReview?.updatedAt ?? null)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof ApiError ? e.message : 'تعذّر فتحُ السجلّ')
      })
    return () => { alive = false }
  }, [token])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const r = await apiPut<{ savedAt: string }>(`/api/r/${encodeURIComponent(token)}/review`, {
        scores, overallNote: overallNote || null, verdict: verdict || null, coursesNote: coursesNote || null,
        interviewId: interviewId || null,
        feeExpectationAr: feeExpectation || null, feeProposalAr: feeProposal || null,
      })
      setSavedAt(r.savedAt)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'تعذّر الحفظ')
    } finally {
      setSaving(false)
    }
  }, [token, scores, overallNote, verdict, interviewId, coursesNote, feeExpectation, feeProposal])

  /* مواعيدُه مقسومةً: ما يُحكَم فيه وما أُلغي. والأحدثُ أوّلا كما يصل. */
  const interviews = useMemo(() => view?.application.interviews ?? [], [view])
  const bookable = useMemo(() => interviews.filter((iv) => !iv.canceledAt), [interviews])
  const canceled = useMemo(() => interviews.filter((iv) => iv.canceledAt), [interviews])

  /* ما لم يُقيَّم بعد — يُقال عددُه ولا يُترك القارئُ يعدّ بعينه */
  const remaining = useMemo(
    () => RUBRIC_AXES.filter((x) => !scores[x.key]).length,
    [scores],
  )

  if (error && !view) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-lg font-black">لا يُفتح هذا الرابط</h1>
        <p className="mt-3 text-read leading-7 text-muted-foreground">{error}</p>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          الروابطُ محدودةُ الأجل وتُلغى عند الحاجة — اطلب رابطا جديدا ممّن أرسله إليك.
        </p>
      </div>
    )
  }
  if (!view) return <div className="px-4 py-24 text-center text-muted-foreground">…يُفتح السجلّ</div>

  const a = view.application

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="mb-5">
        <p className="text-read text-muted-foreground">سجلُّ متقدّمٍ للتدريب · {a.reference}</p>
        <h1 className="mt-1 text-xl font-black">{a.fullName}</h1>
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          يقرؤه ويقيّمه <span className="font-bold text-teal-light-ink">{view.reviewer.name}</span>
          {' · '}صلاحيّةُ الرابط حتّى {fmtDateLong(new Date(view.reviewer.expiresAt))}
        </p>
      </header>

      <ApplicationDossier a={a} showContact={false} />

      {a.documents.length > 0 && (
        <Panel as="section" className="mt-4">
          <h2 className="text-sm font-black">وثائقُه</h2>
          <ul className="mt-3 space-y-2">
            {a.documents.map((d) => (
              <li key={d.id}>
                <a href={view.documentUrls[d.storageKey]} target="_blank" rel="noreferrer"
                  className="text-read text-teal-light-ink underline underline-offset-4">
                  {KIND_AR[d.kind] ?? d.kind} — {d.originalName}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* مفتوحةً هنا: هذه الصفحةُ لا تُفتح إلّا في الغرفة، والأسئلةُ سببُ
          فتحها — فطيُّها يُخفي المقصودَ خلف نقرة. وفي شاشة الأدمن تُطوى. */}
      <div className="mt-4">
        <InterviewQuestions a={a} defaultOpen />
      </div>

      {/* ═══ ما يُملأ — وهو سببُ وجود الصفحة ═══ */}
      <Panel as="section" className="mt-4">
        <h2 className="text-sm font-black">تقييمُك</h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          احفظ متى شئت — الناقصُ يُقبل، وتستطيع العودةَ فتُتمّه. ولا يرى غيرُك ما تكتب هنا قبل أن يكتب رأيَه.
        </p>

        <div className="mt-4 space-y-2">
          {RUBRIC_AXES.map((axis) => (
            <Inset key={axis.key} className="flex flex-wrap items-center justify-between gap-3 !py-2">
              <div className="min-w-0">
                <span className="text-read font-bold">{axis.label}</span>
                {axis.laterAr && (
                  <span className="block text-read leading-5 text-muted-foreground">{axis.laterAr}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button"
                    aria-pressed={scores[axis.key] === n}
                    aria-label={`${axis.label}: ${n} من 5`}
                    onClick={() => setScores((s) => (s[axis.key] === n
                      ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== axis.key))
                      : { ...s, [axis.key]: n }))}
                    className={`h-8 w-8 rounded-md border text-read font-bold transition ${
                      scores[axis.key] === n
                        ? 'border-teal-light-ink bg-teal-light-ink/15 text-teal-light-ink'
                        : 'border-white/15 text-muted-foreground hover:border-white/30'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </Inset>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-read font-bold">ملاحظتُك</span>
          <textarea value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={4}
            maxLength={4000} placeholder="ما رأيتَه ولا تقوله الدرجات"
            className="mt-1 w-full rounded-lg border border-white/12 bg-transparent p-3 text-read leading-6" />
        </label>

        {/* الدوراتُ لا تُعدَّل هنا: ملاحظةٌ يعدّلها هو في «المؤهّلات» عنده */}
        <label className="mt-4 block">
          <span className="text-read font-bold">ملاحظةٌ على دوراته</span>
          <span className="block text-read leading-6 text-muted-foreground">
            لا تُعدَّل دوراتُه من هنا — تصله الملاحظةُ فيحدّث مؤهّلاته بنفسه.
          </span>
          <textarea value={coursesNote} onChange={(e) => setCoursesNote(e.target.value)} rows={3}
            maxLength={4000}
            className="mt-1 w-full rounded-lg border border-white/12 bg-transparent p-3 text-read leading-6" />
        </label>

        {/* ═══ الاتفاقُ الماليُّ — إن جرى ذكرُه ═══

            قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «ضع في التقييم داخل الرابط
            الاتفاقَ الماليَّ في حال تمّ التحدّث عنه: ما هي توقّعاتها، وكم
            نقترح أن يكون المبلغ — لغايات التقديم فقط».

            ونصٌّ لا رقمٌ بقصد: الوحدةُ تختلف (بالساعة؟ بالشعبة؟) والعملةُ
            تختلف، وأكثرُ ما يُقال في مكالمةٍ مدى لا رقمٌ واحد. وخانةٌ رقميّةٌ
            تجبر القارئَ على اختراع دقّةٍ لا يملكها.

            **ولا يقع بهذين عقدٌ ولا دفعة**: يُقرآن عند القرار، ويُبنى العقدُ
            في موضعه. */}
        <Inset as="fieldset" className="mt-5 p-4">
          <legend className="px-1 text-read font-bold">الاتفاقُ الماليّ — إن جرى ذكرُه</legend>
          <p className="text-read leading-6 text-muted-foreground">
            لغايات التقديم فقط. اتركهما فارغَين إن لم يُذكر المالُ في حديثك معه.
          </p>
          <label className="mt-3 block">
            <span className="text-read font-bold">ما يتوقّعه هو</span>
            <input value={feeExpectation} onChange={(e) => setFeeExpectation(e.target.value)}
              maxLength={500} placeholder="مثال: ٢٥ دينارا للساعة، أو «لم يحدّد ويترك الأمر لنا»"
              className="mt-1 w-full rounded-lg border border-white/12 bg-transparent p-3 text-read leading-6" />
          </label>
          <label className="mt-3 block">
            <span className="text-read font-bold">ما نقترحه نحن</span>
            <input value={feeProposal} onChange={(e) => setFeeProposal(e.target.value)}
              maxLength={500} placeholder="مثال: ٢٠ دينارا للساعة لأوّل شعبة، تُراجَع بعدها"
              className="mt-1 w-full rounded-lg border border-white/12 bg-transparent p-3 text-read leading-6" />
          </label>
        </Inset>

        {/* ═══ في أيّ لقاءٍ تحكم؟ (٢١ سبتمبر ٢٠٢٦) ═══

            «لا أريد التقييمَ العامّ، أريده مرتبطا بالمقابلات المجدولة — تقترح
            التاريخَ واليومَ والوقتَ ونضغط عليه قبل الحفظ».

            وهو أوّلُ القرار لا حاشيتُه: من لم يختر لقاءً لم يحكم في شيء،
            فالاختيارُ فوق الأزرار لا تحتها. والملغى يُعرض معطَّلا ولا يُخفى:
            من حكم في موعدٍ ثمّ أُلغي يقرأ لماذا لم يعد يُختار. */}
        <fieldset className="mt-4">
          <legend className="text-read font-bold">في أيّ مقابلةٍ تحكم؟</legend>
          {bookable.length === 0 ? (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              لا مقابلةَ مجدولةٌ لهذا المتقدّم بعد — والقرارُ يُعلَّق بلقاءٍ وقع، فلا يُحفظ
              قرارٌ قبلها. وما تكتبه من درجاتٍ وملاحظاتٍ يُحفَظ ويبقى.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {bookable.map((iv) => (
                <button key={iv.id} type="button"
                  aria-pressed={interviewId === iv.id}
                  onClick={() => setInterviewId((cur) => (cur === iv.id ? '' : iv.id))}
                  /* ومستديرةٌ كأزرار القرار تحتها: هي اختيارٌ من بين خياراتٍ
                     مثلُها، ومستطيلٌ بحدٍّ وانحناءٍ سطحٌ لا خيار. */
                  className={`rounded-full border px-4 py-2 text-read transition ${
                    interviewId === iv.id
                      ? 'border-teal-light-ink bg-teal-light-ink/15 text-teal-light-ink'
                      : 'border-white/15 text-muted-foreground hover:border-white/30'
                  }`}>
                  {fmtDateTime(new Date(iv.scheduledAt))}
                </button>
              ))}
            </div>
          )}
          {canceled.length > 0 && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              وملغاةٌ لا يُحكَم فيها: {canceled.map((iv) => fmtDateTime(new Date(iv.scheduledAt))).join(' · ')}
            </p>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-read font-bold">قرارُك في هذا اللقاء</legend>
          {/* والقرارُ يُعرض معطَّلا قبل اختيار اللقاء — لا يُخفى: من لم يره
              لم يعرف أنّ عليه أن يختار أوّلا. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERVIEW_OUTCOMES.map((o) => (
              <button key={o.key} type="button"
                disabled={!interviewId}
                title={o.whatAr}
                aria-pressed={verdict === o.key}
                onClick={() => setVerdict((cur) => (cur === o.key ? '' : o.key))}
                className={`rounded-full border px-4 py-1.5 text-read transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  verdict === o.key
                    ? 'border-teal-light-ink bg-teal-light-ink/15 text-teal-light-ink'
                    : 'border-white/15 text-muted-foreground hover:border-white/30'
                }`}>
                {o.labelAr}
              </button>
            ))}
          </div>
          {!interviewId && bookable.length > 0 && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">اختر المقابلةَ أوّلا — القرارُ يُنسَب إلى لقاءٍ بعينه.</p>
          )}
          {/* وما يقع حين يُحفَظ: القرارُ يُكتب في الموعد نفسِه، فلا يُسجَّل مرّتين */}
          {verdict && interviewId && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              يُسجَّل «{outcomeLabelAr(verdict)}» نتيجةً لهذا اللقاء. وإن حكم فيه قارئٌ آخرُ
              بغيره عُرض القولان معا بأسمائكما، ولم يُكتب في الموعد شيءٌ حتّى تتّفقا.
            </p>
          )}
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={saving}
            className="rounded-lg bg-teal-light-ink px-5 py-2 text-read font-bold text-black disabled:opacity-50">
            {saving ? '…يُحفظ' : 'احفظ'}
          </button>
          <span className="text-read text-muted-foreground">
            {remaining > 0 ? `بقي ${remaining} من ${RUBRIC_AXES.length} محورا بلا درجة` : 'المحاورُ كلُّها مقيَّمة'}
          </span>
          {savedAt && (
            <span className="text-read text-teal-light-ink">
              حُفظ آخرَ مرّةٍ {fmtDateLong(new Date(savedAt))}
            </span>
          )}
        </div>

        {error && <p className="mt-3 text-read text-gold-ink">{error}</p>}
      </Panel>
    </div>
  )
}
