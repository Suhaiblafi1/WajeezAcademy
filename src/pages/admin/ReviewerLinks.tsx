/* روابطُ سجلِّ المتقدّم — تُنشأ باسمٍ وتُنسخ مرّةً وتُلغى.

   ═══ لماذا مرّةً واحدة ═══

   لا يُحفظ الرمزُ في القاعدة بل هاشُه، فلا سبيلَ إلى إظهاره ثانيةً ولو أردنا.
   وهو المقصود: من حاز الرابطَ فهو القارئُ المسمّى فيه، وسجلٌّ يُخرج رموزَه
   لمن فتح الشاشةَ ليس سجلّا محروسا.

   فالرمزُ يُعرض عند الإنشاء وحدَه في لوحٍ ظاهر، ومن أضاعه أنشأ غيرَه وألغى
   الأوّل — خطوتان، وكلتاهما في الأثر. */

import { useCallback, useEffect, useState } from 'react'
import { Link2, Copy, Ban, Check } from 'lucide-react'
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
}

export default function ReviewerLinks({ applicationId }: { applicationId: string }) {
  const [rows, setRows] = useState<LinkRow[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
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
      const r = await apiPost<{ url: string }>(`/api/admin/trainer-applications/${applicationId}/dossier-links`, {
        reviewerName: name.trim(),
      })
      setFresh({ url: r.url, name: name.trim() })
      setCopied(false)
      setName('')
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر إنشاءُ الرابط')
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
        {/* ثانويٌّ لا رئيسيّ: الرئيسيُّ في هذه الشاشة زرُّ القرار، ولا ذهبيّان
            في شاشةٍ واحدة — إنشاءُ رابطٍ خطوةٌ لا غاية. */}
        <Button tone="secondary" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
          أنشئ رابطا
        </Button>
      </div>

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
              {!state.spent && (
                <Button tone="danger" icon={Ban} disabled={busy} onClick={() => void revoke(row)}>
                  ألغِه
                </Button>
              )}
            </Inset>
          )
        })}
      </div>
    </Panel>
  )
}
