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
import { Link, useParams } from 'react-router'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { Panel, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { fmtDateLong, fmtDateWith } from '@/application/text/format-ar'
import { parseContractDoc, type ContractDoc } from '@/application/trainer/contract-sections'
import { contractHasBodyAr } from '@/application/trainer/contract-body'
import { ACADEMY_ZONE } from '@/application/trainer/cohort-period'
import {
  SIGNED_COPY_STATES, type ContractClosedState, type ContractClosedView,
} from '@/application/trainer/contract-link-state'
import ContractDocument from '@/components/ContractDocument'

interface RequiredDoc { kind: string; labelAr: string; required: boolean }
interface UploadedDoc { id: string; kind: string; originalName: string }
interface Ack { key: string; textAr: string }

interface OpenView {
  state: 'open'
  contractId: string
  /** رقمُ العقد — `WJ-CT-…` */
  number: string
  title: string
  trainerName: string
  trainerEmail: string
  bodyAr: string | null
  bodyVersion: string | null
  bodyHash: string | null
  /** حُدّث نصُّه تحته بعد إرساله — فيُقال له سطرا واحدا (لا قائمة) */
  bodyUpdated: boolean
  expiresAt: string | null
  requiredDocuments: RequiredDoc[]
  uploaded: UploadedDoc[]
  acks: Ack[]
  consentTextAr: string
  consentVersion: string
}

/* وما لا يُوقَّع منه حالٌ واحدةٌ من قائمةٍ مسمّاة، شكلُها في
   `contract-link-state.ts` يقرؤه الخادمُ وهذه الصفحةُ معا */
type View = OpenView | ContractClosedView

/** صيغُ الوثائق المقبولة — تطابق `IDENTITY_MIMES` في الخادم */
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export default function ContractSign() {
  const { token = '' } = useParams()
  const [view, setView] = useState<View | null>(null)
  const [err, setErr] = useState('')
  const [fatal, setFatal] = useState<{ code: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [readToEnd, setReadToEnd] = useState(false)
  /* والسؤالُ من موضع الخادم نفسِه: شاشةٌ تسأل سؤالا آخرَ تَعِد بما يُردّ */
  const hasBody = contractHasBodyAr(
    view?.state === 'open' ? view.bodyAr : null,
  )
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
      /* ═══ والرابطُ المنتهي ليس عطبا (٢٦ سبتمبر ٢٠٢٦) ═══

         الرمزُ يموت بالتوقيع وبالاعتذار وبالإلغاء — قصدا، فبابٌ حيٌّ على
         وثيقةٍ تحمل اسمَ إنسانٍ وأتعابَه يبقى مفتوحا لمن وصله الرابطُ يوما.
         ومن فتحه بعد ذلك كان يُقرأ عليه لوحٌ أحمرُ: «تعذّر فتحُ العقد».

         وهو يقول لمن وقّع أمسِ إنّ شيئا خرب، لا إنّ بابا أُغلق بعد أن أدّى
         عملَه. فيُفرَّق بينهما: المنتهي لوحُ تنبيهٍ يقول ما جرى وأين نسختُه،
         وما عداه يبقى أحمر. */
      setFatal(e instanceof ApiError
        ? { code: e.code, text: e.message }
        : { code: 'unknown', text: 'تعذّر فتحُ العقد' })
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  /* يُقاس البلوغُ بالتمرير، ويُقاس كذلك عند أوّل رسم: نصٌّ قصيرٌ لا شريطَ له
     لا يُمرَّر أبدا — فلو انتُظر التمريرُ وحدَه لبقي الزرُّ مقفلا إلى الأبد.

     ═══ وبينَ «قصيرٍ» و«معدومٍ» فرقٌ كان يضيع ═══

     العقدُ بلا متنٍ لا شريطَ له كذلك، فكان يُرضي الشرطَ الأوّلَ ويُفتح
     التوقيعُ على صفحةٍ فيها «لا متنَ لهذا العقد». وبوّابةٌ حارسُها أنّه
     «قرأ إلى آخره» تُفتَح على لا شيء ليست بوّابة.

     فيُسأل عن وجود المتن أوّلا. والخادمُ يردّ التوقيعَ في الحالَين، وهذه
     الشاشةُ لا تَعِد بما سيُردّ. */
  const checkRead = useCallback(() => {
    const el = bodyRef.current
    if (!el || !hasBody) return
    if (el.scrollHeight - el.clientHeight <= 24) { setReadToEnd(true); return }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true)
  }, [hasBody])

  useEffect(() => {
    if (view?.state === 'open') checkRead()
  }, [view, checkRead])

  /* ═══ وما يُقال بعد الفعل يُرى أوّلا (١ أكتوبر ٢٠٢٦) ═══

     التوقيعُ والاعتذارُ يُضغطان من أسفل صفحةٍ طويلة، ثمّ تُستبدَل الصفحةُ بلوحٍ
     قصيرٍ في رأسها — والنافذةُ باقيةٌ حيث كان الإصبع. فيُقرأ ما تحت اللوح أو
     لا شيء، ويُظنّ أنّ الفعلَ لم يقع. فإذا خرجت الحالُ من `open` رُفعت النافذةُ
     إلى رأسها. */
  const wasOpen = useRef(false)
  useEffect(() => {
    if (view?.state === 'open') { wasOpen.current = true; return }
    if (view && wasOpen.current) { wasOpen.current = false; window.scrollTo({ top: 0 }) }
  }, [view])

  /* والبنيةُ تُشتقّ مرّةً لا في كلّ رسم: التمريرُ يُعيد الرسمَ مرارا،
     وتحليلُ ثلاثمئة سطرٍ في كلّ إطارٍ يُثقل صفحةً يجب أن تُقرأ بسلاسة. */
  const bodyAr = view?.state === 'open' || (view && SIGNED_COPY_STATES.includes(view.state)) ? view.bodyAr : null
  const doc = useMemo(() => (bodyAr ? parseContractDoc(bodyAr) : null), [bodyAr])

  if (fatal) {
    const spent = fatal.code === 'invalid_token'
    return (
      <Shell>
        <Panel tone={spent ? 'warn' : 'danger'} className="p-5">
          <h1 className="mb-2 text-xl font-black">
            {spent ? 'انتهى هذا الرابط' : 'تعذّر فتحُ العقد'}
          </h1>
          {spent
            ? (
              <>
                {/* ═══ ويُقال سببُه لا سببٌ غيرُه (٢٩ سبتمبر ٢٠٢٦) ═══

                    كان هنا: «رابطُ التوقيع يُفتح مرّةً واحدة، ثمّ يُغلَق».
                    وهو غيرُ واقع: الرابطُ يُفتح ما شاء صاحبُه —
                    و`firstOpenedAt` و`lastOpenedAt` عمودانِ لا معنى لهما لو
                    فُتح مرّةً. وصار الموقِّعُ يقرأ منه نسختَه كذلك، فبقيت
                    الجملةُ تعتذر عن حمايةٍ لا تقع عن بابٍ لم يُغلَق.

                    وما يُسقط الرمزَ حقّا ثلاثة: اعتذارٌ، وسحبٌ، وعقدٌ أحدثُ
                    يُبطل ما قبله. فتُقال هي — إذ من يقف أمام بابٍ مغلقٍ
                    يحتاج أن يعرف أيَّ بابٍ هو. */}
                {/* ═══ وصار هذا اللوحُ لما لا يُعرَف وحدَه (١ أكتوبر ٢٠٢٦) ═══

                    كلُّ رابطٍ يُصرف يُحفَظ اليوم، فيقول القديمُ حالَ عقده بالاسم
                    (`ClosedDoor`). فلا يبلغ هذا اللوحَ إلّا حرفٌ سقط في النسخ، أو
                    رابطٌ صُرف قبل أن تُحفَظ الروابط — فتُقال احتمالاتُه، ويُدَلّ
                    على البابين اللذين يجيبانه بيقين. */}
                <p>
                  لا نعرف هذا الرابط: لعلّ حرفا منه سقط في النسخ، أو يكون رابطا
                  قديما — اعتُذر عن عقده، أو سحبته الأكاديميّة، أو أرسلنا إليك
                  بعده أحدثَ منه فبطل.
                </p>
                <p className="mt-2">
                  فإن كان لك عرضٌ ينتظر توقيعك فاطلب رابطه ببريدك. وإن كنتَ وقّعتَ
                  واعتمدنا توقيعَك فعقدُك في «عقدي» في بوّابتك.
                </p>
                {/* ولا ذهبيَّ هنا: الذهبيُّ فعلُ الصفحة، وهذان فعلا لوحٍ يدلّان على
                    بابٍ آخر — فالمُثبِتُ لما يُرجَّح، والعاديُّ لأخيه
                    (`one-primary-per-screen.test.ts`) */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button as={Link} to="/contract-link" tone="confirm" size="sm">اطلبْ رابطَ عرضك ببريدك</Button>
                  <Button as={Link} to="/trainer/contract" size="sm">افتح «عقدي»</Button>
                </div>
              </>
            )
            : (
              <>
                <p>{fatal.text}</p>
                <p className="mt-2 text-sm opacity-80">
                  إن كان الرابطُ قديما فاطلب من فريق الأكاديمية إعادةَ إرساله.
                </p>
              </>
            )}
        </Panel>
      </Shell>
    )
  }
  if (!view) return <Shell><p className="opacity-70">يُفتح العقد…</p></Shell>

  if (view.state !== 'open') return <Shell><ClosedDoor view={view} doc={doc} /></Shell>

  const v = view
  const missingDocs = v.requiredDocuments
    .filter((d) => d.required && !v.uploaded.some((u) => u.kind === d.kind))
  const allAcked = v.acks.every((a) => acked.has(a.key))
  const canSign = hasBody && readToEnd && allAcked && consented
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

  /* ═══ وما أغلق البابَ خلفه لا يطرقه ثانيةً (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «بعد أن يوقّع المدرّب العقد تظهر له صفحة "تعذّر فتحُ
     العقد" بالرغم أنّه يظهر لنا أنّه قام بالتوقيع».

     وعلّتُه أنّ هذَين الفعلَين يميتان الرمزَ في الخادم — التوقيعُ والاعتذارُ
     كلاهما يكتب `tokenHash: null` — ثمّ كانت الشاشةُ تستدعي `load()` بالرمز
     الميّت، فيُردّ ٤٠٤ فيُرسَم لوحٌ أحمرُ فوق فعلٍ **نجح**. فيظنّ الموقِّعُ
     أنّ توقيعَه ضاع، ويوقّع ثانيةً أو يراسلنا.

     والجوابُ أنّ جوابَ الفعل هو الحقيقة: الخادمُ ردّ «تمّ» ومعه تاريخُه،
     فتُبنى منه الحالُ ولا يُسأل بابٌ أغلقناه نحن. وطلبُ التعديل ليس منهما —
     رمزُه يبقى حيّا لأنّ العقدَ ينتظر جوابَنا — فيبقى على `load()` وتُقرأ
     حالُه من الخادم. */
  const sign = async () => {
    setBusy(true); setErr('')
    try {
      const r = await apiPost<{ signedAt: string }>(`/api/c/${encodeURIComponent(token)}/sign`, {
        legalName: legalName.trim(), addressAr: addressAr.trim(), phone: phone.trim(),
        bodyHash: v.bodyHash, acks: [...acked],
      })
      setView({
        ...closedBase(v),
        state: 'signed',
        signedAt: r.signedAt, signerLegalName: legalName.trim(),
        /* والمتنُ يُنقل معه: لولاه لرأى من وقّع لوحا بلا وثيقةٍ حتّى يُحدّث
           الصفحة، وهو ما يردّه الخادمُ من الرابط نفسِه. */
        bodyAr: v.bodyAr, bodyHash: v.bodyHash,
      })
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
      const r = await apiPost<{ declinedAt: string }>(
        `/api/c/${encodeURIComponent(token)}/decline`, { reasonAr: declineReason.trim() },
      )
      setView({ ...closedBase(v), state: 'declined', declinedAt: r.declinedAt })
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر تسجيلُ الاعتذار')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-black">{v.title}</h1>
      {/* ورقمُه أوّلَ ما يُقرأ — به يُسأل عنه بعد التوقيع (١ أكتوبر ٢٠٢٦) */}
      <p className="mb-1 text-sm font-bold">رقم العقد: <span dir="ltr">{v.number}</span></p>
      <p className="mb-5 opacity-75">
        باسم {v.trainerName} · {v.trainerEmail}
        {v.expiresAt && <> · صالحٌ حتّى {fmtDateLong(v.expiresAt)}</>}
      </p>

      {err && <Panel tone="danger" className="mb-4 p-3" role="alert">{err}</Panel>}

      {/* ═══ ولا قائمةَ تحديثٍ فوق النصّ — قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) ═══

          كان هنا شريطُ «حُدّث هذا العرضُ بتاريخ…» ونقاطُ ما تغيّر (٣٠ سبتمبر).
          ونزعه صاحبُ المنصّة: «no need for the update list on the top of the
          contract, because they have received an email with these changes».
          فما تغيّر يحمله البريدُ وحدَه إن اختير، وما يحمي التوقيعَ باقٍ بلا
          الشريط: القراءةُ إلى آخر النصّ شرطٌ (`canSign`)، وحارسُ `body_changed`
          في الخادم. والعلّةُ كاملةً عند `contractByToken`.

          ثمّ طلب في اليوم نفسِه سطرا واحدا بلا قائمة: «فقط ابلغهم رساله بالاعلى
          يرجى اعاده قراءته… اختر جمله اقصر». ولا يقول «تغيّرت الصياغة»: في
          التحديث ما يغيّر المعنى والمال، وعلّتُه هناك أيضا. */}
      {v.bodyUpdated && (
        <Panel tone="warn" className="mb-4 p-3 font-bold" role="note">
          حُدّث نصُّ هذا العرض — اقرأه كاملا قبل أن توقّعه.
        </Panel>
      )}

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
          : (
            <p className="p-4 font-bold">
              لا متنَ لهذا العقد، فلا يُوقَّع.
              <span className="block font-normal opacity-80">
                راسلِ الأكاديميةَ ليُرسَل إليك عقدٌ بمتنه.
              </span>
            </p>
          )}
      </div>
      <p className={`mb-6 ${readToEnd && hasBody ? 'opacity-60' : 'font-bold'}`}>
        {!hasBody
          ? 'لا نصَّ يُقرأ هنا، ولن يُفتح التوقيع.'
          : readToEnd
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
          className="mb-2 w-full rounded-lg border border-white/15 bg-black/20 p-3"
          placeholder="الاسم الأول واسم الأب واسم العائلة"
        />
        {/* ═══ ولا زرَّ تصحيحٍ بعدُ — قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) ═══

            كان في الصفحة زرٌّ رابع: «اسمي في هويّتي غيرُ هذا». ومسلكُه كان
            يوقف التوقيعَ بالحالة نفسِها التي يقف بها **طلبُ تعديلٍ على بند**
            (`amendment_requested`)، فيُرسَم للمدرّب لوحُ «طلبُك بالتعديل
            عندنا… ويقف التوقيعُ حتّى نجيبك». ووقع ذلك لمدرّبٍ حقيقيّ: صحّح
            اسمَه فوقف عقدُه وظنّ أنّه اعترض على بند.

            وقولُ صاحب المنصّة: «التصحيحُ إجراءٌ داخليٌّ لعقده وليس توقيعا»،
            و«لا داعيَ للزرّ أصلا: قبل التوقيع يضع المدرّبُ اسمَه القانونيَّ
            فنطابقه ويتغيّر اسمُه في العقد تلقائيا».

            وهذه الخانةُ تفعل ذلك بعينه: ما يُكتب فيها هو ما يُثبَّت طرفا
            ثانيا (`signerLegalName`)، لا ما وصلنا من حسابه. فالزرُّ كان بابا
            ثانيا إلى بابٍ مفتوح — وبابان إلى غرفةٍ واحدة يضلّ بينهما الداخل.

            وبقي منه ما هو نافع: **التنبيهُ** أن يتأكّد قبل أن يكتب. */}
        <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
          تأكّدْ أنّ ما تكتبه هنا هو اسمُك بالحرف كما يظهر في <b>هويّتك أو جواز
          سفرك</b> — فهو الاسمُ الذي يُثبَّت في العقد طرفا ثانيا، ونطابقه بوثيقتك
          قبل أن نعتمد توقيعَك. واختلافُه عمّا فيها يؤخّر اعتمادَك.
        </p>

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
              !hasBody && 'نصُّ العقد — ولا يُوقَّع عقدٌ بلا نصّ',
              hasBody && !readToEnd && 'قراءةُ النصّ إلى آخره',
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
/** حالٌ مغلقةٌ تُبنى من المفتوح بعد فعلٍ نجح فيها — وما لا يخصّها فارغ */
function closedBase(v: OpenView): Omit<ContractClosedView, 'state'> {
  return {
    number: v.number, title: v.title, newerLinkAt: null, detailed: true,
    signedAt: null, signerLegalName: null, countersignedAt: null, supersededAt: null,
    terminatedAt: null, declinedAt: null, revokedAt: null, revokedForResign: false,
    requestedAt: null, requestAr: null, expiredAt: null, afterFinalReminder: false,
    successor: null, bodyAr: null, bodyHash: null,
  }
}

/* ═══ كلُّ بابٍ مغلقٍ يقول أيُّ بابٍ هو — برقم عقده وتواريخه (١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «when someone has expired link, they know the exact
   reason whether expired or signed… for the signed ones, they should still
   see the contract locked for reading».

   فلكلّ حالٍ من `CONTRACT_CLOSED_STATES` رأسٌ وجملةٌ هنا، ويقابلهما الحارسُ
   بالقائمة نفسِها (`contract-link-states-page.test.ts`) — فحالٌ يضيفها الخادمُ
   بلا جملةٍ هنا تُسقطه. والجملةُ تقول ما وقع ومتى، ورقمَ العقد، وما يفعله
   الواقفُ الآن إن كان له ما يفعله: رابطٌ يطلبه ببريده، أو عقدُه في بوّابته.

   ونسختُه تحت اللوح لا داخلَه — رأسُ `Surface.tsx`: «وتفصيلٌ داخله لا يحتاج
   إطارا ثالثا»، ونغمةُ اللوح تصبغ أرضيّتَه، والوثيقةُ تُقرأ على سطحٍ محايد.
   ومقفلةً: لا خانةَ ولا زرَّ توقيع. والخادمُ لا يحملها إلّا لعقدٍ وُقّع. */
const CLOSED_HEAD: Record<ContractClosedState, string> = {
  expired: 'انقضى أجلُ هذا العرض',
  replaced: 'أرسلنا إليك رابطا أحدثَ من هذا',
  signed: 'وُقّع هذا العقد',
  countersigned: 'هذا عقدُك النافذ',
  superseded: 'حلّ محلَّ هذا العقد عقدٌ أحدث',
  terminated: 'انتهى هذا العقد',
  declined: 'اعتُذر عن هذا العقد',
  revoked: 'أُلغي هذا العقد',
  amendment_requested: 'طلبُك بالتعديل عندنا',
}

/** رأسُ اللوح — والإلغاءُ بعد التوقيع غيرُ الإلغاء قبله */
function closedHeadAr(v: ContractClosedView): string {
  if (v.state === 'revoked' && v.revokedForResign) return 'أُعيد إليك هذا العقدُ على نصٍّ محدَّث'
  if (v.state === 'revoked' && v.signedAt) return 'لم يُعتمَد توقيعُك على هذا العقد'
  return CLOSED_HEAD[v.state]
}

/** يومٌ وساعةٌ بتوقيت عمّان — لأجلٍ يُحسب بالساعة لا باليوم */
function atAmmanAr(d: string | null): string {
  if (!d) return ''
  return `${fmtDateWith(d, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE,
  })} بتوقيت عمّان`
}

/** ما وقع ومتى — جملةٌ أو اثنتان لكلّ حال */
function closedLinesAr(v: ContractClosedView): string[] {
  const on = (d: string | null) => (d ? fmtDateLong(d) : '—')
  const next = v.successor
    ? `العقدَ رقم ${v.successor.number}${v.successor.sentAt ? ` في ${on(v.successor.sentAt)}` : ''}`
    : null
  switch (v.state) {
    case 'expired':
      return v.afterFinalReminder
        ? [
          `انقضت مهلةُ توقيعه ${atAmmanAr(v.expiredAt)} بعد التذكير الأخير به، فسقط العرضُ ولم يعد يُوقَّع.`,
          'فإن كنتَ ما زلتَ تريده فراسِلْ فريقَ الأكاديمية — ولها أن تجدّد العرضَ ورابطَه بإخطارٍ جديد.',
        ]
        : [
          `انقضى أجلُ هذا الرابط ${atAmmanAr(v.expiredAt)}، والعرضُ ما زال عندنا.`,
          'اطلبْ رابطا جديدا ببريدك من الزرّ أدناه، فيصلك في دقائق.',
        ]
    case 'replaced':
      return [
        `أرسلنا إليك رابطا أحدثَ لهذا العرض${v.newerLinkAt ? ` في ${on(v.newerLinkAt)}` : ''}، فلم يعد يُوقَّع من هذا.`,
        'افتح أحدثَ رسالةٍ منّا، أو اطلب رابطك ببريدك من الزرّ أدناه.',
      ]
    case 'signed':
      return [
        `وقّعتَه${v.signerLegalName ? ` باسم ${v.signerLegalName}` : ''} في ${on(v.signedAt)}، وتوقيعُك محفوظٌ عندنا.`,
        'نراجعه ونطابق اسمَك بوثيقة هويّتك ثمّ نعتمده، فيصير نافذا وتُفتح لك بوّابتُك.',
      ]
    case 'countersigned':
      return [
        `وقّعتَه في ${on(v.signedAt)}، واعتمدته الأكاديميّةُ في ${on(v.countersignedAt)} — فهو نافذٌ بين الطرفين.`,
        'وتجده كذلك في «عقدي» في بوّابتك.',
      ]
    case 'superseded':
      return [
        `كان نافذا منذ ${on(v.countersignedAt)}، ثمّ حلّ محلَّه ${next ?? 'عقدٌ أحدث'} — في ${on(v.supersededAt)}. وهو المعتمَدُ اليوم، وتجده في «عقدي».`,
      ]
    case 'terminated':
      return [
        `كان نافذا منذ ${on(v.countersignedAt)}، وانتهى في ${on(v.terminatedAt)}. فلا يُلزم بعده، وما وقع قبله باقٍ على حاله.`,
      ]
    case 'declined':
      return [`اعتذرتَ عنه في ${on(v.declinedAt)}، ووصل اعتذارُك فريقَنا. وإن كان ذلك سهوا فراسِلْنا.`]
    case 'revoked':
      if (v.revokedForResign) {
        return [
          `وقّعتَه في ${on(v.signedAt)}، ثمّ أعدناه إليك للتوقيع على نصٍّ محدَّث في ${on(v.revokedAt)} — فلا يُلزم أحدا.`,
          next ? `والذي يُوقَّع الآن ${next}، ورابطُه في رسالتنا.` : 'ورابطُ النصّ المحدَّث في رسالتنا الأخيرة.',
        ]
      }
      if (v.signedAt) {
        return [
          `وقّعتَه في ${on(v.signedAt)}، ولم نستطع اعتمادَ توقيعك في ${on(v.revokedAt)} — ووصلك سببُه بالبريد.`,
          next ? `وأرسلنا إليك بعده ${next}.` : 'ويصلك منّا عقدٌ مصحَّح.',
        ]
      }
      return [
        `سحبته الأكاديميّةُ في ${on(v.revokedAt)}، ووصلك سببُه بالبريد.`,
        next ? `وأرسلنا إليك بعده ${next} — وهو المعتمَد.` : 'وإن كنتَ تنتظر عقدا فسيصلك خبرُنا.',
      ]
    case 'amendment_requested':
      return [
        'وصل طلبُك فريقَنا وننظر فيه. ويقف التوقيعُ حتّى نجيبك: فإمّا أعدنا إليك العرضَ مصحَّحا، '
          + 'وإمّا كتبنا لك لماذا يبقى البندُ كما هو. وفي الحالين يصلك منّا خبر.',
      ]
  }
}

function ClosedDoor({ view, doc }: { view: ContractClosedView; doc: ContractDoc | null }) {
  const tone = view.state === 'signed' || view.state === 'countersigned'
    ? 'positive'
    : view.state === 'superseded' || view.state === 'terminated' ? 'default' : 'warn'
  /* والبابُ الذي يجيبه: رابطٌ جديدٌ لعرضٍ قائم — إلّا ما سقط بعد التذكير
     الأخير، فذاك لا يُطلب رابطُه (`requestContractLink`) — وعقدُه في بوّابته
     لما نفذ أو حلّ محلَّه غيرُه */
  const askLink = view.state === 'replaced' || (view.state === 'expired' && !view.afterFinalReminder)
  const portal = view.state === 'countersigned' || view.state === 'superseded'
  const copy = SIGNED_COPY_STATES.includes(view.state) && doc
  return (
    <>
      <Panel tone={tone} className="p-5">
        <h1 className="mb-2 text-xl font-black">{closedHeadAr(view)}</h1>
        <p className="mb-1 opacity-80">{view.title}</p>
        <p className="mb-3 text-sm font-bold">رقم العقد: <span dir="ltr">{view.number}</span></p>
        {view.newerLinkAt && view.state !== 'replaced' && (
          <p className="mb-2 text-sm opacity-80">
            وهذا رابطٌ قديم — أرسلنا إليك بعده رابطا أحدثَ في {fmtDateLong(view.newerLinkAt)}.
          </p>
        )}
        {closedLinesAr(view).map((line) => <p key={line} className="mt-1">{line}</p>)}
        {!view.detailed && view.signedAt && (
          <p className="mt-2 text-sm opacity-80">
            ولا تُعرَض نسختُه على هذا الرابط: أُرسل إلى بريدٍ غيرِ الذي يُراسَل به العقدُ اليوم.
          </p>
        )}
        {(askLink || portal) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {askLink && <Button as={Link} to="/contract-link" tone="confirm" size="sm">اطلبْ رابطا جديدا ببريدك</Button>}
            {portal && <Button as={Link} to="/trainer/contract" tone="confirm" size="sm">افتح «عقدي» في بوّابتك</Button>}
          </div>
        )}
      </Panel>
      {copy && (
        <div
          dir="rtl"
          tabIndex={0}
          aria-label="نصُّ الاتفاقية التي وقّعتَها — للقراءة"
          className="mt-4 max-h-[70vh] overflow-auto rounded-lg border border-white/10"
        >
          <ContractDocument doc={doc} />
        </div>
      )}
    </>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-3xl px-4 py-10">
      {children}
    </main>
  )
}
