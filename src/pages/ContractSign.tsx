/* صفحةُ توقيع العقد — يقرؤها المدرّبُ بلا حساب، من رابطٍ في بريده.

   ═══ ولمَ لا يُفتح زرُّ التوقيع قبل بلوغ آخر النصّ ═══

   خانةُ «قرأتُ ووافقت» تُنقَر بلا قراءةٍ في كلّ موضعٍ على الإنترنت، ولا تُثبت
   شيئا حين يُسأل عنها بعد سنة. وهذه وثيقةٌ تُلزم إنسانا بمال، فيُشترط بلوغُ
   آخر النصّ فعلا — ليس حيلةً على المستخدم بل شرطٌ يُقال له صراحةً في الشاشة
   («يُفتح التوقيعُ حين تبلغ آخر النصّ»)، ويراه يتحقّق تحت إصبعه.

   **وليس هذا نمطا مظلما.** النمطُ المظلمُ يُخفي ما يضرّ الناقرَ ليمرّ؛ وهذا
   يُبطئ النقرَ ليُقرأ ما يلزمه. والفرقُ في الاتّجاه لا في الأسلوب.

   ═══ وخمسةُ إقراراتٍ لا خانةٌ واحدة ═══

   كلُّ واحدةٍ منها بندٌ يُتوقَّع أن يُنازَع فيه — أوّلُها أنّ إدراج الدورة
   تأهيلٌ لا إسناد، وهو أوّلُ ما يقول المدرّبُ بعد شهرين إنّه لم يفهمه.
   ونصوصُها من الخادم لا من هنا، وتُحفَظ معه لحظةَ توقيعه.

   ═══ والاعتذارُ بابٌ ظاهرٌ لا مخبوء ═══

   العقدُ عرضٌ يُقبَل ويُردّ. وصفحةٌ لا سبيلَ فيها إلّا التوقيع تُنتج توقيعا
   بلا رضا، وهو أسوأُ ما يُجمع في وثيقة. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { Panel, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { fmtDateLong } from '@/application/text/format-ar'
import { parseContractDoc } from '@/application/trainer/contract-sections'
import ContractDocument from '@/components/ContractDocument'

interface RequiredDoc { kind: string; labelAr: string; required: boolean }
interface UploadedDoc { id: string; kind: string; originalName: string }
interface Ack { key: string; textAr: string }

interface OpenView {
  state: 'open'
  contractId: string
  title: string
  trainerName: string
  trainerEmail: string
  bodyAr: string | null
  bodyVersion: string | null
  bodyHash: string | null
  expiresAt: string | null
  requiredDocuments: RequiredDoc[]
  uploaded: UploadedDoc[]
  acks: Ack[]
  consentTextAr: string
  consentVersion: string
}

type View =
  | OpenView
  | { state: 'signed'; title: string; signedAt: string | null; signerLegalName: string | null }
  | { state: 'declined'; title: string; declinedAt: string | null }
  | { state: 'amendment_requested'; title: string; requestedAt: string | null; requestAr: string | null }
  | { state: 'revoked'; title: string }
  | { state: 'expired'; title: string; expiredAt: string | null }

/** صيغُ الوثائق المقبولة — تطابق `IDENTITY_MIMES` في الخادم */
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export default function ContractSign() {
  const { token = '' } = useParams()
  const [view, setView] = useState<View | null>(null)
  const [err, setErr] = useState('')
  const [fatal, setFatal] = useState('')
  const [busy, setBusy] = useState(false)

  const [readToEnd, setReadToEnd] = useState(false)
  const [legalName, setLegalName] = useState('')
  const [addressAr, setAddressAr] = useState('')
  const [phone, setPhone] = useState('')
  const [acked, setAcked] = useState<Set<string>>(new Set())
  const [consented, setConsented] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [amending, setAmending] = useState(false)
  const [amendText, setAmendText] = useState('')
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      setView(await apiGet<View>(`/api/c/${encodeURIComponent(token)}`))
    } catch (e) {
      setFatal(e instanceof ApiError ? e.message : 'تعذّر فتحُ العقد')
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  /* يُقاس البلوغُ بالتمرير، ويُقاس كذلك عند أوّل رسم: نصٌّ قصيرٌ لا شريطَ له
     لا يُمرَّر أبدا — فلو انتُظر التمريرُ وحدَه لبقي الزرُّ مقفلا إلى الأبد. */
  const checkRead = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    if (el.scrollHeight - el.clientHeight <= 24) { setReadToEnd(true); return }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true)
  }, [])

  useEffect(() => {
    if (view?.state === 'open') checkRead()
  }, [view, checkRead])

  /* والبنيةُ تُشتقّ مرّةً لا في كلّ رسم: التمريرُ يُعيد الرسمَ مرارا،
     وتحليلُ ثلاثمئة سطرٍ في كلّ إطارٍ يُثقل صفحةً يجب أن تُقرأ بسلاسة. */
  const bodyAr = view?.state === 'open' ? view.bodyAr : null
  const doc = useMemo(() => (bodyAr ? parseContractDoc(bodyAr) : null), [bodyAr])

  if (fatal) {
    return (
      <Shell>
        <Panel tone="danger" className="p-5">
          <h1 className="mb-2 text-xl font-black">تعذّر فتحُ العقد</h1>
          <p>{fatal}</p>
          <p className="mt-2 text-sm opacity-80">
            إن كان الرابطُ قديما فاطلب من فريق الأكاديمية إعادةَ إرساله.
          </p>
        </Panel>
      </Shell>
    )
  }
  if (!view) return <Shell><p className="opacity-70">يُفتح العقد…</p></Shell>

  if (view.state !== 'open') {
    const HEAD: Record<string, string> = {
      signed: 'وُقّع هذا العقد',
      declined: 'اعتُذر عن هذا العقد',
      amendment_requested: 'طلبُك بالتعديل عندنا',
      revoked: 'أُلغي هذا العقد',
      expired: 'انقضى أجلُ هذا الرابط',
    }
    const BODY: Record<string, string> = {
      signed: 'سُجّل توقيعُك، ووصلتك نسختُك بالبريد. تراجعه الأكاديميّةُ ثمّ يُفتح حسابُك.',
      declined: 'سُجّل اعتذارُك ووصل فريقَنا. وإن كان ذلك سهوا فتواصل معنا.',
      amendment_requested: 'وصل طلبُك فريقَنا وننظر فيه. ويقف التوقيعُ حتّى نجيبك: '
        + 'فإمّا أعدنا إليك العرضَ مصحَّحا، وإمّا كتبنا لك لماذا يبقى البندُ كما هو. '
        + 'وفي الحالين يصلك منّا خبر.',
      revoked: 'سحبت الأكاديميّةُ هذا العقد. وإن كنتَ تنتظر عقدا فسيصلك غيرُه.',
      expired: 'لم يعد هذا الرابطُ صالحا. اطلب من فريق الأكاديمية إعادةَ إرساله وسيصلك رابطٌ جديد.',
    }
    return (
      <Shell>
        <Panel tone={view.state === 'signed' ? 'positive' : 'warn'} className="p-5">
          <h1 className="mb-2 text-xl font-black">{HEAD[view.state]}</h1>
          <p className="mb-1 opacity-80">{view.title}</p>
          <p>{BODY[view.state]}</p>
          {view.state === 'signed' && view.signedAt && (
            <p className="mt-2 text-sm opacity-70">
              وقّعه {view.signerLegalName} بتاريخ {fmtDateLong(view.signedAt)}.
            </p>
          )}
        </Panel>
      </Shell>
    )
  }

  const v = view
  const missingDocs = v.requiredDocuments
    .filter((d) => d.required && !v.uploaded.some((u) => u.kind === d.kind))
  const allAcked = v.acks.every((a) => acked.has(a.key))
  const canSign = readToEnd && allAcked && consented
    && legalName.trim().length >= 4
    && addressAr.trim().length >= 5 && phone.trim().length >= 6
    && missingDocs.length === 0

  const upload = async (doc: RequiredDoc, file: File) => {
    setBusy(true); setErr('')
    try {
      const { uploadUrl } = await apiPost<{ uploadUrl: string }>(
        `/api/c/${encodeURIComponent(token)}/documents`,
        { kind: doc.kind, originalName: file.name, mime: file.type, sizeBytes: file.size },
      )
      const res = await fetch(uploadUrl, {
        method: 'PUT', body: file, headers: { 'content-type': file.type },
      })
      if (!res.ok) throw new Error('upload')
      await load()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر رفعُ الملفّ — جرّبْ مرّةً أخرى')
    } finally { setBusy(false) }
  }

  const sign = async () => {
    setBusy(true); setErr('')
    try {
      await apiPost(`/api/c/${encodeURIComponent(token)}/sign`, {
        legalName: legalName.trim(), addressAr: addressAr.trim(), phone: phone.trim(),
        bodyHash: v.bodyHash, acks: [...acked],
      })
      await load()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر تسجيلُ التوقيع')
    } finally { setBusy(false) }
  }

  const requestAmendment = async () => {
    setBusy(true); setErr('')
    try {
      await apiPost(`/api/c/${encodeURIComponent(token)}/amend`, { textAr: amendText.trim() })
      await load()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر تسجيلُ طلبِ التعديل')
    } finally { setBusy(false) }
  }

  const decline = async () => {
    setBusy(true); setErr('')
    try {
      await apiPost(`/api/c/${encodeURIComponent(token)}/decline`, { reasonAr: declineReason.trim() })
      await load()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر تسجيلُ الاعتذار')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-black">{v.title}</h1>
      <p className="mb-5 opacity-75">
        باسم {v.trainerName} · {v.trainerEmail}
        {v.expiresAt && <> · صالحٌ حتّى {fmtDateLong(v.expiresAt)}</>}
      </p>

      {err && <Panel tone="danger" className="mb-4 p-3" role="alert">{err}</Panel>}

      {/* ═══ المتن ═══ */}
      <h2 className="mb-2 text-lg font-black">نصُّ الاتفاقية</h2>
      {/* والمُمَرَّرُ هو المقيسُ بلوغُ آخره: `checkRead` يقرأ `scrollHeight`
          من هذا العنصر بعينه، فلو عُلِّق على غيره لَانفتح التوقيعُ بلا قراءة. */}
      <div
        ref={bodyRef}
        onScroll={checkRead}
        tabIndex={0}
        dir="rtl"
        aria-label="نصُّ الاتفاقية — مرِّرْ إلى آخره"
        className="mb-2 max-h-[60vh] overflow-auto rounded-lg border border-white/10"
      >
        {doc
          ? <ContractDocument doc={doc} />
          : <p className="p-4 opacity-70">لا متنَ لهذا العقد.</p>}
      </div>
      <p className={`mb-6 ${readToEnd ? 'opacity-60' : 'font-bold'}`}>
        {readToEnd
          ? 'بلغتَ آخرَ النصّ — وما بعده خانةُ التوقيع.'
          : 'يُفتح التوقيعُ حين تبلغ آخرَ النصّ. اقرأه كاملا، فهو ما ستلتزم به.'}
      </p>

      {/* ═══ الوثائق ═══ */}
      {v.requiredDocuments.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-black">الوثائقُ المطلوبة</h2>
          <ul className="space-y-3">
            {v.requiredDocuments.map((d) => {
              const up = v.uploaded.find((u) => u.kind === d.kind)
              return (
                <li key={d.kind}>
                  <Inset className="p-3">
                    <div className="mb-1 font-bold">
                      {d.labelAr}{!d.required && <span className="opacity-60"> (اختيارية)</span>}
                    </div>
                    {up
                      ? <p className="text-emerald-300">رُفعت: {up.originalName} — ولك أن ترفع غيرَها فتحلّ محلَّها.</p>
                      : <p className="opacity-70">لم تُرفَع بعد.</p>}
                    <label className="mt-2 block">
                      <span className="sr-only">ارفعْ {d.labelAr}</span>
                      <input
                        type="file" accept={ACCEPT} disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void upload(d, f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Inset>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 opacity-70">الصيغُ المقبولة: JPEG أو PNG أو WebP أو PDF، وحتّى 4 ميغابايت.</p>
        </section>
      )}

      {/* ═══ الإقرارات ═══ */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-black">إقرارات</h2>
        <ul className="space-y-3">
          {v.acks.map((a) => (
            <li key={a.key}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox" className="mt-1" checked={acked.has(a.key)}
                  onChange={() => setAcked((s) => {
                    const n = new Set(s)
                    if (n.has(a.key)) n.delete(a.key); else n.add(a.key)
                    return n
                  })}
                />
                <span>{a.textAr}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══ التوقيع ═══ */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-black">التوقيع</h2>
        <label className="mb-1 block font-bold" htmlFor="legal-name">
          اسمُك القانونيُّ كاملا، كما في وثيقة هويّتك
        </label>
        <input
          id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-white/15 bg-black/20 p-3"
          placeholder="الاسم الأول واسم الأب واسم العائلة"
        />

        {/* ═══ وعنوانُه وهاتفُه بخطّه ═══

            ولا يُملآن من نموذج تقديمه: ذاك بياناتُ ترشُّحٍ تُملأ على عجل وقد
            تمضي شهورٌ قبل العقد، وهذه بياناتُ طرفٍ في عقدٍ يُراسَل بها. */}
        <label className="mb-1 block font-bold" htmlFor="signer-address">
          عنوانُك الكامل
        </label>
        <input
          id="signer-address" value={addressAr} onChange={(e) => setAddressAr(e.target.value)}
          className="mb-1 w-full rounded-lg border border-white/15 bg-black/20 p-3"
          placeholder="المدينة، والحيّ أو الشارع، ورقمُ البناية"
        />
        <p className="mb-3 text-sm opacity-70">
          كما تريده مثبَّتا في العقد — ولا يُنقل من نموذج تقديمك.
        </p>

        <label className="mb-1 block font-bold" htmlFor="signer-phone">
          رقمُ هاتفك
        </label>
        <input
          id="signer-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
          inputMode="tel" dir="ltr"
          className="mb-3 w-full rounded-lg border border-white/15 bg-black/20 p-3 text-right"
          placeholder="+962 7X XXX XXXX"
        />

        <label className="mb-4 flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={consented}
            onChange={(e) => setConsented(e.target.checked)} />
          <span>{v.consentTextAr}</span>
        </label>

        {!canSign && (
          <p className="mb-3 opacity-75">
            يبقى: {[
              !readToEnd && 'قراءةُ النصّ إلى آخره',
              legalName.trim().length < 4 && 'اسمُك القانونيّ',
              addressAr.trim().length < 5 && 'عنوانُك',
              phone.trim().length < 6 && 'رقمُ هاتفك',
              missingDocs.length > 0 && `رفعُ ${missingDocs.map((d) => d.labelAr).join(' و')}`,
              !allAcked && 'الإقراراتُ كلُّها',
              !consented && 'الموافقةُ على التوقيع الإلكترونيّ',
            ].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button tone="confirm" size="lg" disabled={!canSign} loading={busy} onClick={() => void sign()}>
            وقّعِ الاتفاقية
          </Button>
          {!amending && !declining && (
            <Button tone="ghost" onClick={() => setAmending(true)}>
              أطلبُ تعديلا
            </Button>
          )}
          {!declining && !amending && (
            <Button tone="ghost" onClick={() => setDeclining(true)}>
              أعتذرُ عن التوقيع
            </Button>
          )}
        </div>
      </section>

      {amending && (
        <Panel tone="warn" className="p-4">
          <h2 className="mb-1 text-lg font-black">طلبُ تعديلٍ على العرض</h2>
          <p className="mb-3">
            والعقدُ عرضٌ يُفاوَض. اكتبْ ما تريد تغييرَه بندا بندا — رقمَ البند
            وما تقترحه فيه — فيقف التوقيعُ ويصل طلبُك فريقَنا. ولا يُلغى عرضُك
            بهذا: إمّا أعدناه إليك مصحَّحا، وإمّا كتبنا لك لماذا يبقى كما هو.
          </p>
          <label className="sr-only" htmlFor="amend-text">ما تريد تعديلَه</label>
          <textarea
            id="amend-text" rows={5} value={amendText}
            onChange={(e) => setAmendText(e.target.value)}
            placeholder="مثال: البند ٤-١ — أقترح أن يكون سعرُ المقعد عبر رابطي…"
            className="mb-3 w-full rounded-lg border border-white/15 bg-black/20 p-3"
          />
          <div className="flex flex-wrap gap-2">
            <Button tone="confirm" disabled={amendText.trim().length < 5} loading={busy}
              onClick={() => void requestAmendment()}>
              أرسلْ طلبَ التعديل
            </Button>
            <Button tone="ghost" onClick={() => { setAmending(false); setAmendText('') }}>
              تراجعْ
            </Button>
          </div>
        </Panel>
      )}

      {declining && (
        <Panel tone="warn" className="p-4">
          <h2 className="mb-1 text-lg font-black">الاعتذارُ عن العقد</h2>
          <p className="mb-3">
            لا حرجَ عليك — والعقدُ عرضٌ يُقبَل ويُردّ. واكتبْ سببَك في سطر، فهو
            يساعدنا أن نفهم ونُحسِن العرضَ لمن بعدك.
          </p>
          <label className="sr-only" htmlFor="decline-reason">سببُ الاعتذار</label>
          <textarea
            id="decline-reason" rows={3} value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="mb-3 w-full rounded-lg border border-white/15 bg-black/20 p-3"
          />
          <div className="flex flex-wrap gap-2">
            <Button tone="danger" disabled={declineReason.trim().length < 5} loading={busy}
              onClick={() => void decline()}>
              سجّلِ اعتذاري
            </Button>
            <Button tone="ghost" onClick={() => { setDeclining(false); setDeclineReason('') }}>
              تراجعْ
            </Button>
          </div>
        </Panel>
      )}
    </Shell>
  )
}

/** إطارٌ بسيط — والصفحةُ عامّةٌ بلا بوّابةٍ ولا قائمة */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-3xl px-4 py-10">
      {children}
    </main>
  )
}
