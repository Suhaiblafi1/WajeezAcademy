/* روابطُ سجلِّ المتقدّم — تُنشأ باسمٍ، وتُجدَّد، وتُلغى.

   ═══ لماذا لا يُعرض الرمزُ ثانيةً ═══

   لا يُحفظ الرمزُ في القاعدة بل هاشُه، فلا سبيلَ إلى إظهاره ثانيةً ولو أردنا.
   وهو المقصود: من حاز الرابطَ فهو القارئُ المسمّى فيه، وسجلٌّ يُخرج رموزَه
   لمن فتح الشاشةَ ليس سجلّا محروسا.

   ═══ ولذلك «جدّده» لا «أنشئ غيرَه» (١٤ سبتمبر ٢٠٢٦) ═══

   كان يُقال هنا: «من أضاعه أنشأ غيرَه وألغى الأوّل». وهو يعمل، لكنّه يترك
   **صفَّين لقارئٍ واحد** — ويقسم تقييمَه بينهما، إذ يُعلَّق التقييمُ
   بمعرّف الصفّ لا بالرمز.

   فقال صاحبُ المنصّة: «أريد أن أتمكّن من إعادة نسخِ الرابط للمفعَّلين بدلا
   من إنشاء جديد». فصار التجديدُ يُبدّل الرمزَ على الصفّ نفسِه: يبقى الاسمُ
   وتقييمُه وسجلُّ فتحه، ويُجدَّد الأجل، **ويموت القديمُ في اللحظة**.

   والملغى لا يُجدَّد: الإلغاءُ قرارٌ لا يُلتفّ حوله بزرّ. */

import { useCallback, useEffect, useState } from 'react'
import { Link2, Copy, Ban, Check, RefreshCw } from 'lucide-react'
import { apiGet, apiPost, apiDelete, ApiError } from '@/services/api'
import { toast, toastError } from '@/components/Toast'
import { fmtDateTime } from '@/application/text/format-ar'
import { dossierLinkState } from '@/application/trainer/dossier-link-state'
import { Panel, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { staffControlCls } from '@/components/FormKit'

interface LinkRow {
  id: string
  reviewerName: string
  reviewerEmail: string | null
  expiresAt: string
  revokedAt: string | null
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  createdAt: string
  /* عنوانٌ جاهزٌ للنسخ — `null` لملغىً أو منتهٍ، ولروابطَ أُنشئت قبل حفظ
     الرمز (١٤ سبتمبر ٢٠٢٦) فلا رمزَ لها يُستخرج. وتلك تُجدَّد لا تُنسَخ. */
  copyUrl: string | null
}

export default function ReviewerLinks({ applicationId }: { applicationId: string }) {
  const [rows, setRows] = useState<LinkRow[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  /* بريدُ القارئ — وبه وحدَه يصير الإرسالُ ممكنا. والرمزُ لا يُحفظ، فهذه
     اللحظةُ هي الوحيدةُ التي يُعرف فيها الرابط: من أراد إرسالَه بعدها
     أنشأ رابطا جديدا. */
  const [email, setEmail] = useState('')
  const [send, setSend] = useState(false)
  /* الرمزُ الطازجُ — يُعرض حتّى يُنسَخ، ثمّ لا يعود أبدا */
  const [fresh, setFresh] = useState<{ url: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<LinkRow[]>(`/api/admin/trainer-applications/${applicationId}/dossier-links`))
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر جلبُ الروابط')
    }
  }, [applicationId])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (name.trim().length < 2) return
    setBusy(true)
    try {
      const r = await apiPost<{ url: string; emailDelivery: string | null }>(
        `/api/admin/trainer-applications/${applicationId}/dossier-links`,
        {
          reviewerName: name.trim(),
          ...(email.trim() ? { reviewerEmail: email.trim() } : {}),
          ...(send && email.trim() ? { sendEmail: true } : {}),
        },
      )
      setFresh({ url: r.url, name: name.trim() })
      setCopied(false)
      /* ما جرى للبريد يُقال صراحةً: «أُنشئ» وحدَها تُقرأ «وصل» — وقد لا يكون */
      if (send && email.trim()) {
        toast(r.emailDelivery === 'sent' ? `أُرسل الرابطُ إلى ${email.trim()}` : 'أُنشئ الرابط — ولم يُرسَل البريد، فانسخه بيدك')
      }
      setName('')
      setEmail('')
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر إنشاءُ الرابط')
    } finally {
      setBusy(false)
    }
  }

  /* التجديدُ يُعيد اللوحَ الطازجَ نفسَه — فمن جدّد رأى الرابطَ حيث اعتاد */
  /* نسخُ الرابط نفسِه — لا تجديدَ ولا إبطالَ لما بيد القارئ.
     صار ممكنا بحفظ الرمز (قرارُ صاحب المنصّة · ١٤ سبتمبر ٢٠٢٦). */
  const copyLink = async (row: LinkRow) => {
    if (!row.copyUrl) return
    try {
      await navigator.clipboard.writeText(row.copyUrl)
      toast(`نُسخ رابطُ ${row.reviewerName} — هو نفسُه، ولم يتغيّر شيء`)
    } catch {
      /* المتصفّحُ قد يمنع الحافظة — فيُعرض النصُّ ليُنسَخ باليد */
      setFresh({ url: row.copyUrl, name: row.reviewerName })
      setCopied(false)
    }
  }

  const rotate = async (row: LinkRow) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await apiPost<{ url: string; emailDelivery: string | null }>(
        `/api/admin/trainer-applications/${applicationId}/dossier-links/${row.id}/rotate`,
        row.reviewerEmail ? { sendEmail: true } : {},
      )
      setFresh({ url: r.url, name: row.reviewerName })
      setCopied(false)
      if (row.reviewerEmail) {
        toast(r.emailDelivery === 'sent'
          ? `جُدِّد الرابطُ وأُرسل إلى ${row.reviewerEmail}`
          : 'جُدِّد الرابط — ولم يُرسَل البريد، فانسخه بيدك')
      } else {
        toast('جُدِّد الرابط — انسخه الآن')
      }
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر تجديدُ الرابط')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (row: LinkRow) => {
    setBusy(true)
    try {
      await apiDelete(`/api/admin/trainer-applications/${applicationId}/dossier-links/${row.id}`)
      toast(`أُلغي رابطُ ${row.reviewerName}`)
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر الإلغاء')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel as="article" id="sec-links" className="scroll-mt-28 print:hidden">
      <h4 className="text-sm font-black">
        <Link2 className="ms-1 inline h-3.5 w-3.5" aria-hidden="true" /> روابطُ القُرّاء
      </h4>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        رابطٌ لكلّ قارئٍ باسمه — يُفتح بلا حساب، وما يكتبه يُنسَب إليه. ولا يرى قارئٌ تقييمَ زميله.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
          placeholder="اسمُ القارئ — كما يظهر في تقييمه"
          aria-label="اسم القارئ"
          className={`${staffControlCls} min-w-0 flex-1`}
        />
        <input
          type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
          placeholder="بريدُه — اختياريّ"
          aria-label="بريد القارئ"
          className={`${staffControlCls} min-w-0 flex-1`}
        />
        {/* ثانويٌّ لا رئيسيّ: الرئيسيُّ في هذه الشاشة زرُّ القرار، ولا ذهبيّان
            في شاشةٍ واحدة — إنشاءُ رابطٍ خطوةٌ لا غاية. */}
        <Button tone="secondary" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
          أنشئ رابطا
        </Button>
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-read leading-6 text-muted-foreground">
        <input
          type="checkbox" checked={send} disabled={!email.trim()}
          onChange={(e) => setSend(e.target.checked)} className="accent-gold"
        />
        أرسِلْه إليه بالبريد الآن — فالرمزُ لا يُحفظ، ولا سبيلَ إلى إرساله بعد هذه اللحظة.
      </label>

      {/* ═══ اللوحُ الوحيدُ الذي يُقرأ فيه الرمز ═══ */}
      {fresh && (
        <Inset className="mt-3 border-gold/40">
          <p className="text-read font-bold text-gold-ink">
            رابطُ {fresh.name} — انسخه الآن، فلا يُعرض ثانيةً أبدا
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg border border-white/12 bg-black/20 p-2 text-read">
              {fresh.url}
            </code>
            <Button
              tone={copied ? 'confirm' : 'secondary'} icon={copied ? Check : Copy}
              onClick={() => {
                void navigator.clipboard?.writeText(fresh.url)
                setCopied(true)
                toast('نُسخ الرابط')
              }}
            >
              {copied ? 'نُسخ' : 'انسخ'}
            </Button>
          </div>
        </Inset>
      )}

      <div className="mt-3 space-y-2">
        {rows === null && <p className="text-read text-muted-foreground">…تُقرأ الروابط</p>}
        {rows?.length === 0 && (
          <p className="text-read leading-6 text-muted-foreground">
            لا روابطَ بعد. أضِف اسمَ من تريده أن يقرأ الملفَّ ويقيّمه.
          </p>
        )}
        {rows?.map((row) => {
          const state = dossierLinkState(row)
          return (
            <Inset key={row.id} className="flex flex-wrap items-center justify-between gap-3 !py-2">
              <div className="min-w-0">
                <span className={`text-read font-bold ${state.spent ? 'text-muted-foreground line-through' : ''}`}>
                  {row.reviewerName}
                </span>
                <span className="block text-read leading-5 text-muted-foreground">
                  {state.textAr} · أجلُه {fmtDateTime(new Date(row.expiresAt))}
                </span>
              </div>
              {/* والملغى لا يُجدَّد: الإلغاءُ قرارٌ لا يُلتفّ حوله بزرّ. أمّا
                  المنتهي أجلُه فيُجدَّد — وهو أكثرُ ما يُجدَّد له. */}
              <div className="flex flex-wrap items-center gap-2">
                {row.copyUrl && (
                  <Button
                    tone="confirm"
                    icon={Copy}
                    disabled={busy}
                    onClick={() => { void copyLink(row) }}
                  >
                    انسخ الرابط
                  </Button>
                )}
                {!row.revokedAt && (
                  <Button tone="secondary" icon={RefreshCw} disabled={busy} onClick={() => void rotate(row)}>
                    جدّده وانسخه
                  </Button>
                )}
                {!state.spent && (
                  <Button tone="danger" icon={Ban} disabled={busy} onClick={() => void revoke(row)}>
                    ألغِه
                  </Button>
                )}
              </div>
            </Inset>
          )
        })}
      </div>

      {rows && rows.length > 0 && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          و«جدّده وانسخه» يعطيك رابطا جديدا للقارئ نفسِه — يبقى تقييمُه وسجلُّ فتحه،
          <b className="text-gold-ink"> ويتوقّف رابطُه القديمُ فورا</b>. ومن كان بريدُه محفوظا وصلَه الجديدُ تلقائيّا.
        </p>
      )}
    </Panel>
  )
}
